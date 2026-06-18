// Sample the icon-list wave over time: <ul> translateX + each <li> translateY.
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('https://antigravity.google', { waitUntil: 'networkidle2', timeout: 60000 });

// Scroll the icon-list into view (it's in the footer area, "Antigravity in action" / features).
await page.evaluate(() => {
  const ul = document.querySelector('ul.icon-list');
  if (ul) ul.scrollIntoView({ block: 'center' });
});
await new Promise(r => setTimeout(r, 2000));

const result = await page.evaluate(async () => {
  const ul = document.querySelector('ul.icon-list');
  if (!ul) return { error: 'no icon-list' };

  // Read computed transform translate values.
  const readUL = () => {
    const t = getComputedStyle(ul).transform; // matrix(a,b,c,d,e,f) -> e=tx, f=ty
    const m = t.match(/matrix.*\(([^)]+)\)/);
    if (!m) return { tx: 0, ty: 0 };
    const v = m[1].split(',').map(Number);
    return { tx: v[4] || 0, ty: v[5] || 0 };
  };
  const readLIs = () => Array.from(ul.querySelectorAll('li.grid-col')).map(li => {
    const t = getComputedStyle(li).transform;
    const m = t.match(/matrix.*\(([^)]+)\)/);
    if (!m) return 0;
    const v = m[1].split(',').map(Number);
    return v[5] || 0; // translateY
  });

  const frames = [];
  const start = performance.now();
  for (let i = 0; i < 60; i++) {
    const t = performance.now() - start;
    frames.push({ t, ul: readUL(), li: readLIs() });
    await new Promise(r => setTimeout(r, 100));
  }

  // Also grab the symbol names + li widths for layout.
  const meta = Array.from(ul.querySelectorAll('li.grid-col')).map(li => {
    const sym = li.querySelector('.symbol');
    const r = li.getBoundingClientRect();
    return { name: sym ? sym.textContent.trim() : '', w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
  });

  // Check how many <li> exist (to see if list is duplicated for marquee).
  return {
    liCount: ul.querySelectorAll('li.grid-col').length,
    meta,
    ulWidth: ul.getBoundingClientRect().width,
    frames,
  };
});

await browser.close();

if (result.error) { console.log(result.error); process.exit(1); }

console.log(`li count: ${result.liCount}, ul width: ${result.ulWidth}`);
console.log(`\n--- icons (name, w x h) ---`);
result.meta.forEach((m, i) => console.log(`${i}\t${m.name}\t${m.w}x${m.h}`));

// Print frame 0 + a few later frames to see UL travel + per-li wave.
console.log(`\n--- frames (t, ul.tx, li[0..n].ty) ---`);
const f0 = result.frames[0];
const names = result.meta.map(m => m.name.slice(0, 8).padEnd(8)).join('\t');
console.log(`t\tul.tx\t${names}`);
for (const f of result.frames) {
  const lis = f.li.map(v => v.toFixed(1).padStart(6)).join('\t');
  console.log(`${Math.round(f.t)}\t${f.ul.tx.toFixed(2)}\t${lis}`);
}
