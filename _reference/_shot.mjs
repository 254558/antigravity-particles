import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--window-size=1440,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('https://antigravity.google/', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 4000));  // 等粒子动画
await page.screenshot({ path: 'official2.png' });

// 分析粒子分布：截取 canvas 像素，找非背景像素的边界框
const data = await page.evaluate(() => {
  const cvs = document.querySelector('canvas');
  if (!cvs) return { err: 'no canvas' };
  const ctx = cvs.getContext('webgl2') || cvs.getContext('webgl');
  const w = cvs.width, h = cvs.height;
  // 读 WebGL 像素
  const px = new Uint8Array(w * h * 4);
  ctx.readPixels(0, 0, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
  let minX=w, minY=h, maxX=0, maxY=0, count=0;
  for (let y=0; y<h; y++) for (let x=0; x<w; x++) {
    const i = (y*w + x)*4;
    // 背景 #121212 = (18,18,18), 粒子更亮
    if (px[i] > 40 || px[i+1] > 40 || px[i+2] > 40) {
      if (x<minX) minX=x; if (x>maxX) maxX=x;
      if (y<minY) minY=y; if (y>maxY) maxY=y;
      count++;
    }
  }
  return { w, h, minX, minY, maxX, maxY, count,
    boxW: maxX-minX, boxH: maxY-minY,
    pctW: (maxX-minX)/w, pctH: (maxY-minY)/h };
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
