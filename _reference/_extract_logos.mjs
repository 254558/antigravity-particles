import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new', args: ['--window-size=1440,2000'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 2000 });
await page.goto('https://antigravity.google/', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 6000));

// 1) 截整页图
await page.screenshot({ path: 'full_page.png', fullPage: true });

// 2) 找底部 logo 相关元素：img、svg、带 logo class 的元素
const data = await page.evaluate(() => {
  const result = { imgs: [], svgs: [], logos: [], footerHTML: '' };

  // 所有 img
  document.querySelectorAll('img').forEach((el, i) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      result.imgs.push({
        i, src: el.src?.substring(0, 120), alt: el.alt,
        x: Math.round(r.x), y: Math.round(r.y),
        w: Math.round(r.width), h: Math.round(r.height),
        class: el.className?.toString().substring(0, 80),
        parentClass: el.parentElement?.className?.toString().substring(0, 80)
      });
    }
  });

  // 所有 svg
  document.querySelectorAll('svg').forEach((el, i) => {
    const r = el.getBoundingClientRect();
    if (r.width > 10 && r.height > 10 && r.y > 500) {
      result.svgs.push({
        i, x: Math.round(r.x), y: Math.round(r.y),
        w: Math.round(r.width), h: Math.round(r.height),
        class: el.className?.toString().substring(0, 80),
        viewBox: el.getAttribute('viewBox'),
        parentClass: el.parentElement?.className?.toString().substring(0, 80)
      });
    }
  });

  // 找带 logo 的元素
  document.querySelectorAll('[class*="logo" i], [class*="icon" i], [class*="brand" i]').forEach((el, i) => {
    const r = el.getBoundingClientRect();
    result.logos.push({
      i, tag: el.tagName,
      x: Math.round(r.x), y: Math.round(r.y),
      w: Math.round(r.width), h: Math.round(r.height),
      class: el.className?.toString().substring(0, 100)
    });
  });

  // footer / 底部区域的 HTML
  const footer = document.querySelector('footer') || document.querySelector('[class*="footer" i]');
  if (footer) result.footerHTML = footer.outerHTML.substring(0, 2000);

  // 页面总高度
  result.pageHeight = document.documentElement.scrollHeight;
  return result;
});

console.log('=== 页面总高度:', data.pageHeight, '===');
console.log('\n=== IMG 列表 ===');
console.log(JSON.stringify(data.imgs, null, 2));
console.log('\n=== SVG 列表（y>500）===');
console.log(JSON.stringify(data.svgs, null, 2));
console.log('\n=== LOGO/ICON 元素 ===');
console.log(JSON.stringify(data.logos, null, 2));
console.log('\n=== FOOTER HTML ===');
console.log(data.footerHTML);

await browser.close();
