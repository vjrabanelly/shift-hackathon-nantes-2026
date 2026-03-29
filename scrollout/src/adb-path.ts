import { existsSync } from 'fs';
import path from 'path';

const ADB_PATHS = [
  process.env.ADB_PATH || '',
  path.join(process.env.HOME || process.env.USERPROFILE || '', 'Library/Android/sdk/platform-tools/adb'),
  path.join(process.env.HOME || process.env.USERPROFILE || '', 'lab/platform-tools/adb.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Android/Sdk/platform-tools/adb.exe'),
];

export function findAdbPath(): string {
  for (const p of ADB_PATHS) {
    if (existsSync(p)) return p;
  }
  throw new Error('ADB not found');
}
