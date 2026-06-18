import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new', args: ['--window-size=1440,2000]'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 2000 });
await page.goto('https://antigravity.google/', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 6000));

// 提取 footer 那个大 SVG 的完整内容
const data = await page.evaluate(() => {
  // 找 app-antigravity-footer 内的 svg
  const footerComp = document.querySelector('app-antigravity-footer');
  if (!footerComp) return { error: 'no app-antigravity-footer' };

  const svgs = footerComp.querySelectorAll('svg');
  const result = { svgCount: svgs.length, svgs: [], footerText: '' };

  svgs.forEach((svg, i) => {
    const r = svg.getBoundingClientRect();
    // 取前若干个子元素结构
    const children = Array.from(svg.children).map(c => ({
      tag: c.tagName,
      attrs: Array.from(c.attributes).reduce((o,a)=>{o[a.name]=a.value; return o},{}),
      childCount: c.children.length,
    }));
    result.svgs.push({
      i,
      viewBox: svg.getAttribute('viewBox'),
      width: svg.getAttribute('width'),
      height: svg.getAttribute('height'),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      childCount: svg.children.length,
      children: children.slice(0, 10),
      outerHTML: svg.outerHTML.substring(0, 8000)
    });
  });

  result.footerText = footerComp.textContent?.substring(0, 500);

  // 也看看 footer 的 class 和 inline style
  const wrapper = footerComp.querySelector('#antigravity-footer-wrapper, [class*="footer"]');
  result.wrapperClass = wrapper?.className?.toString();
  result.wrapperStyle = wrapper?.getAttribute('style');

  return result;
});

console.log('=== SVG 数量:', data.svgCount, '===');
for (const s of data.svgs) {
  console.log(`\n======= SVG ${s.i} =======`);
  console.log('viewBox:', s.viewBox, 'size:', s.width+'x'+s.height, 'rect:', JSON.stringify(s.rect));
  console.log('childCount:', s.childCount);
  console.log('children:', JSON.stringify(s.children, null, 2));
  console.log('--- outerHTML (前 8000 字符) ---');
  console.log(s.outerHTML);
}
console.log('\n=== footer text ===');
console.log(data.footerText);
console.log('wrapperClass:', data.wrapperClass);
console.log('wrapperStyle:', data.wrapperStyle);

await browser.close();
