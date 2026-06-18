import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--window-size=1440,900','--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

// Hook 原生 WebGL: 记录所有 drawArrays/drawElements 的 count 和 uniform
await page.evaluateOnNewDocument(() => {
  window.__draws = [];
  window.__uniforms = {};
  const proto = WebGL2RenderingContext.prototype;
  const oDA = proto.drawArrays;
  const oDE = proto.drawElements;
  proto.drawArrays = function(mode, first, count) {
    if (count > 100 && window.__draws.length < 20) {
      window.__draws.push({ mode, first, count });
    }
    return oDA.call(this, mode, first, count);
  };
  proto.drawElements = function(mode, count, type, offset) {
    if (count > 100 && window.__draws.length < 20) {
      window.__draws.push({ mode, count, type, offset, elements: true });
    }
    return oDE.call(this, mode, count, type, offset);
  };
});

await page.goto('https://antigravity.google/', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 4000));
const data = await page.evaluate(() => ({
  draws: window.__draws,
  // 不同 count 值代表不同绘制：sim 是 256*256=65536 顶点(plane 6), render 是粒子数
  uniqueCounts: [...new Set(window.__draws.map(d => d.count))].sort((a,b)=>a-b)
}));
console.log('draw calls (count字段=顶点/索引数):');
console.log(JSON.stringify(data, null, 2));

// 再注入：读 canvas 尺寸和实际渲染分辨率
const dim = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return c ? { cw: c.width, ch: c.height, style: getComputedStyle(c) } : 'no canvas';
});
console.log('canvas:', JSON.stringify(dim));
await browser.close();
