import fs from 'fs';
import { PNG } from 'pngjs';

const png = PNG.sync.read(fs.readFileSync('/Users/zhangshuai/ZCodeProject/antigravity-particles/_reference/_index_blue.png'));
const { width: W, height: H, data } = png;
const colors = {};
for (let i = 0; i < data.length; i += 16) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  if (r + g + b < 60) continue;
  const key = (r >> 4) + '_' + (g >> 4) + '_' + (b >> 4);
  colors[key] = (colors[key] || 0) + 1;
}
const sorted = Object.entries(colors).sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log('top bright colors (r4_g4_b4 : count):');
sorted.forEach(([k, c]) => console.log('  ' + k + ' : ' + c));
