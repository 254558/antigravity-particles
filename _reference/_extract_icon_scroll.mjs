// Confirm the wave is scroll-driven: scroll the page continuously and watch
// ul.translateX + per-li translateY change. Also measure pixel wavelength.
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('https://antigravity.google', { waitUntil: 'networkidle2', timeout: 60000 });

const ul = await page.$('ul.icon-list');
// Get ul's vertical center so we know where to scroll to.
const ulBox = await ul.boundingBox();

const read = async () => page.evaluate(() => {
  const ul = document.querySelector('ul.icon-list');
  const mt = getComputedStyle(ul).transform.match(/matrix.*\(([^)]+)\)/);
  const utx = mt ? +mt[1].split(',')[4] : 0;
  const lis = Array.from(ul.querySelectorAll('li.grid-col')).map(li => {
    const t = getComputedStyle(li).transform.match(/matrix.*\(([^)]+)\)/);
    const ty = t ? +t[1].split(',')[5] : 0;
    const r = li.getBoundingClientRect();
    return { ty, x: +r.left.toFixed(1) };
  });
  return { utx, scrollY: window.scrollY, lis };
});

// Put the icon-list roughly in the middle of the viewport.
await page.evaluate((y) => window.scrollTo(0, y), (ulBox.y || 0) - 300);
await new Promise(r => setTimeout(r, 800));

console.log('phase\tscrollY\tul.tx\tli0.ty\tli0.x\tli7.ty\tli7.x\tli14.ty\tli14.x');
for (let s = 0; s < 25; s++) {
  // smooth scroll a bit each step
  await page.evaluate((d) => window.scrollBy(0, d), 40);
  await new Promise(r => setTimeout(r, 120));
  const d = await read();
  const li0 = d.lis[0], li7 = d.lis[7], li14 = d.lis[14];
  console.log(`${s}\t${Math.round(d.scrollY)}\t${d.utx.toFixed(1)}\t${li0.ty.toFixed(1)}\t${li0.x}\t${li7.ty.toFixed(1)}\t${li7.x}\t${li14.ty.toFixed(1)}\t${li14.x}`);
}

await browser.close();
