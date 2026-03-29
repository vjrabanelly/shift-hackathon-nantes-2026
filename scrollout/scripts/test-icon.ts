import { createCanvas } from 'canvas';
import * as fs from 'fs';

const COLORS = {
  yellow: '#FFE94A',
  green: '#6BE88B',
  blue: '#6B6BFF',
  orange: '#FF7B33',
  magenta: '#E88BE8',
  purple: '#8B44E8',
  red: '#FF2222',
  cyan: '#88CCFF',
  lightGreen: '#88EEBB',
};

const COLOR_SEQUENCE = [
  COLORS.yellow,
  COLORS.green,
  COLORS.blue,
  COLORS.orange,
  COLORS.magenta,
  COLORS.purple,
  COLORS.red,
  COLORS.cyan,
  COLORS.lightGreen,
];

const DARK_BG = '#0a0a0a';
const WHITE = '#ffffff';

const size = 432;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

// White background
ctx.fillStyle = WHITE;
ctx.fillRect(0, 0, size, size);

console.log('[test-icon] Drawing 9 dots...');
// Draw 9 dots in a circle
const dotRadius = size * 0.06;
const dotsRadius = size * 0.36;
for (let i = 0; i < 9; i++) {
  const angle = (i / 9) * Math.PI * 2 - Math.PI / 2;
  const x = size / 2 + dotsRadius * Math.cos(angle);
  const y = size / 2 + dotsRadius * Math.sin(angle);
  const color = COLOR_SEQUENCE[i];
  console.log(`[test-icon] Dot ${i}: color=${color}, x=${x.toFixed(1)}, y=${y.toFixed(1)}, radius=${dotRadius.toFixed(1)}`);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
  ctx.fill();
}

// Draw dark circle background
const circleRadius = size * 0.24;
ctx.fillStyle = DARK_BG;
ctx.beginPath();
ctx.arc(size / 2, size / 2, circleRadius, 0, Math.PI * 2);
ctx.fill();

// Draw "S" text
ctx.fillStyle = WHITE;
ctx.font = `bold ${size * 0.32}px Arial`;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('S', size / 2, size / 2);

const png = canvas.toBuffer('image/png');
const path = require('path');
const outPath = path.join(__dirname, 'test-icon.png');
fs.writeFileSync(outPath, png);
console.log(`[test-icon] Created ${outPath}`);
