// Dump shader #4 (small frag) + grep the JS bundle around individual/uPosRefs/morph.
import puppeteer from 'puppeteer';
import fs from 'fs';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const shaders = [];
await page.evaluateOnNewDocument(() => {
  window.__shaders = [];
  const wrap = (proto) => {
    const orig = proto.shaderSource;
    proto.shaderSource = function(shader, src) {
      try { const t = this.getShaderParameter(shader, this.SHADER_TYPE);
        window.__shaders.push({ type: t === this.VERTEX_SHADER ? 'vert' : 'frag', src }); } catch(e){}
      return orig.call(this, shader, src);
    };
  };
  const t = setInterval(() => {
    if (window.WebGLRenderingContext) wrap(WebGLRenderingContext.prototype);
    if (window.WebGL2RenderingContext) { wrap(WebGL2RenderingContext.prototype); clearInterval(t); }
  }, 5);
});

await page.goto('https://antigravity.google', { waitUntil: 'networkidle2', timeout: 60000 });
await page.evaluate(() => window.scrollTo(0, 6200));
await new Promise(r => setTimeout(r, 2500));
const all = await page.evaluate(() => window.__shaders);
const uniq = []; const seen = new Set();
for (const s of all) if (!seen.has(s.src)) { seen.add(s.src); uniq.push(s); }

// Save all unique shaders to files for inspection.
uniq.forEach((s, i) => {
  fs.writeFileSync(`/Users/zhangshuai/ZCodeProject/antigravity-particles/_reference/_shader_${i}_${s.type}.glsl`, s.src);
});
console.log(`saved ${uniq.length} shaders`);

// Print shader #4 (the small frag) fully.
console.log('\n========== SHADER #4 (frag, 4913ch) ==========');
console.log(uniq[4].src);

// Fetch main bundle and grep with context.
const bundleUrl = 'https://antigravity.google/main-M3OAQNLT.js';
const res = await page.goto(bundleUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
const txt = await res.text();
fs.writeFileSync('/Users/zhangshuai/ZCodeProject/antigravity-particles/_reference/main-LIVE.js', txt);
console.log(`\nbundle: ${txt.length}ch`);

// Find context around 'individual'.
console.log('\n=== context: individual ===');
let idx = 0;
for (let k = 0; k < 6; k++) {
  idx = txt.indexOf('individual', idx);
  if (idx < 0) break;
  console.log(`\n[off ${idx}] ...${txt.slice(Math.max(0,idx-120), idx+160)}...`);
  idx += 10;
}

// context around uPosRefs
console.log('\n=== context: uPosRefs ===');
idx = 0;
for (let k = 0; k < 4; k++) {
  idx = txt.indexOf('uPosRefs', idx);
  if (idx < 0) break;
  console.log(`\n[off ${idx}] ...${txt.slice(Math.max(0,idx-150), idx+200)}...`);
  idx += 8;
}

// context around morph / Target
console.log('\n=== context: morphTarget ===');
idx = txt.indexOf('morphTarget');
if (idx >= 0) console.log(`\n[off ${idx}] ...${txt.slice(Math.max(0,idx-200), idx+300)}...`);

// context around "scatter" / "hover" near particle setup
console.log('\n=== context: hover (first 3) ===');
idx = 0;
for (let k = 0; k < 3; k++) {
  idx = txt.indexOf('hover', idx);
  if (idx < 0) break;
  console.log(`\n[off ${idx}] ...${txt.slice(Math.max(0,idx-80), idx+120)}...`);
  idx += 5;
}

await browser.close();
