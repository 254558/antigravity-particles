// Records each footer letter's y-offset over time to reverse-engineer
// the sine wave animation (amplitude / frequency / per-letter phase).
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('https://antigravity.google', { waitUntil: 'networkidle2', timeout: 60000 });

// Scroll to the footer so the animation is active / in view.
await page.evaluate(() => {
  const f = document.querySelector('app-antigravity-footer');
  if (f) f.scrollIntoView();
});
await new Promise(r => setTimeout(r, 1500));

// Collect per-letter transform over time.
const samples = await page.evaluate(async () => {
  const paths = Array.from(document.querySelectorAll('app-antigravity-footer svg path'));
  const ids = paths.map((p, i) => p.getAttribute('id') || `p${i}`);

  // Use getBoundingClientRect to get true rendered y (accounts for matrix transforms).
  const grab = () => {
    const t = performance.now();
    return paths.map(p => {
      const r = p.getBoundingClientRect();
      const tr = p.getAttribute('transform') || '';
      return { y: r.top, h: r.height, tr };
    }).map(d => ({ y: d.y, tr: d.tr }));
  };

  const out = [];
  const start = performance.now();
  for (let i = 0; i < 80; i++) {
    const t = performance.now() - start;
    out.push({ t, data: grab() });
    await new Promise(r => setTimeout(r, 60));
  }
  return { ids, samples: out };
});

await browser.close();

// Print CSV: time + per-letter y delta from first sample.
const { ids, samples: S } = samples;
const base = S[0].data.map(d => d.y);
console.log('t(ms)\t' + ids.join('\t'));
for (const s of S) {
  const row = [Math.round(s.t)];
  s.data.forEach((d, i) => row.push((d.y - base[i]).toFixed(2)));
  console.log(row.join('\t'));
}

// Also dump transform strings from the last frame to see matrix form.
console.log('\n--- transforms (last frame) ---');
S[S.length - 1].data.forEach((d, i) => {
  console.log(ids[i] + '\t' + d.tr);
});
