// Find the "For developers / Achieve new heights" card, its particle canvas,
// the individual.png image, and how particles are arranged into { }.
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('https://antigravity.google', { waitUntil: 'networkidle2', timeout: 60000 });

// Capture all network requests for images ending in .png / .webp to find individual.png
const imgs = [];
page.on('response', async (res) => {
  const u = res.url();
  if (/individual|brace|curly|\.png/i.test(u)) imgs.push({ u, status: res.status() });
});

// Scroll around to trigger lazy loading of card assets.
for (const y of [0, 1200, 2400, 3600, 4800, 6000, 7200, 8400]) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await new Promise(r => setTimeout(r, 600));
}

// Find the card by text.
const cardInfo = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('*'));
  const hit = all.find(el => /Achieve new heights/i.test(el.textContent) && el.children.length < 8);
  if (!hit) return { found: false };
  // climb to the nearest card-like container
  let card = hit;
  for (let i = 0; i < 8 && card.parentElement; i++) {
    card = card.parentElement;
    const r = card.getBoundingClientRect();
    if (r.width > 200 && r.width < 800 && r.height > 200) break;
  }
  const r = card.getBoundingClientRect();
  return {
    found: true,
    tag: card.tagName.toLowerCase(),
    cls: card.className,
    rect: [+r.left.toFixed(0), +r.top.toFixed(0), +r.width.toFixed(0), +r.height.toFixed(0)],
    html: card.outerHTML.slice(0, 2000),
  };
});

console.log('=== card ===');
console.log(JSON.stringify(cardInfo, null, 2));

// Find any <img> / canvas inside the card region; also any element with background-image.
const assets = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('img').forEach(im => {
    out.push({ tag: 'img', src: im.src, w: im.width, h: im.height, alt: im.alt });
  });
  document.querySelectorAll('[style*="background-image"]').forEach(el => {
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') out.push({ tag: el.tagName.toLowerCase(), cls: el.className, bg: bg.slice(0,200) });
  });
  document.querySelectorAll('canvas').forEach(c => {
    const r = c.getBoundingClientRect();
    out.push({ tag: 'canvas', w: r.width, h: r.height, cls: c.className });
  });
  return out;
});

console.log('\n=== images / canvases on page ===');
assets.forEach(a => console.log(JSON.stringify(a)));

// Specifically grep for individual.png in the whole HTML + accessible JS.
const html = await page.content();
const m = html.match(/[^"'\s]*individual[^"'\s]*/gi);
console.log('\n=== references to "individual" ===');
console.log(m ? [...new Set(m)].slice(0, 20) : 'none in HTML');

await browser.close();
console.log('\n=== individual/brace responses ===');
imgs.forEach(i => console.log(i.status, i.u));
