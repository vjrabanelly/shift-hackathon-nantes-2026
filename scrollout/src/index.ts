import { writeFileSync } from 'fs';
import path from 'path';
import {
  getDevices,
  dumpAccessibilityTree,
  getCurrentPackage,
  scrollDown,
  takeScreenshot,
} from './adb';
import { extractInstagramData, type InstagramData } from './parser';

const DATA_DIR = path.join(__dirname, '..', 'data');

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  log('=== ECHA — Instagram Accessibility Data Extractor ===');

  // Step 1: Check device connection
  log('Checking connected devices...');
  const devices = getDevices();

  if (devices.length === 0) {
    console.error('No device connected. Make sure USB debugging is enabled and the device is connected.');
    process.exit(1);
  }

  log(`Found ${devices.length} device(s): ${devices.join(', ')}`);

  // Step 2: Check current foreground app
  log('Checking current foreground app...');
  const currentApp = getCurrentPackage();
  log(`Current focus:\n${currentApp}`);

  const isInstagram = currentApp.includes('com.instagram.android');
  if (!isInstagram) {
    log('⚠ Instagram is not in the foreground. Please open Instagram on your phone.');
    log('Continuing anyway — will dump whatever is on screen...');
  }

  // Step 3: Take screenshot for reference
  const screenshotPath = path.join(DATA_DIR, 'screenshot.png');
  log('Taking screenshot...');
  try {
    takeScreenshot(screenshotPath);
    log(`Screenshot saved to ${screenshotPath}`);
  } catch (e) {
    log(`Screenshot failed: ${e}`);
  }

  // Step 4: Dump accessibility tree
  log('Dumping accessibility tree...');
  const xmlDump = dumpAccessibilityTree();
  const xmlPath = path.join(DATA_DIR, 'ui_dump.xml');
  writeFileSync(xmlPath, xmlDump, 'utf-8');
  log(`Raw XML dump saved to ${xmlPath} (${xmlDump.length} chars)`);

  // Step 5: Parse and extract Instagram data
  log('Parsing accessibility data...');
  const data = extractInstagramData(xmlDump);
  logResults(data);

  // Save structured data
  const jsonPath = path.join(DATA_DIR, `extract_${Date.now()}.json`);
  writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
  log(`Structured data saved to ${jsonPath}`);

  // Step 6: Optional — scroll and collect more data
  const scrollCount = parseInt(process.argv[2] || '0', 10);
  if (scrollCount > 0) {
    log(`Scrolling ${scrollCount} times to collect more data...`);
    const allData: InstagramData[] = [data];

    for (let i = 0; i < scrollCount; i++) {
      log(`Scroll ${i + 1}/${scrollCount}...`);
      scrollDown();
      await sleep(2000); // Wait for content to load

      const xml = dumpAccessibilityTree();
      const scrollData = extractInstagramData(xml);
      allData.push(scrollData);
      logResults(scrollData);
    }

    const allJsonPath = path.join(DATA_DIR, `full_extract_${Date.now()}.json`);
    writeFileSync(allJsonPath, JSON.stringify(allData, null, 2), 'utf-8');
    log(`Full extraction saved to ${allJsonPath}`);
  }

  log('Done.');
}

function logResults(data: InstagramData): void {
  log(`Screen type: ${data.screen}`);
  log(`Total nodes with content: ${data.rawNodes.length}`);

  if (data.posts.length > 0) {
    log(`Found ${data.posts.length} post(s):`);
    for (const post of data.posts) {
      console.log(`  - @${post.username}: ${post.caption.substring(0, 80)}...`);
      if (post.likes) console.log(`    Likes: ${post.likes}`);
      if (post.comments) console.log(`    Comments: ${post.comments}`);
    }
  }

  if (data.profileInfo) {
    log('Profile info:');
    console.log(`  Username: ${data.profileInfo.username}`);
    console.log(`  Name: ${data.profileInfo.fullName}`);
    console.log(`  Bio: ${data.profileInfo.bio}`);
    console.log(`  Followers: ${data.profileInfo.followers}`);
    console.log(`  Following: ${data.profileInfo.following}`);
  }

  // Log all text content found
  log('--- All visible text content ---');
  for (const node of data.rawNodes) {
    if (node.text) console.log(`  [text] ${node.text}`);
    if (node.contentDesc) console.log(`  [desc] ${node.contentDesc}`);
  }
  log('--- End ---');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
