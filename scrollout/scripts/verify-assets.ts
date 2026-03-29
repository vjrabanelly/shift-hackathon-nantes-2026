import * as fs from 'fs';

const baseDir = '/c/Users/Cédric/lab/echa/echa-app/android/app/src/main/res';
const checks = [
  'mipmap-mdpi/ic_launcher_foreground.png',
  'mipmap-xxxhdpi/ic_launcher_foreground.png',
  'drawable-port-mdpi/splash.png',
  'drawable-port-xxxhdpi/splash.png',
  'drawable-land-mdpi/splash.png',
];

console.log('Verifying generated assets...\n');

for (const check of checks) {
  const fullPath = `${baseDir}/${check}`;
  const exists = fs.existsSync(fullPath);
  const status = exists ? '✓' : '✗';
  if (exists) {
    const stats = fs.statSync(fullPath);
    console.log(`${status} ${check} (${stats.size} bytes)`);
  } else {
    console.log(`${status} ${check} (missing)`);
  }
}
