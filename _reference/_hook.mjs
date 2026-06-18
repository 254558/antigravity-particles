import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--window-size=1440,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

// 注入：拦截 THREE.WebGLRenderer.prototype.render，抓取 scene/camera
await page.evaluateOnNewDocument(() => {
  window.__captured = false;
  const origRender = THREE_module => {};
  // 等 THREE 加载后 hook
  const tryHook = () => {
    if (window.THREE && !window.__hooked) {
      window.__hooked = true;
      const orig = THREE.WebGLRenderer.prototype.render;
      THREE.WebGLRenderer.prototype.render = function(scene, camera) {
        if (!window.__captured && scene && scene.children) {
          window.__captured = true;
          // 找 Points
          let points = null;
          scene.traverse(o => { if (o.isPoints) points = o; });
          if (points) {
            const g = points.geometry;
            const u = points.material.uniforms;
            window.__data = {
              pointCount: g.drawRange.count,
              hasUv: !!g.attributes.uv,
              uvSample: g.attributes.uv ? Array.from(g.attributes.uv.array.slice(0,4)) : null,
              meshScale: [points.scale.x, points.scale.y, points.scale.z],
              meshPos: [points.position.x, points.position.y, points.position.z],
              uRez: u.uRez ? [u.uRez.value.x, u.uRez.value.y] : null,
              uParticleScale: u.uParticleScale ? u.uParticleScale.value : null,
              uPixelRatio: u.uPixelRatio ? u.uPixelRatio.value : null,
              uColorScheme: u.uColorScheme ? u.uColorScheme.value : null,
              uColor1: u.uColor1 ? [u.uColor1.value.r,u.uColor1.value.g,u.uColor1.value.b] : null,
            };
          }
          // 相机
          window.__cam = {
            type: camera.type, fov: camera.fov, aspect: camera.aspect,
            near: camera.near, far: camera.far,
            pos: [camera.position.x, camera.position.y, camera.position.z]
          };
        }
        return orig.call(this, scene, camera);
      };
    }
    if (!window.__hooked) setTimeout(tryHook, 50);
  };
  tryHook();
});

await page.goto('https://antigravity.google/', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 4000));
const data = await page.evaluate(() => ({ data: window.__data, cam: window.__cam, hooked: window.__hooked }));
console.log(JSON.stringify(data, null, 2));
await browser.close();
