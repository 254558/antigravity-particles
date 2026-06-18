import puppeteer from 'puppeteer';
import fs from 'fs';
const browser = await puppeteer.launch({ headless: 'new', args: ['--window-size=1440,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('https://antigravity.google/', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 5000));

// 保存完整页面截图
await page.screenshot({ path: 'official_full.png' });

// 分析：取中心区域像素，看粒子长什么样
const data = await page.evaluate(() => {
  const cvs = document.querySelector('canvas');
  if (!cvs) return { err: 'no canvas', tag: document.body.innerHTML.slice(0,500) };
  const ctx = cvs.getContext('webgl2') || cvs.getContext('webgl');
  const w = cvs.width, h = cvs.height;
  const px = new Uint8Array(w * h * 4);
  ctx.readPixels(0, 0, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
  // 找最亮的像素（粒子）
  let brightCount = 0;
  let samples = [];
  let minX=w,minY=h,maxX=0,maxY=0;
  for (let y=0; y<h; y++) for (let x=0; x<w; x++) {
    const i=(y*w+x)*4;
    const r=px[i],g=px[i+1],b=px[i+2];
    const lum = 0.299*r+0.587*g+0.114*b;
    if (lum > 80) {  // 明显亮于背景18
      brightCount++;
      if (x<minX)minX=x; if(x>maxX)maxX=x;
      if(y<minY)minY=y; if(y>maxY)maxY=y;
      if (samples.length < 8) samples.push([x,y,r,g,b,lum]);
    }
  }
  return { w, h, brightCount, minX, minY, maxX, maxY,
    boxW: maxX-minX, boxH: maxY-minY, samples, bg: [px[0],px[1],px[2]] };
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
