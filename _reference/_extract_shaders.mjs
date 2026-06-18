import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--window-size=1440,900']
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

// Hook WebGL shaderSource 来捕获所有 shader
await page.evaluateOnNewDocument(() => {
  window.__shaders = [];

  // Hook WebGLRenderingContext.prototype.shaderSource
  const origShaderSource = WebGLRenderingContext.prototype.shaderSource;
  WebGLRenderingContext.prototype.shaderSource = function(shader, source) {
    window.__shaders.push({
      type: this.getShaderParameter(shader, this.SHADER_TYPE) === this.FRAGMENT_SHADER ? 'frag' : 'vert',
      source: source,
      ts: Date.now()
    });
    return origShaderSource.call(this, shader, source);
  };

  // 也 hook getProgramInfoLog 来关联 program
  window.__programs = [];
  const origLinkProgram = WebGLRenderingContext.prototype.linkProgram;
  WebGLRenderingContext.prototype.linkProgram = function(program) {
    const result = origLinkProgram.call(this, program);
    const shaders = this.getAttachedShaders(program);
    if (shaders) {
      window.__programs.push({
        shaders: Array.from(shaders).map(s => ({
          type: this.getShaderParameter(s, this.SHADER_TYPE),
          source: this.getShaderSource(s)
        }))
      });
    }
    return result;
  };

  // 也 hook WebGL2
  const origShaderSource2 = WebGL2RenderingContext.prototype.shaderSource;
  if (origShaderSource2) {
    WebGL2RenderingContext.prototype.shaderSource = function(shader, source) {
      window.__shaders.push({
        type: this.getShaderParameter(shader, this.SHADER_TYPE) === this.FRAGMENT_SHADER ? 'frag' : 'vert',
        source: source,
        ts: Date.now()
      });
      return origShaderSource2.call(this, shader, source);
    };
  }

  const origLinkProgram2 = WebGL2RenderingContext.prototype.linkProgram;
  if (origLinkProgram2) {
    WebGL2RenderingContext.prototype.linkProgram = function(program) {
      const result = origLinkProgram2.call(this, program);
      const shaders = this.getAttachedShaders(program);
      if (shaders) {
        window.__programs.push({
          shaders: Array.from(shaders).map(s => ({
            type: this.getShaderParameter(s, this.SHADER_TYPE),
            source: this.getShaderSource(s)
          }))
        });
      }
      return result;
    };
  }
});

await page.goto('https://antigravity.google/', {
  waitUntil: 'networkidle2',
  timeout: 30000
});

// 等所有着色器编译完成
await new Promise(r => setTimeout(r, 8000));

const result = await page.evaluate(() => {
  // 去重
  const seen = new Set();
  const unique = window.__programs.filter(p => {
    const key = (p.shaders[0]?.source || '') + (p.shaders[1]?.source || '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    programCount: unique.length,
    shaderCount: window.__shaders.length,
    programs: unique.map((p, i) => ({
      index: i,
      vert: p.shaders[0]?.source || '',
      frag: p.shaders[1]?.source || '',
    }))
  };
});

for (const p of result.programs) {
  console.log(`\n======= Program ${p.index} =======`);
  if (p.vert) {
    console.log(`--- VERTEX SHADER ---`);
    console.log(p.vert);
  }
  if (p.frag) {
    console.log(`--- FRAGMENT SHADER ---`);
    console.log(p.frag);
  }
}

console.log(`\n\n===== SUMMARY =====`);
console.log(`Total programs: ${result.programCount}`);
console.log(`Total shader source calls: ${result.shaderCount}`);

await browser.close();
