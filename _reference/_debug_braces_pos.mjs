// Debug: read back the SIM position texture after N frames to see actual particle positions.
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
    res.writeHead(200, { 'Content-Type': type }); res.end(data);
  });
});
await new Promise(r => server.listen(8766, r));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 900 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://localhost:8766/', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 4000));

// Read back via page.evaluate: access the module's THREE objects through a global hook.
// We didn't expose globals. Instead, read pixels from the WebGL canvas directly by re-rendering with a debug.
// Simpler: instrument by evaluating the SIM position texture through the renderer.
const stats = await page.evaluate(async () => {
  // The module scoped vars aren't on window. We'll read the rendered canvas pixel distribution instead.
  const c = document.querySelector('canvas.particles');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  // Read the whole framebuffer
  const w = c.width, h = c.height;
  const buf = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  // Find bbox of non-background pixels (background is card #0e0f13 ~ (14,15,19))
  let minX=w,minY=h,maxX=0,maxY=0,n=0, sx=0, sy=0;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++){
    const i=(y*w+x)*4;
    const r=buf[i],g=buf[i+1],b=buf[i+2];
    // particle if notably brighter or different hue than bg
    if (r>30 || g>30 || b>30) {
      n++; sx+=x; sy+=y;
      if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y;
    }
  }
  return { w, h, count: n, bbox:[minX,minY,maxX,maxY], centroid:[sx/(n||1), sy/(n||1)] };
});
console.log('canvas render stats:', JSON.stringify(stats));
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');

await browser.close();
server.close();
