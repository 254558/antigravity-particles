import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--window-size=1440,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('https://antigravity.google/', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 5000));

const data = await page.evaluate(() => {
  const cvs = document.querySelector('canvas');
  if (!cvs) return { err: 'no canvas' };
  const ctx = cvs.getContext('webgl2') || cvs.getContext('webgl');
  const w = cvs.width, h = cvs.height;
  const px = new Uint8Array(w * h * 4);
  ctx.readPixels(0, 0, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
  // 背景约 #121212=(18,18,18)。粒子有颜色(蓝/绿/红)，检测 max-min > 30 或亮度>60
  let minX=w, minY=h, maxX=0, maxY=0, count=0;
  let sumX=0, sumY=0;
  const cols = [0,0,0]; // 统计主色
  for (let y=0; y<h; y+=2) for (let x=0; x<w; x+=2) {
    const i = (y*w + x)*4;
    const r=px[i], g=px[i+1], b=px[i+2];
    const maxc=Math.max(r,g,b), minc=Math.min(r,g,b);
    const bright = (r+g+b)/3;
    // 粒子: 彩色(差值大)或明显亮于背景
    if (maxc-minc > 25 || bright > 55) {
      if (x<minX) minX=x; if (x>maxX) maxX=x;
      if (y<minY) minY=y; if (y>maxY) maxY=y;
      sumX+=x; sumY+=y; count++;
      if (r>g&&r>b) cols[0]++;
      else if (g>=r&&g>b) cols[1]++;
      else cols[2]++;
    }
  }
  return { w, h, minX, minY, maxX, maxY, count,
    boxW: maxX-minX, boxH: maxY-minY,
    pctW: (maxX-minX)/w, pctH: (maxY-minY)/h,
    cx: sumX/count, cy: sumY/count, cols };
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
