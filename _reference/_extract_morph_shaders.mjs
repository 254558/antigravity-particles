// Analyze individual.png shape + hook the morphing canvas WebGL shaders.
import puppeteer from 'puppeteer';
import fs from 'fs';
import { PNG } from 'pngjs';

// ---- 1. Analyze the PNG ----
const buf = fs.readFileSync('/Users/zhangshuai/ZCodeProject/antigravity-particles/_reference/individual.png');
const png = PNG.sync.read(buf);
const { width: W, height: H, data } = png;
let minX = W, minY = H, maxX = 0, maxY = 0, count = 0;
const colDensity = new Array(64).fill(0);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const idx = (y * W + x) * 4;
    const a = data[idx + 3];
    if (a > 32) {
      count++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      colDensity[Math.floor(x / (W / 64))]++;
    }
  }
}
console.log(`=== individual.png ${W}x${H} ===`);
console.log(`opaque pixels: ${count} (${(100 * count / (W*H)).toFixed(1)}%)`);
console.log(`bbox: x[${minX},${maxX}] y[${minY},${maxY}]  (w=${maxX-minX+1}, h=${maxY-minY+1})`);
console.log(`column density (64 buckets, #opaque per bucket):`);
console.log(colDensity.map((v,i) => `${i}:${v}`).join('  '));

// Sample alpha along the middle row to see the { } profile.
const midY = Math.floor((minY+maxY)/2);
let profile = '';
for (let x = minX; x <= maxX; x += Math.max(1, Math.floor((maxX-minX)/80))) {
  const a = data[(midY * W + x) * 4 + 3];
  profile += a > 32 ? '#' : '.';
}
console.log(`\nalpha profile at y=${midY} (left→right):`);
console.log(profile);

// ---- 2. Hook morphing canvas WebGL ----
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

// Inject a shaderSource hook BEFORE page scripts run.
await page.evaluateOnNewDocument(() => {
  window.__shaders = [];
  const wrap = (proto) => {
    const orig = proto.shaderSource;
    proto.shaderSource = function(shader, src) {
      try {
        const type = this.getShaderParameter(shader, this.SHADER_TYPE);
        window.__shaders.push({ type: type === this.VERTEX_SHADER ? 'vert' : 'frag', src });
      } catch(e){}
      return orig.call(this, shader, src);
    };
  };
  // Defer wrap until WebGLRenderingContext exists.
  const t = setInterval(() => {
    if (window.WebGLRenderingContext) { wrap(WebGLRenderingContext.prototype); clearInterval(t); }
    if (window.WebGL2RenderingContext) { wrap(WebGL2RenderingContext.prototype); }
  }, 5);
});

await page.goto('https://antigravity.google', { waitUntil: 'networkidle2', timeout: 60000 });

// Scroll to the morphing cards (y~6496) to init them.
await page.evaluate(() => window.scrollTo(0, 6200));
await new Promise(r => setTimeout(r, 2500));
// hover the first morphing card
const cards = await page.$$('.morphing-particles-container');
if (cards[0]) await cards[0].hover();
await new Promise(r => setTimeout(r, 1500));

const shaders = await page.evaluate(() => window.__shaders);
console.log(`\n=== captured ${shaders.length} shaders ===`);
// The first 2 are the main background (already known). The morph ones come after.
// Print unique shader sources (dedupe).
const seen = new Set();
let morphIdx = 0;
for (const s of shaders) {
  const key = s.src.slice(0, 120);
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(`\n--- shader #${morphIdx} (${s.type}, ${s.src.length} chars) ---`);
  console.log(s.src);
  morphIdx++;
}

// Also dump uniform/attribute names if we can find a program.
const uniforms = await page.evaluate(() => {
  // can't easily introspect without keeping gl ref; skip
  return null;
});

await browser.close();
