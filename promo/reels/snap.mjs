// Снимки отдельных кадров для проверки: node snap.mjs 0.5 2.4 5.9 …
import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
import { serve } from './serve.mjs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const times = process.argv.slice(2).map(Number);
const out = process.env.OUT ?? 'frames-check';
await mkdir(out, { recursive: true });
const server = await serve(0);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb'] });
const page = await browser.newPage();
page.on('console', m => m.type() === 'error' && console.log('console:', m.text()));
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?render&v=${process.env.VIDEO ?? 'address'}`, { waitUntil: 'networkidle0' });
await page.waitForFunction('window.__ready === true', { timeout: 20000 });
for (const t of times) {
  await page.evaluate(x => window.seek(x), t);
  await page.screenshot({ path: `${out}/t${t.toFixed(2)}.png`, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
}
await browser.close();
server.close();
console.log('ok', times.length);
