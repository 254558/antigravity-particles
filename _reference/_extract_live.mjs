import puppeteer from 'puppeteer';
import fs from 'fs';

const browser = await puppeteer.launch({ headless: 'new', args: ['--window-size=1440,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('https://antigravity.google/', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 6000));

// 等待更久以确保所有动画/着色器已初始化
await new Promise(r => setTimeout(r, 3000));

const result = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { error: 'no canvas' };
  
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) return { error: 'no webgl context' };
  
  const ext = gl.getExtension('WEBGL_debug_shaders');
  if (!ext) return { error: 'no WEBGL_debug_shaders extension' };
  
  // 获取所有 shader 对象
  const programs = [];
  const programCount = gl.getParameter(gl.MAX_PROGRAMS);
  
  // 遍历所有 program
  for (let i = 0; i < 100; i++) {
    try {
      // 用间接方式：枚举所有可能的 program
      const prog = gl.getParameter(gl.CURRENT_PROGRAM);
      if (prog) {
        const vs = gl.getAttachedShaders(prog);
        if (vs) {
          const vsSrc = gl.getShaderSource(vs[0]);
          const fsSrc = gl.getShaderSource(vs[1]);
          programs.push({
            vs: vsSrc?.substring(0, 3000),
            fs: fsSrc?.substring(0, 3000),
          });
        }
        break;
      }
    } catch(e) {}
  }
  
  return { programs };
});

console.log('=== RESULT ===');
console.log(JSON.stringify(result, null, 2));
await browser.close();
