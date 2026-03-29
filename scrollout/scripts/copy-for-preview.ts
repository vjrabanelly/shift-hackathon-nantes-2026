import * as fs from 'fs';
import * as path from 'path';

const src = '/c/Users/Cédric/lab/echa/echa-app/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png';
const dst = path.join(__dirname, 'ic_launcher_foreground_xxxhdpi.png');

if (fs.existsSync(src)) {
  const data = fs.readFileSync(src);
  fs.writeFileSync(dst, data);
  console.log('Copied to', dst);
} else {
  console.log('Source not found');
}

// Also copy splash
const src2 = '/c/Users/Cédric/lab/echa/echa-app/android/app/src/main/res/drawable-port-xxxhdpi/splash.png';
const dst2 = path.join(__dirname, 'splash_port_xxxhdpi.png');

if (fs.existsSync(src2)) {
  const data = fs.readFileSync(src2);
  fs.writeFileSync(dst2, data);
  console.log('Copied to', dst2);
} else {
  console.log('Source not found');
}
