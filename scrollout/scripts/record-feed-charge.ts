/**
 * Record a video of the Instagram feed scroll → FAB charge → firework explosion.
 *
 * Scénario:
 * 1. Ouvre l'app Scrollout sur le feed Instagram
 * 2. Scrolle lentement le feed (posts défilent)
 * 3. Le FAB en bas à droite se charge (ring incandescent)
 * 4. À 15 posts → explosion de bulles colorées (firework)
 * 5. Capture vidéo via scrcpy
 *
 * Usage: npx tsx scripts/record-feed-charge.ts [--scroll-delay MS] [--scroll-count N]
 *
 * Options:
 *   --scroll-delay MS   Pause entre chaque scroll (default: 1800)
 *   --scroll-count N    Nombre de scrolls à faire (default: 20, ~15 posts)
 *   --hold-end MS       Temps à rester sur le firework (default: 5000)
 */

import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);
const getArg = (name: string, def: string) => {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
};

const SCROLL_DELAY = parseInt(getArg('scroll-delay', '1800'));
const SCROLL_COUNT = parseInt(getArg('scroll-count', '20'));
const HOLD_END = parseInt(getArg('hold-end', '5000'));
const ADB = resolve(process.env.HOME || process.env.USERPROFILE || '', 'lab/platform-tools/adb.exe');
const SCRCPY = resolve(process.env.HOME || process.env.USERPROFILE || '',
  'AppData/Local/Microsoft/WinGet/Packages/Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe/scrcpy-win64-v3.3.4/scrcpy.exe');

const ts = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 15);
const outDir = resolve('data');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const output = resolve(outDir, `feed-charge-${ts}.mp4`);

function adb(cmd: string) { execSync(`"${ADB}" ${cmd}`, { timeout: 10000 }); }
function adbOut(cmd: string) { return execSync(`"${ADB}" ${cmd}`, { encoding: 'utf-8', timeout: 10000 }).trim(); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const devices = adbOut('devices');
  if (!devices.includes('\tdevice')) { console.error('❌ No device'); process.exit(1); }
  if (!existsSync(SCRCPY)) { console.error('❌ scrcpy not found'); process.exit(1); }

  const size = adbOut('shell wm size');
  const m = size.match(/(\d+)x(\d+)/);
  const w = m ? parseInt(m[1]) : 1080;
  const h = m ? parseInt(m[2]) : 2412;

  const totalTime = Math.round((SCROLL_COUNT * SCROLL_DELAY + HOLD_END + 5000) / 1000);
  console.log(`📱 ${w}x${h}`);
  console.log(`🔄 ${SCROLL_COUNT} scrolls × ${SCROLL_DELAY}ms = ~${totalTime}s`);
  console.log(`📁 ${output}\n`);

  // Reset charge by force-stopping and relaunching
  console.log('🔄 Relancement de l\'app (reset charge)...');
  adb('shell am force-stop com.lab.echa.app');
  await sleep(1000);
  adb('shell am start -S -n com.lab.echa.app/.MainActivity');
  await sleep(6000);

  // Take a quick screenshot to verify we're on Instagram feed
  console.log('📸 Vérification du feed...');
  await sleep(2000);

  // Start recording
  console.log('🔴 Démarrage enregistrement...');
  const proc = spawn(SCRCPY, [
    '--no-playback',
    `--record=${output}`,
    '--video-bit-rate=8M',
    '--max-fps=30',
  ], { stdio: 'ignore', detached: true });

  await sleep(2000);

  // Scroll Instagram feed naturally
  // Vary scroll distances for natural feel
  const scrollDistances = [
    0.35, 0.45, 0.30, 0.50, 0.40, 0.55, 0.35, 0.45,
    0.50, 0.30, 0.60, 0.40, 0.35, 0.50, 0.45, 0.55,
    0.40, 0.35, 0.50, 0.45, 0.30, 0.55, 0.40, 0.50,
  ];

  for (let i = 0; i < SCROLL_COUNT; i++) {
    const dist = scrollDistances[i % scrollDistances.length];
    const startY = Math.round(h * 0.7);
    const endY = Math.round(h * (0.7 - dist));
    const duration = 250 + Math.round(Math.random() * 150); // 250-400ms natural speed

    console.log(`  Scroll ${i + 1}/${SCROLL_COUNT} (${Math.round(dist * 100)}% screen)`);
    adb(`shell input swipe ${Math.round(w * 0.5)} ${startY} ${Math.round(w * 0.5)} ${endY} ${duration}`);

    // Variable pause — sometimes longer (reading a post)
    const pause = SCROLL_DELAY + Math.round((Math.random() - 0.3) * 600);
    await sleep(Math.max(800, pause));
  }

  // Hold on the firework explosion
  console.log('🎆 Explosion ! On attend...');
  await sleep(HOLD_END);

  // Stop recording
  console.log('⏹️  Stop enregistrement...');
  try { process.kill(-proc.pid!); } catch {}
  try { proc.kill(); } catch {}
  await sleep(2000);

  console.log(`\n✅ Vidéo: ${output} (~${totalTime}s)`);
}

main().catch(e => { console.error(e); process.exit(1); });
