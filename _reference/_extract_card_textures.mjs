// Locate the canvases, their on-screen positions/labels, and probe for individual.png.
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const responses = [];
page.on('response', (res) => {
  const u = res.url();
  if (/\.(png|webp|jpg|jpeg|ktx2|ktx)(\?|$)/i.test(u)) responses.push({ u, status: res.status(), type: res.headers()['content-type'] || '' });
});

await page.goto('https://antigravity.google', { waitUntil: 'networkidle2', timeout: 60000 });

// Scroll through whole page to load lazy canvases/textures.
for (let y = 0; y <= 9000; y += 800) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await new Promise(r => setTimeout(r, 700));
}
await page.evaluate(() => window.scrollTo(0, 0));
await new Promise(r => setTimeout(r, 500));

// Canvas info + nearby text label.
const canvases = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('canvas')).map((c, i) => {
    const r = c.getBoundingClientRect();
    // Walk up to find a section with a heading near this canvas.
    let sec = c, label = '';
    for (let k = 0; k < 10 && sec; k++, sec = sec.parentElement) {
      const h = sec.querySelector && sec.querySelector('h1,h2,h3,h4');
      if (h && h.textContent.trim()) { label = h.textContent.trim().slice(0, 80); break; }
    }
    return {
      i, w: +r.width.toFixed(0), h: +r.height.toFixed(0),
      x: +r.left.toFixed(0), y: +r.top.toFixed(0),
      label,
      parentClass: c.parentElement ? c.parentElement.className : '',
    };
  });
});
console.log('=== canvases ===');
canvases.forEach(c => console.log(`#${c.i}  ${c.w}x${c.h}  pos=(${c.x},${c.y})  parent="${c.parentClass}"  label="${c.label}"`));

// Hook WebGL to capture texture image URLs that get texImage2D'd.
const texUrls = await page.evaluate(() => {
  const urls = [];
  const orig = WebGLRenderingContext.prototype.texImage2D;
  WebGLRenderingContext.prototype.texImage2D = function(...a) {
    try {
      const src = a[5];
      if (src && (src.src || (src.tagName === 'IMG'))) urls.push(src.src || '(canvas/img)');
    } catch(e){}
    return orig.apply(this, a);
  };
  // Also WebGL2
  if (window.WebGL2RenderingContext) {
    const o2 = WebGL2RenderingContext.prototype.texImage2D;
    WebGL2RenderingContext.prototype.texImage2D = function(...a) {
      try { const s = a[5]; if (s && s.src) urls.push(s.src); } catch(e){}
      return o2.apply(this, a);
    };
  }
  return urls;
});
// give it time
await new Promise(r => setTimeout(r, 2000));

console.log('\n=== image texture responses (network) ===');
const uniq = [...new Set(responses.map(r => r.u))];
uniq.forEach(u => console.log(u));

// Probe common paths for individual.png.
console.log('\n=== probe individual.png ===');
for (const p of [
  'assets/image/individual.png',
  'assets/image/landing/individual.png',
  'assets/image/braces/individual.png',
  'assets/image/landing/braces.png',
  'assets/images/individual.png',
  'assets/image/individual/individual.png',
]) {
  const url = 'https://antigravity.google/' + p;
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
    console.log(res.status(), p);
  } catch(e) {
    console.log('ERR', p, e.message.slice(0,60));
  }
}

await browser.close();
