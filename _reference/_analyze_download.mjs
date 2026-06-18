// Scroll to the download section, capture it, and analyze the particle rendering.
import puppeteer from 'puppeteer';
import fs from 'fs';
import { PNG } from 'pngjs';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('https://antigravity.google', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));

// scroll to download section
await page.evaluate(() => window.scrollTo(0, 8198));
await new Promise(r => setTimeout(r, 4000));

// dump all canvas rects
const allCanvases = await page.evaluate(() => {
  return [...document.querySelectorAll('canvas')].map(c => {
    const r = c.getBoundingClientRect();
    return { x: r.x|0, y: r.y|0, w: r.width|0, h: r.height|0 };
  });
});
console.log('all canvases after scroll:', JSON.stringify(allCanvases));

// screenshot the viewport (download section should be visible now)
await page.screenshot({
  path: '/Users/zhangshuai/ZCodeProject/antigravity-particles/_reference/_download_region.png'
});
console.log('saved _download_region.png (full viewport)');

// also grab the WebGL params: try to read uniforms via the scene object if exposed
const glInfo = await page.evaluate(() => {
  const c = [...document.querySelectorAll('canvas')].find(c => { const r = c.getBoundingClientRect(); return r.y > 8100 && r.y < 8300; });
  if (!c) return null;
  // check background color of the card container
  let el = c.parentElement;
  const chain = [];
  for (let i = 0; i < 5 && el; i++) {
    const cs = getComputedStyle(el);
    chain.push({ tag: el.tagName, cls: el.className?.toString?.().slice(0,50), bg: cs.backgroundColor, radius: cs.borderRadius });
    el = el.parentElement;
  }
  return chain;
});
console.log('canvas parent chain:', JSON.stringify(glInfo, null, 2));

await browser.close();
