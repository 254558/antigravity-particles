// Smoke-test braces_card.html via puppeteer: serve locally, load, hover, screenshot, capture console errors.
import puppeteer from 'puppeteer';
import http from 'http';
import fs from 'fs';
import path from 'path';

const DIR = '/Users/zhangshuai/ZCodeProject/antigravity-particles';
const server = http.createServer((req, res) => {
  const file = path.join(DIR, req.url === '/' ? 'braces_card.html' : req.url);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    const ext = path.extname(file);
    const type = { '.html':'text/html', '.js':'text/javascript', '.png':'image/png' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
});
await new Promise(r => server.listen(8765, r));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 900 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('requestfailed', r => { if (!/gsap|three|googleapis/.test(r.url())) errors.push('REQFAIL: ' + r.url()); });

try {
  await page.goto('http://localhost:8765/', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));   // let particles build + image load

  // hover
  await page.mouse.move(400, 450);
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(DIR, '_reference/_braces_hover.png') });

  // leave
  await page.mouse.move(10, 10);
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(DIR, '_reference/_braces_idle.png') });

  // count rendered particles (non-zero alpha) by sampling the canvas? simpler: check no GL errors via uniforms
  console.log('errors:', errors.length ? errors : 'none');
} catch (e) {
  console.log('ERR', e.message);
}

await browser.close();
server.close();
