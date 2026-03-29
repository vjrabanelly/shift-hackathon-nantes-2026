import { createCanvas } from 'canvas';
import * as fs from 'fs';

const canvas = createCanvas(432, 432);
const ctx = canvas.getContext('2d');

ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, 432, 432);

// Draw a red dot at top
ctx.fillStyle = '#FF0000';
ctx.beginPath();
ctx.arc(216, 100, 20, 0, Math.PI * 2);
ctx.fill();

// Draw a green dot on the left
ctx.fillStyle = '#00FF00';
ctx.beginPath();
ctx.arc(100, 216, 20, 0, Math.PI * 2);
ctx.fill();

// Draw a blue dot on the right
ctx.fillStyle = '#0000FF';
ctx.beginPath();
ctx.arc(332, 216, 20, 0, Math.PI * 2);
ctx.fill();

// Draw yellow dot at bottom
ctx.fillStyle = '#FFFF00';
ctx.beginPath();
ctx.arc(216, 332, 20, 0, Math.PI * 2);
ctx.fill();

const png = canvas.toBuffer('image/png');
const path = require('path');
const outPath = path.join(__dirname, 'test-canvas.png');
fs.writeFileSync(outPath, png);
console.log('Test canvas created at ' + outPath);
