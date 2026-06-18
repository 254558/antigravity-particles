// Capture absolute geometry of footer letters + any "row of logos" + screenshot.
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto('https://antigravity.google', { waitUntil: 'networkidle2', timeout: 60000 });

// Scroll to footer.
await page.evaluate(() => {
  const f = document.querySelector('app-antigravity-footer') || document.querySelector('footer');
  if (f) f.scrollIntoView({ block: 'start' });
});
await new Promise(r => setTimeout(r, 2000));

// 1. Absolute rects of each letter path in the ANTIGRAVITY svg.
const letters = await page.evaluate(() => {
  const paths = Array.from(document.querySelectorAll('app-antigravity-footer svg path'));
  return paths.map((p, i) => {
    const r = p.getBoundingClientRect();
    return {
      i, id: p.getAttribute('id') || `p${i}`,
      x: +r.left.toFixed(1), y: +r.top.toFixed(1),
      w: +r.width.toFixed(1), h: +r.height.toFixed(1),
      cx: +(r.left + r.width / 2).toFixed(1),
      cy: +(r.top + r.height / 2).toFixed(1),
    };
  });
});
console.log('--- ANTIGRAVITY letters (absolute) ---');
console.log('id\tx\tcy(centerY)\tw\th');
for (const L of letters) console.log(`${L.id}\t${L.x}\t${L.cy}\t${L.w}\t${L.h}`);

// 2. Look for any element whose name/id/class suggests a "wave"/"logo row".
const candidates = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('app-antigravity-footer *'));
  return all.map(el => ({
    tag: el.tagName.toLowerCase(),
    id: el.id,
    cls: (el.getAttribute('class') || '').slice(0, 60),
    r: (() => { const r = el.getBoundingClientRect(); return [+r.left.toFixed(0), +r.top.toFixed(0), +r.width.toFixed(0), +r.height.toFixed(0)]; })(),
  })).filter(o => /wave|sin|logo|curve|path|line|svg/i.test(o.tag + o.id + o.cls));
});
console.log('\n--- footer elements matching wave/logo/curve ---');
candidates.forEach(c => console.log(`${c.tag}\t${c.id}\t${c.cls}\t${JSON.stringify(c.r)}`));

// 3. Dump all SVGs in the footer with their viewBox + size.
const svgs = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('app-antigravity-footer svg')).map(s => {
    const r = s.getBoundingClientRect();
    return {
      viewBox: s.getAttribute('viewBox'),
      w: +r.width.toFixed(0), h: +r.height.toFixed(0),
      x: +r.left.toFixed(0), y: +r.top.toFixed(0),
      childCount: s.children.length,
    };
  });
});
console.log('\n--- footer SVGs ---');
svgs.forEach((s, i) => console.log(`svg[${i}]\tviewBox=${s.viewBox}\tsize=${s.w}x${s.h}\tpos=(${s.x},${s.y})\tchildren=${s.childCount}`));

// 4. Screenshot the whole footer.
const footer = await page.$('app-antigravity-footer');
if (footer) await footer.screenshot({ path: '_footer_full.png' });

// Also screenshot a tall strip at the very bottom.
await page.screenshot({ path: '_footer_strip.png', clip: { x: 0, y: 0, width: 1440, height: 900 } });

await browser.close();
console.log('\nsaved _footer_full.png and _footer_strip.png');
