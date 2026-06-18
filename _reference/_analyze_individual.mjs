// Analyze individual.png by LUMINANCE (shape is in brightness, not alpha).
import fs from 'fs';
import { PNG } from 'pngjs';

const buf = fs.readFileSync('/Users/zhangshuai/ZCodeProject/antigravity-particles/_reference/individual.png');
const png = PNG.sync.read(buf);
const { width: W, height: H, data } = png;

const lum = (i) => 0.2126*data[i] + 0.7152*data[i+1] + 0.0722*data[i+2];

// Build luminance histogram + bbox of "bright" pixels.
const hist = new Array(16).fill(0);
let minX=W, minY=H, maxX=0, maxY=0, bright=0, dark=0, sum=0;
for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
  const i = (y*W+x)*4;
  const l = lum(i);
  sum += l;
  hist[Math.min(15, Math.floor(l/16))]++;
  if (l > 40) { bright++; if (x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; }
  else dark++;
}
console.log(`=== individual.png ${W}x${H} by LUMINANCE ===`);
console.log(`mean luminance: ${(sum/(W*H)).toFixed(1)}`);
console.log(`bright(>40): ${bright} (${(100*bright/(W*H)).toFixed(1)}%)  dark: ${dark}`);
console.log(`bright bbox: x[${minX},${maxX}] y[${minY},${maxY}] (w=${maxX-minX+1}, h=${maxY-minY+1})`);
console.log(`histogram (0-15 buckets of 16): ${hist.join(' ')}`);

// Render ASCII art of luminance (downsample to ~90x90).
const cellW = 90, cellH = 90;
let ascii = '';
for (let cy=0; cy<cellH; cy++) {
  for (let cx=0; cx<cellW; cx++) {
    let s=0, n=0;
    const x0 = Math.floor(cx*W/cellW), x1=Math.floor((cx+1)*W/cellW);
    const y0 = Math.floor(cy*H/cellH), y1=Math.floor((cy+1)*H/cellH);
    for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++){ s += lum((y*W+x)*4); n++; }
    const avg = s/n;
    ascii += avg > 200 ? '@' : avg > 120 ? '#' : avg > 60 ? '+' : avg > 25 ? '.' : ' ';
  }
  ascii += '\n';
}
console.log('\n=== luminance ASCII (90x90) ===');
console.log(ascii);
