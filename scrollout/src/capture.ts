/**
 * Capture Instagram accessibility data with dwell time tracking.
 * Usage: npx tsx src/capture.ts [seconds=30]
 */
import { spawn, execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { findAdbPath } from './adb-path';

const DATA_DIR = path.join(__dirname, '..', 'data');
const TAG = 'ECHA_DATA';
const MLKIT_TAG = 'ECHA_MLKIT';
const duration = parseInt(process.argv[2] || '30', 10) * 1000;

interface VisiblePost {
  postId: string;
  username: string;
  caption: string;
  imageDescription: string;
  likeCount: string;
  date: string;
  mediaType: string;
  carouselCount?: number;
  isSponsored: boolean;
  isSuggested: boolean;
}

interface EchaEvent {
  timestamp: number;
  eventType: string;
  screenType: string;
  nodeCount: number;
  focusedPostId: string;
  focusedPost: VisiblePost | null;
  visiblePosts: VisiblePost[];
  dwellTimes: Record<string, number>;
  nodes: unknown[];
  imageDescriptions: string[];
}

interface SessionSummary {
  type: string;
  timestamp: number;
  totalPostsViewed: number;
  posts: Array<{
    postId: string;
    dwellTimeMs: number;
    dwellTimeSec: number;
    metadata?: VisiblePost;
  }>;
}

interface MLKitResult {
  postId: string;
  labels: Array<{ text: string; confidence: number }>;
  ocrText: string;
  processingMs: number;
}

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

const adbPath = findAdbPath();
const events: EchaEvent[] = [];
const summaries: SessionSummary[] = [];
const mlkitResults: Record<string, MLKitResult[]> = {}; // postId → results
let chunkBuffer: string[] = [];
let expectedChunks = 0;
let lastFocusedPost = '';

const clear = spawn(adbPath, ['logcat', '-c']);
clear.on('close', () => {
  log(`=== ECHA v2 — Instagram Tracker (${duration / 1000}s) ===`);
  log('Scroll Instagram on your phone!\n');

  const logcat = spawn(adbPath, ['logcat', '-s', `${TAG}:I`, `${MLKIT_TAG}:I`, '*:S', '-v', 'raw']);

  logcat.stdout.on('data', (data: Buffer) => {
    for (const line of data.toString('utf-8').split('\n')) {
      if (line.trim()) processLine(line.trim());
    }
  });

  setTimeout(() => {
    logcat.kill();
    save();
  }, duration);
});

function processLine(line: string): void {
  if (!line || line.startsWith('-----')) return;
  if (line.startsWith('SERVICE_')) { log(`[service] ${line}`); return; }

  // Session summaries
  if (line.startsWith('SUMMARY|')) {
    try {
      const summary = JSON.parse(line.substring(8)) as SessionSummary;
      summaries.push(summary);
      logSummary(summary);
    } catch { /* ignore */ }
    return;
  }

  // MLKit results
  if (line.startsWith('MLKIT|') || line.startsWith('ECHA_MLKIT|')) {
    const separator = line.indexOf('|');
    if (separator !== -1) {
      try {
        const data = JSON.parse(line.substring(separator + 1)) as MLKitResult;
        if (data.postId) {
          if (!mlkitResults[data.postId]) mlkitResults[data.postId] = [];
          mlkitResults[data.postId].push(data);
          if (data.ocrText) {
            log(`[mlkit] OCR for ${data.postId.split('|')[0]}: "${data.ocrText.substring(0, 80)}"`);
          }
          if (data.labels?.length) {
            log(`[mlkit] Labels: ${data.labels.map(l => `${l.text}(${(l.confidence * 100).toFixed(0)}%)`).join(', ')}`);
          }
        }
      } catch { /* ignore */ }
    }
    return;
  }

  if (line.startsWith('DATA|')) {
    try { handleEvent(JSON.parse(line.substring(5))); } catch { /* */ }
    return;
  }

  if (line.startsWith('CHUNK|')) {
    const parts = line.split('|');
    if (parts.length >= 4) {
      const index = parseInt(parts[1], 10);
      const total = parseInt(parts[2], 10);
      if (expectedChunks !== total) {
        chunkBuffer = new Array(total).fill('');
        expectedChunks = total;
      }
      chunkBuffer[index] = parts.slice(3).join('|');
    }
    return;
  }

  if (line.startsWith('END|')) {
    if (chunkBuffer.length > 0 && chunkBuffer.every(c => c !== '')) {
      try { handleEvent(JSON.parse(chunkBuffer.join(''))); } catch { /* */ }
    }
    chunkBuffer = [];
    expectedChunks = 0;
  }
}

function handleEvent(event: EchaEvent): void {
  events.push(event);

  const focused = event.focusedPost;
  const postId = event.focusedPostId || '';

  // Only log when focused post changes
  if (postId !== lastFocusedPost && focused) {
    const mediaIcon = focused.mediaType === 'video' ? '🎬' :
                      focused.mediaType === 'carousel' ? '🖼️' : '📷';
    const sponsoredTag = focused.isSponsored ? ' [SPONSORED]' : '';
    const suggestedTag = focused.isSuggested ? ' [SUGGESTED]' : '';

    log(`${mediaIcon} Now viewing: @${focused.username}${sponsoredTag}${suggestedTag}`);
    if (focused.imageDescription) {
      console.log(`   Image: ${focused.imageDescription.substring(0, 120)}`);
    }
    if (focused.caption) {
      console.log(`   Caption: ${focused.caption.substring(0, 120)}`);
    }
    if (focused.likeCount) {
      console.log(`   Likes: ${focused.likeCount}`);
    }
    if (focused.date) {
      console.log(`   Date: ${focused.date}`);
    }
    // Take screenshot for this post
    takePostScreenshot(focused.username, events.length);

    console.log('');
    lastFocusedPost = postId;
  }

  // Show visible posts count
  const visible = event.visiblePosts?.length || 0;
  if (visible > 0 && postId !== lastFocusedPost) {
    log(`${visible} post(s) visible on screen`);
  }
}

function logSummary(summary: SessionSummary): void {
  log(`\n--- Session Summary (${summary.totalPostsViewed} posts viewed) ---`);
  if (summary.posts) {
    const sorted = [...summary.posts].sort((a, b) => b.dwellTimeMs - a.dwellTimeMs);
    for (const p of sorted) {
      const username = p.metadata?.username || p.postId.split('|')[0] || '?';
      const secs = p.dwellTimeSec.toFixed(1);
      const media = p.metadata?.mediaType || '?';
      const sponsored = p.metadata?.isSponsored ? ' [AD]' : '';
      console.log(`   ${secs}s  @${username} (${media})${sponsored}`);
    }
  }
  console.log('');
}

let screenshotDir = '';

function takePostScreenshot(username: string, eventIdx: number): void {
  try {
    if (!screenshotDir) {
      screenshotDir = path.join(DATA_DIR, `screenshots_${Date.now()}`);
      mkdirSync(screenshotDir, { recursive: true });
    }
    const safeName = username.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 30);
    const filename = `${String(eventIdx).padStart(3, '0')}_${safeName}.png`;
    const localPath = path.join(screenshotDir, filename);

    execSync(`"${adbPath}" shell screencap -p /sdcard/echa_shot.png`, { timeout: 5000 });
    execSync(`"${adbPath}" pull /sdcard/echa_shot.png "${localPath}"`, { timeout: 5000, stdio: 'pipe' });
    log(`   Screenshot: ${filename}`);
  } catch {
    // Non-blocking — skip if screenshot fails
  }
}

function save(): void {
  if (events.length === 0) {
    log('No events captured.');
    process.exit(1);
  }

  // Build session report
  const lastDwell = events[events.length - 1]?.dwellTimes || {};
  const postDetails: Record<string, VisiblePost> = {};

  for (const evt of events) {
    if (evt.visiblePosts) {
      for (const p of evt.visiblePosts) {
        if (p.postId) postDetails[p.postId] = p;
      }
    }
  }

  const report = {
    capturedAt: new Date().toISOString(),
    durationSec: duration / 1000,
    totalEvents: events.length,
    totalPostsViewed: Object.keys(lastDwell).length,
    postsBydwellTime: Object.entries(lastDwell)
      .map(([postId, ms]) => ({
        postId,
        dwellTimeSec: Math.round((ms as number) / 100) / 10,
        ...(postDetails[postId] || {}),
      }))
      .sort((a, b) => b.dwellTimeSec - a.dwellTimeSec),
    events,
    summaries,
    mlkitResults,
  };

  const outPath = path.join(DATA_DIR, `session_${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');

  // Print final report
  log('\n========================================');
  log('         SESSION REPORT');
  log('========================================');
  log(`Duration: ${duration / 1000}s`);
  log(`Events captured: ${events.length}`);
  log(`Posts viewed: ${report.totalPostsViewed}\n`);

  if (report.postsBydwellTime.length > 0) {
    log('Posts by time spent:');
    console.log('─'.repeat(70));
    for (const p of report.postsBydwellTime) {
      const username = (p as any).username || p.postId.split('|')[0] || '?';
      const secs = p.dwellTimeSec;
      const media = (p as any).mediaType || '';
      const sponsored = (p as any).isSponsored ? ' [AD]' : '';
      const caption = ((p as any).caption || '').substring(0, 60);
      const imgDesc = ((p as any).imageDescription || '').substring(0, 60);
      const bar = '█'.repeat(Math.min(Math.round(secs), 40));

      console.log(`  ${String(secs).padStart(5)}s  @${username} ${media}${sponsored}`);
      if (imgDesc) console.log(`         ${imgDesc}`);
      if (caption) console.log(`         "${caption}"`);
      console.log(`         ${bar}`);
      console.log('');
    }
  }

  log(`Saved to: ${outPath}`);
  process.exit(0);
}
