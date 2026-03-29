/**
 * Record a video of the Scrollout Wrapped on a connected Android device.
 *
 * Usage: npx tsx scripts/record-wrapped.ts [--delay MS] [--slides N]
 *
 * Prerequisites: scrcpy installed, ADB device connected, Wrapped open on first slide.
 * Output: data/wrapped-YYYYMMDD-HHMMSS.mp4
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);
const getArg = (name: string, def: string) => {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
};

const SLIDES = parseInt(getArg('slides', '19'));
const DELAY = parseInt(getArg('delay', '1300'));
const ADB = resolve(process.env.HOME || process.env.USERPROFILE || '', 'lab/platform-tools/adb.exe');
const SCRCPY = resolve(process.env.HOME || process.env.USERPROFILE || '',
  'AppData/Local/Microsoft/WinGet/Packages/Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe/scrcpy-win64-v3.3.4/scrcpy.exe');

const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15).replace(/(\d{8})(\d{6})/, '$1-$2');
const outDir = resolve('data');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const output = resolve(outDir, `wrapped-${ts}.mp4`);

function adb(cmd: string) { execSync(`"${ADB}" ${cmd}`, { timeout: 10000 }); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Check device
  const devices = execSync(`"${ADB}" devices`, { encoding: 'utf-8' });
  if (!devices.includes('\tdevice')) { console.error('❌ No device'); process.exit(1); }

  // Check scrcpy
  if (!existsSync(SCRCPY)) { console.error('❌ scrcpy not found at', SCRCPY); process.exit(1); }

  const size = execSync(`"${ADB}" shell wm size`, { encoding: 'utf-8' });
  const m = size.match(/(\d+)x(\d+)/);
  const w = m ? parseInt(m[1]) : 1080;
  const h = m ? parseInt(m[2]) : 2412;

  console.log(`📱 Device: ${w}x${h}`);
  console.log(`🎬 ${SLIDES} slides, ${DELAY}ms/slide → ~${Math.round(SLIDES * DELAY / 1000)}s`);
  console.log(`📁 ${output}`);
  console.log(`\n⏳ Place-toi sur la première slide du Wrapped, puis la capture démarre dans 3s...\n`);

  await sleep(3000);

  // Start recording
  const { spawn } = await import('child_process');
  const proc = spawn(SCRCPY, [
    '--no-playback',
    `--record=${output}`,
    '--video-bit-rate=8M',
    '--max-fps=30',
  ], { stdio: 'ignore', detached: true });

  await sleep(2000);
  console.log('🔴 Recording...');

  // Swipe through slides
  for (let i = 0; i < SLIDES - 1; i++) {
    console.log(`  Slide ${i + 1}/${SLIDES}`);
    await sleep(DELAY);
    adb(`shell input swipe ${Math.round(w * 0.75)} ${Math.round(h * 0.5)} ${Math.round(w * 0.2)} ${Math.round(h * 0.5)} 200`);
    await sleep(400);
  }
  console.log(`  Slide ${SLIDES}/${SLIDES} (fin)`);
  await sleep(2000);

  // Stop
  try { process.kill(-proc.pid!); } catch {}
  try { proc.kill(); } catch {}
  await sleep(2000);

  console.log(`\n✅ ${output}`);
}

main().catch(e => { console.error(e); process.exit(1); });
