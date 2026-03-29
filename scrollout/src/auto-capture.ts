/**
 * Auto-capture: scroll Instagram automatically, dump accessibility tree + screenshot at each step.
 * Uses direct UIAutomator dump (reliable) + ECHA service logs (bonus).
 * Usage: npx tsx src/auto-capture.ts [scrolls=20] [pauseMs=4000]
 */
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { findAdbPath } from './adb-path';

const DATA_DIR = path.join(__dirname, '..', 'data');
const adbPath = findAdbPath();

const scrollCount = parseInt(process.argv[2] || '20', 10);
const pauseMs = parseInt(process.argv[3] || '4000', 10);

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function adb(cmd: string): string {
  return execSync(`"${adbPath}" ${cmd}`, { encoding: 'utf-8', timeout: 15000 });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dumpUI(): string {
  try {
    adb('shell uiautomator dump /sdcard/ui_dump.xml');
  } catch {
    // "could not get idle state" is common but dump still works
  }
  return adb('shell cat /sdcard/ui_dump.xml');
}

function parseXmlNodes(xml: string): Array<{ text: string; desc: string; resourceId: string; class: string; bounds: string }> {
  const nodes: Array<{ text: string; desc: string; resourceId: string; class: string; bounds: string }> = [];
  const nodeRegex = /<node\s[^>]+>/g;
  let match: RegExpExecArray | null;

  while ((match = nodeRegex.exec(xml)) !== null) {
    const attr = (name: string): string => {
      const m = match![0].match(new RegExp(`${name}="([^"]*)"`));
      return m ? m[1] : '';
    };
    const text = attr('text');
    const desc = attr('content-desc');
    if (text || desc) {
      nodes.push({
        text,
        desc,
        resourceId: attr('resource-id').replace('com.instagram.android:id/', ''),
        class: attr('class'),
        bounds: attr('bounds'),
      });
    }
  }
  return nodes;
}

async function main(): Promise<void> {
  const sessionId = Date.now();
  const screenshotDir = path.join(DATA_DIR, `screenshots_${sessionId}`);
  mkdirSync(screenshotDir, { recursive: true });

  log(`=== ECHA Auto-Capture ===`);
  log(`Scrolls: ${scrollCount}, Pause: ${pauseMs}ms`);
  log(`Screenshots: ${screenshotDir}\n`);

  const captures: Array<{
    index: number;
    timestamp: string;
    screenshotFile: string;
    nodes: ReturnType<typeof parseXmlNodes>;
  }> = [];

  for (let i = 0; i < scrollCount; i++) {
    log(`--- Scroll ${i + 1}/${scrollCount} ---`);

    // Wait for content to settle
    await sleep(pauseMs);

    // Screenshot
    const screenshotFile = `${String(i + 1).padStart(3, '0')}.png`;
    try {
      adb('shell screencap -p /sdcard/echa_shot.png');
      adb(`pull /sdcard/echa_shot.png "${path.join(screenshotDir, screenshotFile)}"`);
    } catch {}

    // Dump accessibility tree
    const xml = dumpUI();
    const nodes = parseXmlNodes(xml);

    // Quick preview
    const usernames = nodes.filter(n => n.resourceId === 'row_feed_photo_profile_name').map(n => n.text);
    const captions = nodes.filter(n => n.class?.includes('IgTextLayoutView')).map(n => n.text).filter(Boolean);

    if (usernames.length > 0) {
      log(`  Posts: ${usernames.map(u => '@' + u).join(', ')}`);
    }
    if (captions.length > 0) {
      for (const cap of captions) {
        log(`  Caption: ${cap.substring(0, 100)}`);
      }
    }

    captures.push({
      index: i + 1,
      timestamp: new Date().toISOString(),
      screenshotFile,
      nodes,
    });

    // Scroll
    const scrollY = 800 + Math.floor(Math.random() * 400);
    adb(`shell input swipe 540 1600 540 ${1600 - scrollY} ${400 + Math.floor(Math.random() * 200)}`);

    await sleep(1500);
  }

  // Save session
  const sessionData = {
    capturedAt: new Date().toISOString(),
    durationSec: Math.round((scrollCount * (pauseMs + 1500)) / 1000),
    totalCaptures: captures.length,
    screenshotDir,
    scrollCount,
    pauseMs,
    // Convert to events format compatible with analyzer
    events: captures.map(c => ({
      timestamp: new Date(c.timestamp).getTime(),
      eventType: 'SCROLL_CAPTURE',
      screenType: 'feed',
      nodeCount: c.nodes.length,
      focusedPostId: '',
      focusedPost: null,
      visiblePosts: [],
      dwellTimes: {},
      screenshotFile: c.screenshotFile,
      nodes: c.nodes.map(n => ({
        text: n.text,
        desc: n.desc,
        class: n.class,
        resourceId: n.resourceId ? 'com.instagram.android:id/' + n.resourceId : '',
        depth: 0,
        clickable: false,
        scrollable: false,
        bounds: n.bounds,
      })),
      imageDescriptions: c.nodes.filter(n => n.desc && n.desc.length > 30).map(n => n.desc),
    })),
  };

  const outPath = path.join(DATA_DIR, `session_${sessionId}.json`);
  writeFileSync(outPath, JSON.stringify(sessionData, null, 2), 'utf-8');

  log(`\n========================================`);
  log(`  Auto-capture terminée`);
  log(`========================================`);
  log(`Captures: ${captures.length}`);
  log(`Screenshots: ${screenshotDir}`);
  log(`Session: ${outPath}`);
  log(`\nAnalyse: npx tsx src/analyzer.ts "${outPath}"`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
