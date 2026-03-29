import { writeFileSync } from 'fs';
import path from 'path';
import {
  getDevices,
  dumpAccessibilityTree,
  getCurrentPackage,
  scrollDown,
  adbShell,
} from './adb';
import { parseXmlDump } from './parser';

const DATA_DIR = path.join(__dirname, '..', 'data');

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface PostDetail {
  index: number;
  screen: string;
  allTexts: string[];
  allDescriptions: string[];
  imageDescriptions: string[];
  username: string;
  likes: string;
  comments: string;
  date: string;
  caption: string;
}

function extractPostDetail(xml: string, index: number): PostDetail {
  const nodes = parseXmlDump(xml);

  const allTexts = nodes.filter(n => n.text).map(n => n.text);
  const allDescriptions = nodes.filter(n => n.contentDesc).map(n => n.contentDesc);

  // Instagram image descriptions often start with "Photo de" or contain
  // "may contain", "photo de", "image de", or are on ImageView nodes
  const imageDescriptions = allDescriptions.filter(desc => {
    const d = desc.toLowerCase();
    return (
      d.includes('photo de') ||
      d.includes('image de') ||
      d.includes('may contain') ||
      d.includes('peut contenir') ||
      d.includes('photo by') ||
      d.includes('a publié') ||
      (d.length > 50 && !d.includes('story'))  // Long descriptions are usually image alt-text
    );
  });

  // Extract structured fields
  let username = '';
  let likes = '';
  let comments = '';
  let date = '';
  let caption = '';

  for (const node of nodes) {
    const rid = node.resourceId;
    const text = node.text;
    const desc = node.contentDesc;

    if (rid.includes('username') || rid.includes('profile_name')) {
      username = text;
    }
    if (!username && desc && desc.includes('Photo de profil de')) {
      username = desc.replace('Photo de profil de ', '');
    }
    if (text && (text.includes('J\'aime') || text.match(/^\d[\d\s]*$/))) {
      if (!likes && node.resourceId.includes('like')) likes = text;
    }
    if (desc && (desc.includes('J\'aime') || desc.includes('like'))) {
      if (!likes) likes = desc;
    }
    if (desc && desc.includes('commentaire')) {
      comments = desc;
    }
    if (text && (text.match(/^\d+\s+(mars|avril|mai|juin|juil|août|sept|oct|nov|déc|janv|fév)/) || text.includes('il y a'))) {
      date = text;
    }
    if (rid.includes('caption') || rid.includes('comment_textview')) {
      caption = text;
    }
  }

  return {
    index,
    screen: `scroll_${index}`,
    allTexts,
    allDescriptions,
    imageDescriptions,
    username,
    likes,
    comments,
    date,
    caption,
  };
}

async function main(): Promise<void> {
  const scrollCount = parseInt(process.argv[2] || '10', 10);

  log('=== ECHA — Deep Instagram Extractor (feed + image descriptions) ===');

  const devices = getDevices();
  if (devices.length === 0) {
    console.error('No device connected.');
    process.exit(1);
  }
  log(`Device: ${devices[0]}`);

  // Navigate to Home feed
  log('Navigating to Home feed...');
  // Tap the Home button (bottom-left area of Instagram)
  adbShell('input keyevent KEYCODE_BACK');
  await sleep(500);

  const focus = getCurrentPackage();
  log(`Focus: ${focus.trim()}`);

  log(`Will scroll ${scrollCount} times in the feed and capture everything...`);

  const results: PostDetail[] = [];

  for (let i = 0; i < scrollCount; i++) {
    log(`\n--- Capture ${i + 1}/${scrollCount} ---`);

    let xml: string;
    try {
      xml = dumpAccessibilityTree();
    } catch (e) {
      log(`Dump failed, retrying... ${e}`);
      await sleep(1000);
      xml = dumpAccessibilityTree();
    }

    const detail = extractPostDetail(xml, i);
    results.push(detail);

    // Log key findings
    if (detail.username) log(`  User: ${detail.username}`);
    if (detail.imageDescriptions.length > 0) {
      log(`  📷 Image descriptions found: ${detail.imageDescriptions.length}`);
      for (const desc of detail.imageDescriptions) {
        log(`    → ${desc.substring(0, 120)}`);
      }
    }
    if (detail.caption) log(`  Caption: ${detail.caption.substring(0, 80)}`);
    if (detail.likes) log(`  Likes: ${detail.likes}`);

    // Log ALL descriptions for debugging
    log(`  All descriptions (${detail.allDescriptions.length}):`);
    for (const desc of detail.allDescriptions) {
      if (desc.length > 5) console.log(`    [desc] ${desc}`);
    }

    scrollDown();
    await sleep(2500); // Wait for new content
  }

  const outPath = path.join(DATA_DIR, `deep_extract_${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  log(`\nSaved ${results.length} captures to ${outPath}`);

  // Summary
  const allImageDescs = results.flatMap(r => r.imageDescriptions);
  log(`\n=== SUMMARY ===`);
  log(`Total captures: ${results.length}`);
  log(`Image descriptions found: ${allImageDescs.length}`);
  if (allImageDescs.length > 0) {
    log(`\nAll image descriptions:`);
    for (const desc of [...new Set(allImageDescs)]) {
      console.log(`  → ${desc}`);
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
