// Рендер ролика в MP4 1080×1920, 30 к/с, со звуком.
// Каждый кадр = среднее из SUB подкадров (как затвор камеры 180°) → естественное размытие движения.
// Запуск: VIDEO=address npm run render   (VIDEO=order — «Как заказать»; SUB=1 — быстрый черновик)
import puppeteer from 'puppeteer-core';
import ffmpegPath from 'ffmpeg-static';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { serve } from './serve.mjs';
const VIDEO = process.env.VIDEO ?? 'address';
const { DURATION, FPS, OUT_NAME, WARMUP } = await import(`./${VIDEO}.timeline.mjs`);

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SUB = Number(process.env.SUB ?? 10);
const SHUTTER = 0.5;
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

execFileSync('node', [new URL('./audio.mjs', import.meta.url).pathname], { stdio: 'inherit', env: { ...process.env, VIDEO } });

const server = await serve(0);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-gpu-vsync'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?render&v=${VIDEO}`, { waitUntil: 'networkidle0' });
await page.waitForFunction('window.__ready === true', { timeout: 30000 });

const shot = () => page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1920 }, optimizeForSpeed: true });
// Прогрев: каждую картинку показываем заранее, чтобы в кадре она не появилась «пустой».
for (const t of WARMUP) { await page.evaluate(x => window.seek(x), t); await shot(); }

const silent = `${OUT}${OUT_NAME}-silent.mp4`;
const vf = SUB > 1
  ? `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/(${FPS}*TB)`
  : 'null';
const ff = spawn(ffmpegPath, ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'png', '-i', '-',
  '-vf', `${vf},scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`, '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-profile:v', 'high',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((ok, fail) => ff.on('close', c => (c === 0 ? ok() : fail(new Error('ffmpeg ' + c)))));

const frames = Math.round(DURATION * FPS);
const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  for (let j = 0; j < SUB; j++) {
    const t = Math.min(DURATION - 1e-3, (f + (SUB > 1 ? (j / SUB) * SHUTTER : 0)) / FPS);
    await page.evaluate(x => window.seek(x), t);
    const buf = await shot();
    if (!ff.stdin.write(buf)) await new Promise(ok => ff.stdin.once('drain', ok));
  }
  if (f % 30 === 29) process.stdout.write(`\r${f + 1}/${frames} кадров · ${((Date.now() - t0) / 1000).toFixed(0)} с`);
}
ff.stdin.end();
await done;
await page.evaluate(x => window.seek(x), DURATION - 1e-3);
await page.screenshot({ path: `${OUT}${OUT_NAME}-cover.png`, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
await browser.close();
server.close();

const final = `${OUT}${OUT_NAME}.mp4`;
execFileSync(ffmpegPath, ['-v', 'error', '-y', '-i', silent, '-i', `${OUT}sound.wav`, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
  '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', '-movflags', '+faststart', final], { stdio: 'inherit' });
rmSync(`${OUT}sound.wav`, { force: true });
console.log(`\nГотово: ${final}`);
