// Звук ролика: лёгкий бит 120 BPM + эффекты, привязанные к тем же секундам, что и картинка.
// Всё синтезируется здесь же — без чужой музыки и лицензий. Выход: out/sound.wav (48 кГц, стерео).
import { writeFileSync, mkdirSync } from 'node:fs';
const VIDEO = process.env.VIDEO ?? 'address';
const { cues, DURATION, MUSIC } = await import(`./${VIDEO}.timeline.mjs`);

const SR = 48000;
const N = Math.ceil(SR * DURATION);
const bus = { sfxL: new Float32Array(N), sfxR: new Float32Array(N), musL: new Float32Array(N), musR: new Float32Array(N) };
const TAU = Math.PI * 2;

let seed = 12345;
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }
const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff) - 1;

// Фильтр (state-variable): низкие / полоса / высокие частоты.
function svf() {
  let lp = 0, bp = 0;
  return (x, cut, q = 0.7) => {
    const f = 2 * Math.sin(Math.PI * Math.min(cut, SR / 6) / SR);
    const hp = x - lp - bp / q;
    bp += f * hp;
    lp += f * bp;
    return { lp, bp, hp };
  };
}
// Пишет звук длиной len секунд с момента t0; gen(τ, i) → [левый, правый] или число.
function put(t0, len, gen, { pan = 0, to = 'sfx', amp = 1 } = {}) {
  const i0 = Math.round(t0 * SR), n = Math.round(len * SR);
  const gl = Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, gr = Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
  const L = bus[to + 'L'], R = bus[to + 'R'];
  for (let k = 0; k < n; k++) {
    const i = i0 + k;
    if (i < 0 || i >= N) continue;
    const v = gen(k / SR, k);
    if (Array.isArray(v)) { L[i] += v[0] * amp; R[i] += v[1] * amp; }
    else { L[i] += v * amp * gl; R[i] += v * amp * gr; }
  }
}

// ---------- инструменты ----------
function kick(t0, amp = 1, { decay = 7.5, to = 'mus' } = {}) {
  let ph = 0;
  put(t0, 0.5, τ => {
    ph += TAU * (46 + 120 * Math.exp(-τ * 30)) / SR;
    const body = Math.sin(ph) * Math.exp(-τ * decay);
    const click = noise() * Math.exp(-τ * 350) * 0.35;
    return Math.tanh(1.6 * (body + click));
  }, { amp, to });
}
function hat(t0, amp = 1, open = false) {
  let prev = 0, prev2 = 0;
  put(t0, open ? 0.2 : 0.06, τ => {
    const x = noise(), h1 = x - prev; prev = x; const h2 = h1 - prev2; prev2 = h1;
    return h2 * 0.35 * Math.exp(-τ * (open ? 18 : 75));
  }, { amp, to: 'mus', pan: 0.25 });
}
function clap(t0, amp = 1) {
  const f = svf();
  put(t0, 0.22, τ => {
    const burst = [0, 0.011, 0.022].reduce((s, o) => s + (τ >= o ? Math.exp(-(τ - o) * 160) : 0), 0) + Math.exp(-τ * 22) * 0.5;
    return f(noise(), 1400, 1.2).bp * burst * 1.4;
  }, { amp, to: 'mus', pan: -0.1 });
}
function bassNote(t0, dur, freq, amp = 1) {
  put(t0, dur + 0.05, τ => {
    const env = Math.min(1, τ / 0.006) * Math.exp(-τ * 3) * (τ > dur ? Math.exp(-(τ - dur) * 80) : 1);
    let s = 0;
    for (let k = 1; k <= 5; k++) s += Math.sin(TAU * freq * k * τ) / (k * k * 0.7 + 0.3);
    return Math.tanh(1.4 * s) * env * 0.5;
  }, { amp, to: 'mus' });
}
function pluck(t0, freqs, amp = 1) {
  put(t0, 0.4, τ => {
    const env = Math.min(1, τ / 0.003) * Math.exp(-τ * 10);
    let l = 0, r = 0;
    for (const f of freqs) {
      const a = TAU * f * 0.997 * τ, b = TAU * f * 1.003 * τ;
      l += Math.sin(a) + 0.28 * Math.sin(2 * a) + 0.12 * Math.sin(3 * a);
      r += Math.sin(b) + 0.28 * Math.sin(2 * b) + 0.12 * Math.sin(3 * b);
    }
    return [l * env * 0.16, r * env * 0.16];
  }, { amp, to: 'mus' });
}
function whoosh(t0, { dur = 0.4, from = 500, to: toF = 3000, amp = 0.5 }) {
  const f = svf();
  put(t0, dur, τ => {
    const p = τ / dur;
    const cut = from * (toF / from) ** p;
    const env = Math.sin(Math.PI * p) ** 1.6;
    const v = f(noise(), cut, 1.6).bp * env * 1.6;
    const pan = -0.6 + 1.2 * p;
    return [v * (1 - pan) * 0.8, v * (1 + pan) * 0.8];
  }, { amp });
}
const click = (t0, { amp = 0.6 }) => put(t0, 0.05, τ => Math.sin(TAU * 2600 * τ) * Math.exp(-τ * 190) * 0.8 + noise() * Math.exp(-τ * 420) * 0.4, { amp });
const tick = (t0, { amp = 0.3, f = 2000 }) => put(t0, 0.025, τ => Math.sin(TAU * f * τ) * Math.exp(-τ * 260), { amp, pan: 0.2 });
function bell(t0, f, amp, decay = 7, len = 0.9) {
  put(t0, len, τ => {
    const env = Math.min(1, τ / 0.002) * Math.exp(-τ * decay);
    return (Math.sin(TAU * f * τ) + 0.32 * Math.sin(TAU * f * 2.76 * τ) * Math.exp(-τ * 6) + 0.12 * Math.sin(TAU * f * 5.4 * τ) * Math.exp(-τ * 12)) * env * 0.5;
  }, { amp });
}
function coin(t0, { amp = 0.5, semis = 0 }) {
  const f = 1318.5 * 2 ** (semis / 12);
  bell(t0, f, amp, 11, 0.4);
  bell(t0 + 0.06, f * 1.5, amp, 8, 0.6);
}
function pop(t0, { amp = 0.4, semis = 0 }) {
  const base = 520 * 2 ** (semis / 12);
  let ph = 0;
  put(t0, 0.16, τ => { ph += TAU * base * (1 + 1.3 * Math.exp(-τ * 55)) / SR; return Math.sin(ph) * Math.exp(-τ * 26); }, { amp });
}
function success(t0, { amp = 0.55 }) {
  [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(t0 + i * 0.07, f, amp * (1 - i * 0.1), 4.5, 1.2));
}
function thud(t0, { amp = 0.6 }) {
  const f = svf();
  let ph = 0;
  put(t0, 0.45, τ => {
    ph += TAU * (48 + 75 * Math.exp(-τ * 22)) / SR;
    return Math.sin(ph) * Math.exp(-τ * 9) + f(noise(), 400).lp * Math.exp(-τ * 25) * 0.8;
  }, { amp });
}
function knock(t0, { amp = 0.35 }) {
  const f = svf();
  let ph = 0;
  put(t0, 0.14, τ => {
    ph += TAU * (170 + 140 * Math.exp(-τ * 60)) / SR;
    return Math.sin(ph) * Math.exp(-τ * 34) + f(noise(), 1100, 2).bp * Math.exp(-τ * 70) * 0.9;
  }, { amp, pan: (noise()) * 0.5 });
}
function zip(t0, { amp = 0.4, dur = 0.35 }) {
  const f = svf();
  put(t0, dur, τ => {
    const p = τ / dur;
    return f(noise(), 1800 * (4.5 ** p), 3).bp * Math.sin(Math.PI * p) * 1.3;
  }, { amp, pan: 0.3 });
}
function riser(t0, { dur = 1, amp = 0.5 }) {
  const f = svf();
  let ph = 0;
  put(t0, dur, τ => {
    const p = τ / dur;
    ph += TAU * (220 * 4 ** p) / SR;
    return (f(noise(), 300 * 22 ** p, 2.5).bp * 1.3 + Math.sin(ph) * 0.18) * p * p;
  }, { amp });
}
function impact(t0, { amp = 1 }) {
  kick(t0, amp * 1.1, { decay: 4, to: 'sfx' });
  const f = svf();
  put(t0, 1.6, τ => {
    const v = f(noise(), 2400 * Math.exp(-τ * 2.2) + 150, 0.8).lp;
    return v * Math.exp(-τ * 3.2) * 0.9 + Math.sin(TAU * 41 * τ) * Math.exp(-τ * 3) * 0.5;
  }, { amp: amp * 0.8 });
}
// Мягкий щелчок клавиатуры, когда покупатель печатает.
function key(t0, { amp = 0.2 }) {
  const f = svf(), pitch = 2600 + noise() * 500;
  put(t0, 0.03, τ => f(noise(), pitch, 2).bp * Math.exp(-τ * 220) * 1.4 + Math.sin(TAU * 1700 * τ) * Math.exp(-τ * 300) * 0.25, { amp, pan: noise() * 0.3 });
}
// Звуковой знак smarket.kg: три быстрые ноты вверх — звучит каждый раз, когда вспыхивает адрес.
function logo(t0, { amp = 0.55 }) {
  [[1046.5, 0], [1318.5, 0.075], [1568, 0.15]].forEach(([f, d], i) => bell(t0 + d, f, amp * (i === 2 ? 1.1 : 0.85), i === 2 ? 4 : 9, i === 2 ? 1.0 : 0.4));
  pop(t0, { amp: amp * 0.5, semis: 0 });
}
function rattle(t0, { dur = 0.6, amp = 0.35 }) {
  for (let t = 0; t < dur; t += 0.045) knock(t0 + t, { amp: amp * (0.6 + 0.4 * Math.sin(t * 40)) });
}
function poof(t0, { amp = 0.5 }) {
  const f = svf();
  put(t0, 0.5, τ => f(noise(), 900 * Math.exp(-τ * 3) + 200, 0.7).lp * Math.exp(-τ * 7) * 1.6, { amp });
}
function steam(t0, { dur = 0.7, amp = 0.25 }) {
  const f = svf();
  put(t0, dur, τ => f(noise(), 5200, 1.2).bp * Math.sin(Math.PI * τ / dur) * 0.9, { amp, pan: 0.35 });
}
function sparkle(t0, { dur = 0.8, amp = 0.4 }) {
  const r = rng(Math.floor(t0 * 1000));
  for (let i = 0; i < 9; i++) bell(t0 + i * dur / 10, 2093 * 2 ** (Math.floor(r() * 8) / 12), amp * 0.5, 14, 0.25);
}
function suck(t0, { dur = 0.65, amp = 0.4 }) {
  const f = svf();
  put(t0, dur, τ => { const p = τ / dur; return f(noise(), 600 + 3400 * p, 2).bp * Math.min(1, p * 4) * (1 - p * p) * 1.4; }, { amp });
}
// Телеигра: тиканье таймера, барабанная дробь, мягкий «не угадал».
function tock(t0, { amp = 0.5, hi = false }) {
  const f = hi ? 1250 : 900;
  put(t0, 0.12, τ => (Math.sin(TAU * f * τ) + 0.4 * Math.sin(TAU * f * 2.3 * τ)) * Math.exp(-τ * 45), { amp });
}
function drumroll(t0, { dur = 2.5, amp = 0.3 }) {
  const f = svf();
  put(t0, dur, τ => {
    const p = τ / dur, hit = (τ * (14 + 10 * p)) % 1;
    return f(noise(), 1800, 1).bp * Math.exp(-hit * 9) * (0.4 + 0.6 * p) * 1.4;
  }, { amp });
}
function buzz(t0, { amp = 0.25 }) {
  put(t0, 0.28, τ => Math.sign(Math.sin(TAU * 140 * τ)) * 0.3 * Math.exp(-τ * 9) * Math.min(1, τ / 0.01), { amp });
}
const SFX = { whoosh, impact, click, coin, tick, pop, success, thud, knock, zip, riser, key, logo, rattle, poof, steam, sparkle, suck, tock, drumroll, buzz };

// ---------- музыка: C–G–Am–F по кругу, 120 BPM ----------
const NOTE = { C: [261.63, 329.63, 392.0], G: [246.94, 293.66, 392.0], Am: [220.0, 261.63, 329.63], F: [220.0, 261.63, 349.23] };
const ROOT = { C: 65.41, G: 98.0, Am: 55.0, F: 87.31 };
const chordAt = t => ['C', 'G', 'Am', 'F'][Math.floor(t / 2) % 4];
const END = MUSIC.end;
// Паузы без бочки — напряжение перед развязкой.
const calm = t => MUSIC.calm.some(([a, b]) => t >= a && t < b);
const kicks = [];
for (let t = 0.5; t < DURATION - 0.1; t += 0.25) {
  const ch = chordAt(t);
  const beat = Math.abs(t * 2 - Math.round(t * 2)) < 1e-6;
  const off = !beat && Math.round(t * 4) % 2 === 1;
  const groove = t >= (MUSIC.start ?? 2) && t < END - 0.7;
  if (off && t < END - 0.7) pluck(t, NOTE[ch], t < 2 ? 0.55 : calm(t) ? 0.6 : 0.8);
  if (groove) {
    if (beat && !calm(t)) { kick(t, 0.85); kicks.push(t); }
    if (beat && !calm(t) && Math.round(t * 2) % 2 === 1) clap(t, 0.45);
    if (off) hat(t, calm(t) ? 0.4 : 0.7, Math.round(t * 4) % 4 === 3);
    if (!calm(t) || Math.round(t * 4) % 4 === 0) bassNote(t, 0.2, ROOT[ch] * (Math.round(t * 4) % 2 ? 2 : 1), 0.6);
  }
  if (t < (MUSIC.start ?? 2) && off) hat(t, 0.4);
  if (t >= END + 0.5 && beat) { kick(t, 0.6); kicks.push(t); if (off) hat(t, 0.4); }
}
// Разгон перед финалом.
for (let t = END - 0.7; t < END; t += 0.125) hat(t, 0.35 + (t - END + 0.7) * 0.6);
bassNote(END, 1.4, ROOT.C, 0.7);
put(END + 1.4, 1.0, τ => NOTE.C.reduce((s, f) => s + Math.sin(TAU * f * τ) + 0.3 * Math.sin(TAU * f * 2 * τ), 0) * 0.07 * Math.min(1, τ / 0.02) * Math.exp(-τ * 1.4), { to: 'mus' });

for (const c of cues()) SFX[c.type](c.t, c);

// ---------- сведение: музыка «приседает» под бочку, мягкий лимитер ----------
const out = new Int16Array(N * 2);
const mixL = new Float32Array(N), mixR = new Float32Array(N);
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  let duck = 1;
  for (let k = kicks.length - 1; k >= 0; k--) if (kicks[k] <= t) { duck = 1 - 0.55 * Math.exp(-(t - kicks[k]) * 9); break; }
  const intro = Math.min(1, t / 0.05);
  const fade = Math.min(1, (DURATION - t) / 0.35);
  mixL[i] = (bus.sfxL[i] + bus.musL[i] * 0.5 * duck) * intro * fade;
  mixR[i] = (bus.sfxR[i] + bus.musR[i] * 0.5 * duck) * intro * fade;
  peak = Math.max(peak, Math.abs(mixL[i]), Math.abs(mixR[i]));
}
const drive = 1.25 / peak, norm = 0.94 / Math.tanh(1.25);
for (let i = 0; i < N; i++) {
  out[i * 2] = Math.round(Math.tanh(mixL[i] * drive) * norm * 32767);
  out[i * 2 + 1] = Math.round(Math.tanh(mixR[i] * drive) * norm * 32767);
}
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + out.byteLength, 4); hdr.write('WAVE', 8);
hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34);
hdr.write('data', 36); hdr.writeUInt32LE(out.byteLength, 40);
mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
writeFileSync(new URL('./out/sound.wav', import.meta.url), Buffer.concat([hdr, Buffer.from(out.buffer)]));
console.log(`sound.wav: ${DURATION} с, пик до лимитера ${peak.toFixed(2)}`);
