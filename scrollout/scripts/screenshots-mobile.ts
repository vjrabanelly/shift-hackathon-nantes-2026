/**
 * screenshots-mobile.ts
 * Capture automatique des screenshots de l'app Scrollout sur device Android.
 *
 * Usage:
 *   npx tsx scripts/screenshots-mobile.ts
 *   npx tsx scripts/screenshots-mobile.ts --output ./scrollout-site/public/screenshots
 *
 * Prérequis: device connecté via ADB avec l'app Scrollout installée
 */

import { execSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { findAdbPath } from '../src/adb-path';

const PACKAGE = 'com.lab.echa.app';
const ACTIVITY = `${PACKAGE}/.MainActivity`;
const DEVICE_PATH = '/sdcard/scrollout_screenshot.png';

// Screens à capturer — correspondance avec les onglets de l'app
const SCREENS = [
  { name: 'home', tab: 0, label: 'Accueil', waitMs: 2000 },
  { name: 'posts', tab: 1, label: 'Posts capturés', waitMs: 3000 },
  { name: 'enrichment', tab: 2, label: 'Enrichissement', waitMs: 3000 },
  { name: 'settings', tab: 3, label: 'Configuration', waitMs: 1500 },
] as const;

function adb(cmd: string): string {
  const adbPath = findAdbPath();
  try {
    return execSync(`"${adbPath}" ${cmd}`, { encoding: 'utf-8', timeout: 15000 }).trim();
  } catch (e: any) {
    console.error(`  [ADB ERROR] ${cmd}: ${e.message}`);
    return '';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function tap(x: number, y: number) {
  adb(`shell input tap ${x} ${y}`);
}

function screenshot(localPath: string) {
  adb(`shell screencap -p ${DEVICE_PATH}`);
  adb(`pull ${DEVICE_PATH} "${localPath}"`);
  adb(`shell rm ${DEVICE_PATH}`);
}

function getScreenSize(): { w: number; h: number } {
  const raw = adb('shell wm size');
  const match = raw.match(/(\d+)x(\d+)/);
  if (!match) return { w: 1080, h: 2400 };
  return { w: parseInt(match[1]), h: parseInt(match[2]) };
}

async function main() {
  const args = process.argv.slice(2);
  const outputIdx = args.indexOf('--output');
  const outputDir = outputIdx >= 0 ? resolve(args[outputIdx + 1]) : resolve('scrollout-site/public/screenshots');

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\n  Scrollout — Capture automatique des screenshots`);
  console.log(`  Output: ${outputDir}\n`);

  // Vérifier device
  const devices = adb('devices');
  if (!devices.includes('\tdevice')) {
    console.error('  Aucun device Android connecté. Branchez un device et réessayez.');
    process.exit(1);
  }

  const screen = getScreenSize();
  console.log(`  Device: ${screen.w}x${screen.h}`);

  // Lancer l'app
  console.log(`  Lancement de Scrollout...`);
  adb(`shell am start -n ${ACTIVITY}`);
  await sleep(3000);

  // Tab bar: on calcule les positions X des onglets
  // La tab bar est en bas de l'écran, on divise en N onglets
  const tabY = screen.h - 60; // ~60px du bas
  const tabCount = SCREENS.length;

  for (const s of SCREENS) {
    const tabX = Math.round((screen.w / tabCount) * (s.tab + 0.5));

    console.log(`  [${s.name}] Tap onglet "${s.label}" (${tabX}, ${tabY})...`);
    tap(tabX, tabY);
    await sleep(s.waitMs);

    const filePath = resolve(outputDir, `${s.name}.png`);
    console.log(`  [${s.name}] Screenshot -> ${s.name}.png`);
    screenshot(filePath);
  }

  // Screenshot bonus: scroll le feed de posts pour montrer du contenu
  console.log(`\n  [posts-scroll] Capture du feed scrollé...`);
  const postsTabX = Math.round((screen.w / tabCount) * (1 + 0.5));
  tap(postsTabX, tabY);
  await sleep(2000);

  // Scroll down
  adb(`shell input swipe ${screen.w / 2} ${screen.h * 0.7} ${screen.w / 2} ${screen.h * 0.3} 400`);
  await sleep(1500);
  screenshot(resolve(outputDir, 'posts-scroll.png'));

  // Screenshot bonus: detail modal (tap sur le premier post)
  console.log(`  [post-detail] Ouverture détail post...`);
  tap(screen.w / 2, screen.h * 0.35);
  await sleep(1500);
  screenshot(resolve(outputDir, 'post-detail.png'));

  console.log(`\n  Terminé ! ${SCREENS.length + 2} screenshots capturés dans:`);
  console.log(`  ${outputDir}\n`);
}

main().catch(console.error);
