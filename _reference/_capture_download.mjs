// Capture the live antigravity.google download card region and analyze its structure.
import puppeteer from 'puppeteer';
import fs from 'fs';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--force-device-scale-factor=1'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('https://antigravity.google', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));

// Find the download section / black rounded card
const info = await page.evaluate(() => {
  const out = [];
  // look for elements containing download text
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n;
  while (n = walker.nextNode()) { if (/Download Google Antigravity/i.test(n.textContent)) nodes.push(n.parentElement); }
  for (const el of nodes) {
    let cur = el;
    // walk up to find a card-like ancestor
    for (let i = 0; i < 8 && cur; i++) {
      const r = cur.getBoundingClientRect();
      const cs = getComputedStyle(cur);
      const bg = cs.backgroundColor;
      const radius = cs.borderRadius;
      out.push({ tag: cur.tagName, cls: cur.className?.toString?.().slice(0,60), rect: {x:r.x|0,y:r.y|0,w:r.width|0,h:r.height|0}, bg, radius, i });
      cur = cur.parentElement;
    }
    break;
  }
  // also find canvas elements
  const canvases = [...document.querySelectorAll('canvas')].map(c => {
    const r = c.getBoundingClientRect();
    return { rect:{x:r.x|0,y:r.y|0,w:r.width|0,h:r.height|0}, w:c.width, h:c.height };
  });
  return { chain: out, canvases };
});
console.log('download text ancestor chain:');
for (const c of info.chain) console.log('  ', JSON.stringify(c));
console.log('canvases:', JSON.stringify(info.canvases, null, 2));

// screenshot the download card area
await page.screenshot({ path: '/Users/zhangshuai/ZCodeProject/antigravity-particles/_reference/_download_live.png', fullPage: false });
console.log('saved _download_live.png');

await browser.close();
