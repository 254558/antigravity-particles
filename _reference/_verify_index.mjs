import puppeteer from 'puppeteer';
import http from 'http';
import fs from 'fs';
import path from 'path';

const DIR = '/Users/zhangshuai/ZCodeProject/antigravity-particles';
const server = http.createServer((req, res) => {
  const f = path.join(DIR, req.url === '/' ? 'index.html' : req.url);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end('404'); return; } res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(d); });
});
await new Promise(r => server.listen(8786, r));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--force-device-scale-factor=2'] });
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 800, deviceScaleFactor: 2 });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('PAGEERR:' + e.message));
await page.goto('http://localhost:8786/', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 4000));
await page.screenshot({ path: path.join(DIR, '_reference/_index_blue.png') });
console.log('errors:', errs.length ? errs : 'none');
console.log('logs:', await page.evaluate(() => 'ok'));
await browser.close();
server.close();
