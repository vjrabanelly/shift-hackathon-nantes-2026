import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

// Try to find ADB in common locations
const ADB_PATHS = [
  path.join(process.env.HOME || process.env.USERPROFILE || '', 'lab/platform-tools/adb.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Android/Sdk/platform-tools/adb.exe'),
  'adb', // PATH fallback
];

function findAdb(): string {
  for (const p of ADB_PATHS) {
    if (p === 'adb') {
      try {
        execSync('adb version', { stdio: 'pipe' });
        return 'adb';
      } catch { continue; }
    }
    if (existsSync(p)) return `"${p}"`;
  }
  throw new Error('ADB not found. Install Android Platform Tools first.');
}

const ADB = findAdb();

export function adbCommand(cmd: string): string {
  const full = `${ADB} ${cmd}`;
  console.log(`[ADB] ${full}`);
  return execSync(full, { encoding: 'utf-8', timeout: 30000 });
}

export function adbShell(cmd: string): string {
  return adbCommand(`shell ${cmd}`);
}

export function getDevices(): string[] {
  const output = adbCommand('devices');
  return output
    .split('\n')
    .slice(1)
    .map(line => line.trim())
    .filter(line => line.endsWith('device'))
    .map(line => line.split('\t')[0]);
}

export function dumpAccessibilityTree(): string {
  // UIAutomator dump the current screen's accessibility tree
  adbShell('uiautomator dump /sdcard/ui_dump.xml');
  return adbCommand('shell cat /sdcard/ui_dump.xml');
}

export function takeScreenshot(localPath: string): void {
  adbShell('screencap -p /sdcard/screenshot.png');
  adbCommand(`pull /sdcard/screenshot.png "${localPath}"`);
}

export function tapScreen(x: number, y: number): void {
  adbShell(`input tap ${x} ${y}`);
}

export function swipeScreen(x1: number, y1: number, x2: number, y2: number, durationMs = 500): void {
  adbShell(`input swipe ${x1} ${y1} ${x2} ${y2} ${durationMs}`);
}

export function scrollDown(): void {
  // Swipe from center-bottom to center-top
  swipeScreen(540, 1600, 540, 400, 600);
}

export function getCurrentPackage(): string {
  const output = adbShell('dumpsys window | grep -E "mCurrentFocus|mFocusedApp"');
  return output;
}
