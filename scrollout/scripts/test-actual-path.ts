import { createCanvas } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

const baseDir = '/c/Users/Cédric/lab/echa/echa-app/android/app/src/main/res';
const outputDir = path.join(baseDir, 'mipmap-mdpi');
const outputPath = path.join(outputDir, 'ic_launcher_foreground.png');

console.log('outputPath:', outputPath);
console.log('outputDir exists:', fs.existsSync(outputDir));

const canvas = createCanvas(108, 108);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, 108, 108);

const png = canvas.toBuffer('image/png');
console.log('Buffer size:', png.length);

try {
  fs.writeFileSync(outputPath, png);
  console.log('Write succeeded');
  console.log('File exists after write:', fs.existsSync(outputPath));
  const stats = fs.statSync(outputPath);
  console.log('File stats:', stats.size);
} catch (e: any) {
  console.error('Write failed:', e.message);
}

// Also list directory
console.log('Files in output dir:');
fs.readdirSync(outputDir).forEach(f => {
  console.log('  -', f);
});
