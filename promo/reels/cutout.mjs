// Вырезает товар с белого фона сайта → PNG с прозрачностью (assets/cutouts/).
// Заливка от краёв по «почти белым» пикселям, мягкий край, без белой каймы.
import puppeteer from 'puppeteer-core';
import { writeFile, mkdir } from 'node:fs/promises';
import { serve } from './serve.mjs';

// Имя файла и порог «почти белого» фона (для серого фона — выше).
const NAMES = (process.argv.slice(2).length ? process.argv.slice(2) : ['flagman:20', 'uakeen:20', 'hantaji:20', 'midea-oven:20', 'lg-tv:20', 'midea-fridge:22', 'midea-micro:20', 'midea-kettle:40']).map(s => s.split(':'));
await mkdir(new URL('./assets/cutouts/', import.meta.url), { recursive: true });
const server = await serve(0);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/assets/products/flagman.jpg`);
for (const [name, tol = '20'] of NAMES) {
  const res = await page.evaluate(async (src, T) => {
    const img = new Image(); img.src = src; await img.decode();
    const w = img.width, h = img.height;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, w, h), p = d.data;
    const dist = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) dist[i] = 255 - Math.min(p[i * 4], p[i * 4 + 1], p[i * 4 + 2]);
    const bg = new Uint8Array(w * h), q = new Int32Array(w * h); let qh = 0, qt = 0;
    const seed = i => { if (!bg[i] && dist[i] < T) { bg[i] = 1; q[qt++] = i; } };
    for (let X = 0; X < w; X++) { seed(X); seed((h - 1) * w + X); }
    for (let Y = 0; Y < h; Y++) { seed(Y * w); seed(Y * w + w - 1); }
    while (qh < qt) {
      const i = q[qh++], X = i % w, Y = (i / w) | 0;
      if (X > 0) seed(i - 1); if (X < w - 1) seed(i + 1); if (Y > 0) seed(i - w); if (Y < h - 1) seed(i + w);
    }
    // Мелкие «островки» (логотип в углу фото и т.п.) тоже считаем фоном.
    const lab = new Int32Array(w * h).fill(-1), sizes = [];
    for (let i = 0; i < w * h; i++) {
      if (bg[i] || lab[i] >= 0) continue;
      const id = sizes.length; let n = 0; qh = 0; qt = 0; q[qt++] = i; lab[i] = id;
      while (qh < qt) {
        const j = q[qh++], X = j % w, Y = (j / w) | 0; n++;
        for (const k of [X > 0 ? j - 1 : -1, X < w - 1 ? j + 1 : -1, Y > 0 ? j - w : -1, Y < h - 1 ? j + w : -1]) if (k >= 0 && !bg[k] && lab[k] < 0) { lab[k] = id; q[qt++] = k; }
      }
      sizes.push(n);
    }
    const big = Math.max(...sizes);
    for (let i = 0; i < w * h; i++) if (!bg[i] && sizes[lab[i]] < big * 0.04) bg[i] = 1;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) {
      const i = Y * w + X;
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const XX = X + dx, YY = Y + dy;
        if (XX < 0 || YY < 0 || XX >= w || YY >= h) continue;
        s += bg[YY * w + XX] ? 0 : 1; n++;
      }
      const a = bg[i] ? 0 : s / n;
      if (a > 0 && a < 1) for (let k = 0; k < 3; k++) p[i * 4 + k] = Math.max(0, Math.min(255, (p[i * 4 + k] - 255 * (1 - a)) / a));
      p[i * 4 + 3] = Math.round(a * 255);
      if (a > 0) { x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y); }
    }
    x.putImageData(d, 0, 0);
    const pad = 6, cw = x1 - x0 + 1 + pad * 2, ch = y1 - y0 + 1 + pad * 2;
    const o = document.createElement('canvas'); o.width = cw; o.height = ch;
    o.getContext('2d').drawImage(c, x0 - pad, y0 - pad, cw, ch, 0, 0, cw, ch);
    return { url: o.toDataURL('image/png'), w: cw, h: ch };
  }, `/assets/products/${name}.jpg`, Number(tol));
  await writeFile(new URL(`./assets/cutouts/${name}.png`, import.meta.url), Buffer.from(res.url.split(',')[1], 'base64'));
  console.log(name, res.w, 'x', res.h);
}
await browser.close();
server.close();
