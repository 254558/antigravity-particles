// Capture the morphing-card RENDER shader + JS morph logic + hover behavior.
import puppeteer from 'puppeteer';
import fs from 'fs';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

// 1) Capture all shader sources, grouped, with a tag.
const shaders = [];
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
  const t = setInterval(() => {
    if (window.WebGLRenderingContext) { wrap(WebGLRenderingContext.prototype); }
    if (window.WebGL2RenderingContext) { wrap(WebGL2RenderingContext.prototype); clearInterval(t); }
  }, 5);
});

// 2) Capture loaded script URLs.
const scripts = [];
page.on('response', (res) => {
  const u = res.url();
  if (/\.js(\?|$)/.test(u) && res.status() === 200) scripts.push(u);
});

await page.goto('https://antigravity.google', { waitUntil: 'networkidle2', timeout: 60000 });
await page.evaluate(() => window.scrollTo(0, 6200));
await new Promise(r => setTimeout(r, 2500));

const all = await page.evaluate(() => window.__shaders);
// Dedupe by source.
const uniq = [];
const seen = new Set();
for (const s of all) { if (!seen.has(s.src)) { seen.add(s.src); uniq.push(s); } }
console.log(`=== ${uniq.length} unique shaders ===`);
uniq.forEach((s, i) => console.log(`#${i} ${s.type} ${s.src.length}ch  head: ${s.src.replace(/\s+/g,' ').slice(0,80)}`));

// The SIM shader we already have. Find the RENDER shader: it's the one mentioning gl_PointSize / vLocalPos / sdRoundBox / uColorScheme.
const renderIdx = uniq.findIndex(s => /gl_PointSize|vLocalPos|sdRoundBox|uColorScheme|vScale/.test(s.src));
console.log(`\nRENDER shader index: ${renderIdx}`);
if (renderIdx >= 0) {
  // Save it.
  fs.writeFileSync('/Users/zhangshuai/ZCodeProject/antigravity-particles/_reference/_morph_render.txt', uniq[renderIdx].src);
  console.log('saved _morph_render.txt');
  // Print the tail (main + the interesting part).
  const src = uniq[renderIdx].src;
  const mainIdx = src.lastIndexOf('void main');
  console.log('--- RENDER main ---');
  console.log(src.slice(mainIdx));
}

// 3) Grep JS bundles for morph / individual / uPosRefs / target logic.
console.log(`\n=== ${scripts.length} scripts ===`);
// Fetch each script text and grep. Keep it cheap: only fetch the ones likely to contain app code (not vendor).
const candidates = scripts.filter(u => !/googleapis|gstatic|fonts|analytics|gtm|googletag|glue/.test(u));
console.log('app scripts:', candidates.length);
for (const u of candidates) {
  try {
    const txt = await (await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 15000 })).text();
    const hits = [];
    for (const re of [/individual/i, /uPosRefs/, /morphTexture|morphTarget|morph\b/i, /uRingDisplacement/, /bouncer|icon-list/]) {
      const m = txt.match(re);
      if (m) hits.push(m[0]);
    }
    if (hits.length) console.log(`${u.split('/').pop()}  (${txt.length}ch)  hits: ${[...new Set(hits)].join(', ')}`);
  } catch(e) {}
}

await browser.close();
