// «Запомните один адрес» — 20-секундный ролик 1080×1920, целиком в одном SVG.
// Жизненные ситуации сменяют друг друга, а внизу всё время стоит одна и та же адресная строка
// smarket.kg: каждая новая сцена «вырастает» из неё, и на каждом ответе звучит один и тот же
// короткий звуковой знак. Так адрес запоминается. Товары, цены и тексты — с сайта.
import { T, S, K, KITCHEN, PULSES, IOS_LIVE, ANDROID_LIVE } from './address.timeline.mjs';
import {
  W, C, NS, el, text, initSvg, loadFonts, preloadImages, clamp, lerp, P, bump, ease, settle, pose, show,
  measure, clipRect, maskLine, buildMark, brandIcon, rng, mix,
} from './lib.js';

const PILL = { x: 540, y: 1490 };
const FLOOR = 1335;
const CUT = {
  flagman: 762 / 879, uakeen: 1056 / 1058, hantaji: 375 / 998, 'midea-kettle': 756 / 964, 'midea-micro': 921 / 535,
  'midea-fridge': 728 / 782, 'lg-tv': 1070 / 688, 'midea-oven': 581 / 564,
};
const WOOD = ['#e8d2b0', '#d3b78f', '#cdb89a', '#dcc39e', '#c9ad86'];
const PALETTES = [
  WOOD,
  ['#f5f4f0', '#dedbd3', '#e6e3dc', '#eceae4', '#bdb8ad'], // белые матовые фасады
  ['#c9d6bf', '#a9bb9d', '#b7c6ab', '#bfcdb4', '#8fa483'], // шалфей
];

const tracks = [];
const on = fn => tracks.push(fn);
let defs;

export async function start(stage) {
  const ctx = initSvg(stage);
  const svg = ctx.svg;
  defs = ctx.defs;
  const f = (id, box = ['-40%', '-40%', '180%', '180%']) => el('filter', { id, x: box[0], y: box[1], width: box[2], height: box[3] }, defs);
  el('feGaussianBlur', { stdDeviation: 12 }, f('soft'));
  el('feDropShadow', { dx: 0, dy: 16, stdDeviation: 18, 'flood-color': C.ink, 'flood-opacity': 0.22 }, f('shPill'));
  el('feDropShadow', { dx: 0, dy: 10, stdDeviation: 14, 'flood-color': C.ink, 'flood-opacity': 0.16 }, f('shCard'));
  el('feGaussianBlur', { stdDeviation: 26 }, f('kSoft', ['-20%', '-40%', '140%', '180%']));
  await loadFonts();
  const kitchenSrc = await fetch('assets/kitchen-iso.svg').then(r => r.text());
  const brand = await fetch('assets/brand-icons.json').then(r => r.json());

  el('rect', { width: W, height: 1920, fill: C.lemon }, svg);
  const world = el('g', null, svg);
  const intro = el('g', null, world);
  const scenes = el('g', null, world);
  const pill = buildPill(svg);

  buildIntro(intro);
  const [v1, v2, v3, v4, v5] = T.scenes;
  sceneWasher(scene(scenes, v1, v2, C.white), v1);
  sceneGuests(scene(scenes, v2, v3, C.lemon), v2);
  sceneWedding(scene(scenes, v3, v4, C.ice), v3);
  sceneMoving(scene(scenes, v4, v5, C.lemon), v4);
  sceneDust(scene(scenes, v5, T.kitchen, C.story), v5);
  sceneKitchen(scene(scenes, T.kitchen, T.end, C.white), T.kitchen, kitchenSrc);
  sceneEnd(scene(scenes, T.end, 99, C.lemon), brand);

  // Толчок кадра при каждом приземлении.
  const hits = [T.slam, ...T.scenes.map(v => v + S.land), T.kitchen + 0.95 + 0.3, T.endPill + 0.4];
  on(t => {
    let dx = 0, dy = 0;
    for (const h of hits) {
      const d = t - h;
      if (d > 0 && d < 0.35) { const a = 11 * Math.exp(-14 * d); dx += a * Math.sin(d * 95); dy += a * Math.cos(d * 80); }
    }
    world.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)})`);
    pill.update(t);
  });
  await preloadImages(svg);
  window.seek = seek;
  seek(0);
}

export function seek(t) {
  for (const fn of tracks) fn(t);
}

// ---------- кирпичики ----------
// Сцена появляется кругом, который вырастает из адресной строки.
function scene(parent, t0, t1, bg) {
  const id = `w${t0}`.replace('.', '_');
  const cp = el('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }, defs);
  const circle = el('circle', { cx: PILL.x, cy: PILL.y, r: 0 }, cp);
  const g = el('g', { 'clip-path': `url(#${id})` }, parent);
  el('rect', { width: W, height: 1920, fill: bg }, g);
  const stage = el('g', null, g);
  const ring = el('circle', { cx: PILL.x, cy: PILL.y, fill: 'none', stroke: C.ink, 'stroke-width': 10 }, parent);
  on(t => {
    const vis = t > t0 - 0.13 && t < t1 + 0.4;
    show(g, vis);
    const p = ease.inOut3(P(t, t0 - 0.12, 0.45));
    const r = lerp(0, 2150, p);
    circle.setAttribute('r', r.toFixed(1));
    ring.setAttribute('r', r.toFixed(1));
    show(ring, p > 0 && p < 1);
    ring.setAttribute('stroke-width', (14 * (1 - p)).toFixed(2));
    const z = 1 + 0.035 * ease.out3(P(t, t0, t1 - t0 + 0.4));
    stage.setAttribute('transform', `translate(540 1000) scale(${z.toFixed(4)}) translate(-540 -1000)`);
  });
  return { g: stage, bg };
}
// Вопрос крупно, с наклоном «наклейки»; маркер подчёркивает последнюю строку.
function question(parent, lines, t0, { hl = C.lemon, out } = {}) {
  const g = el('g', { transform: 'rotate(-2.5 540 520)' }, parent);
  const size = lines.length === 1 ? 172 : 150;
  const ys = lines.length === 1 ? [560] : [450, 602];
  const last = lines[lines.length - 1], lw = measure(last, size, 800, -0.045);
  const mark = el('rect', { x: 540 - lw / 2 - 18, y: ys[ys.length - 1] - size * 0.42, height: size * 0.5, rx: 14, fill: hl }, g);
  const ml = lines.map((l, i) => maskLine(g, l, { x: 540, y: ys[i], size, anchor: 'middle', ls: -0.045 }));
  on(t => {
    const po = out ? P(t, out, 0.35) : 0;
    ml.forEach((m, i) => m.set(P(t, t0 + i * 0.1, 0.6), po));
    mark.setAttribute('width', (lw + 36) * ease.outExpo(P(t, t0 + 0.25, 0.45)));
    mark.setAttribute('opacity', 1 - ease.out3(po));
  });
}
// Товар с сайта (вырезанный с фона): начало координат — середина основания.
function product(parent, name, { h, w }) {
  const ratio = CUT[name];
  const hh = h ?? w / ratio, ww = w ?? h * ratio;
  const shadow = el('ellipse', { rx: ww * 0.46, ry: 18, fill: C.ink, opacity: 0.2, filter: 'url(#soft)' }, parent);
  const g = el('g', null, parent);
  el('image', { href: `assets/cutouts/${name}.png`, x: -ww / 2, y: -hh, width: ww, height: hh }, g);
  return { g, shadow, w: ww, h: hh };
}
// Падение с высоты: разгон, касание, сплющивание и отскок.
function drop(p, t, t0, t1, x, y, { from = -900, squash = 0.14 } = {}) {
  const vis = t > t0;
  show(p.g, vis); show(p.shadow, vis);
  if (!vis) return;
  const f = P(t, t0, t1 - t0);
  const yy = lerp(from, y, ease.in2(f));
  const sq = settle(P(t, t1, 0.55), squash, 20, 7);
  const sy = 1 - sq, sx = 1 + sq * 0.7;
  p.g.setAttribute('transform', `translate(${x.toFixed(1)} ${yy.toFixed(1)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)})`);
  const near = clamp(1 - (y - yy) / 900);
  p.shadow.setAttribute('transform', `translate(${x} ${y + 4}) scale(${(0.35 + 0.65 * near).toFixed(3)})`);
  p.shadow.setAttribute('opacity', (0.22 * near).toFixed(3));
}
function sparkles(parent, pts, t0) {
  const stars = pts.map(([x, y, s]) => {
    const g = el('g', null, parent);
    el('path', { d: 'M0 -34 C4 -8 8 -4 34 0 C8 4 4 8 0 34 C-4 8 -8 4 -34 0 C-8 -4 -4 -8 0 -34Z', fill: C.lemon, stroke: C.ink, 'stroke-width': 5, 'stroke-linejoin': 'round' }, g);
    return { g, x, y, s };
  });
  on(t => stars.forEach((st, i) => {
    const p = P(t, t0 + i * 0.07, 0.5);
    show(st.g, p > 0);
    pose(st.g, { x: st.x, y: st.y, s: st.s * ease.outBack(p, 2.5) * (1 - 0.3 * P(t, t0 + 0.9, 0.4)), r: p * 90 });
  }));
}
function confetti(parent, x, y, t0, n = 44, seed = 3) {
  const g = el('g', null, parent);
  const rnd = rng(seed);
  const bits = Array.from({ length: n }, (_, i) => {
    const b = el('rect', { x: -11, y: -6, width: 22, height: 12, rx: 3, fill: [C.lemon, C.blue, C.red, C.green, C.white][i % 5], stroke: C.ink, 'stroke-width': 2.5 }, g);
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.4;
    return { b, vx: Math.cos(a) * (400 + rnd() * 700), vy: Math.sin(a) * (900 + rnd() * 700), spin: (rnd() - 0.5) * 1200 };
  });
  on(t => {
    const d = t - t0;
    show(g, d > 0 && d < 1.6);
    if (!(d > 0 && d < 1.6)) return;
    bits.forEach(k => pose(k.b, { x: x + k.vx * d, y: y + k.vy * d + 1500 * d * d, r: k.spin * d, o: 1 - P(d, 1.1, 0.5) }));
  });
}

// ---------- адресная строка ----------
function buildPill(svg) {
  const size = 92, tw = measure('smarket.kg', size, 800, -0.035);
  const w = 22 + 104 + 24 + tw + 50, h = 148;
  const g = el('g', null, svg);
  const ring = el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: h / 2, fill: 'none', stroke: C.ink, 'stroke-width': 6 }, g);
  const body = el('g', { filter: 'url(#shPill)' }, g);
  el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: h / 2, fill: C.white, stroke: C.ink, 'stroke-width': 6 }, body);
  const x0 = -w / 2 + 22;
  el('circle', { cx: x0 + 52, cy: 0, r: 52, fill: C.lemon, stroke: C.ink, 'stroke-width': 5 }, g);
  buildMark(g, C.ink).setAttribute('transform', `translate(${x0 + 52 - 17.9} -32) scale(0.64)`);
  const tx = x0 + 104 + 24;
  const sel = el('rect', { x: tx - 8, y: -50, height: 100, rx: 12, fill: C.lemon }, g);
  text(g, 'smarket.kg', { x: tx, y: 32, 'font-size': size, 'font-weight': 800, fill: C.ink, 'letter-spacing': '-0.035em' });
  const caret = el('rect', { x: tx + tw + 8, y: -40, width: 7, height: 80, rx: 3, fill: C.blue }, g);
  return {
    update(t) {
      show(g, t > T.slam - 0.02);
      // Падает в кадр, потом уезжает вниз на своё место; в финале — в центр.
      const slam = ease.outExpo(P(t, T.slam - 0.02, 0.32));
      const home = ease.inOut3(P(t, T.home, 0.45));
      const fin = ease.inOut3(P(t, T.endPill, 0.42));
      let y = lerp(1010, PILL.y, home), s = lerp(lerp(2.6, 1.32, slam), 1, home);
      y = lerp(y, 900, fin);
      s = lerp(s, 1.32, fin);
      const last = PULSES.filter(p => t >= p).pop() ?? -9;
      s *= 1 + settle(P(t, last, 0.6), 0.12, 18, 6);
      pose(g, { x: PILL.x, y, s, o: P(t, T.slam - 0.02, 0.08) });
      // Вспышка: адрес «выделяется», как в строке браузера, и от строки расходится кольцо.
      const hl = P(t, last, 0.2) * (1 - P(t, last + 0.55, 0.25));
      sel.setAttribute('width', ((tw + 16) * ease.outExpo(hl)).toFixed(1));
      sel.setAttribute('opacity', hl > 0 ? 1 : 0);
      const rp = P(t, last, 0.55);
      ring.setAttribute('transform', `scale(${(1 + 0.32 * ease.out3(rp)).toFixed(4)})`);
      ring.setAttribute('opacity', rp > 0 && rp < 1 ? (0.5 * (1 - rp)).toFixed(3) : 0);
      caret.setAttribute('opacity', Math.floor(t * 2.5) % 2 === 0 ? 1 : 0);
    },
  };
}

// ---------- 0. «Запомните один адрес» ----------
function buildIntro(g) {
  const l1 = maskLine(g, 'Запомните', { x: 540, y: 560, size: 150, anchor: 'middle', ls: -0.045 });
  const l2 = maskLine(g, 'один адрес', { x: 540, y: 712, size: 150, anchor: 'middle', ls: -0.045 });
  on(t => {
    show(g, t < T.scenes[0] + 0.4);
    l1.set(P(t, T.hello - 0.05, 0.55), P(t, T.home, 0.35));
    l2.set(P(t, T.hello + 0.08, 0.55), P(t, T.home + 0.05, 0.35));
  });
}

// ---------- 1. Сломалась стиралка ----------
function oldWasher(parent) {
  const g = el('g', null, parent);
  const s = { stroke: C.ink, 'stroke-width': 9, 'stroke-linejoin': 'round' };
  el('rect', { x: -200, y: -460, width: 400, height: 460, rx: 36, fill: '#e9edf2', ...s }, g);
  el('line', { x1: -200, y1: -386, x2: 200, y2: -386, stroke: C.ink, 'stroke-width': 6 }, g);
  [-142, -92].forEach(x => el('circle', { cx: x, cy: -423, r: 16, fill: C.white, stroke: C.ink, 'stroke-width': 6 }, g));
  el('rect', { x: 28, y: -444, width: 134, height: 42, rx: 9, fill: C.ink }, g);
  text(g, 'ERR', { x: 95, y: -412, 'font-size': 30, 'font-weight': 800, fill: '#ff5a4a', 'text-anchor': 'middle' });
  el('circle', { cx: 0, cy: -200, r: 140, fill: '#d5dce5', ...s }, g);
  el('circle', { cx: 0, cy: -200, r: 102, fill: '#a9b8c9', stroke: C.ink, 'stroke-width': 6 }, g);
  const rnd = rng(9);
  for (let i = 0; i < 9; i++) {
    const a = rnd() * 6.28, r = rnd() * 70;
    el('circle', { cx: Math.cos(a) * r, cy: -200 + Math.sin(a) * r, r: 12 + rnd() * 16, fill: C.white, stroke: C.ink, 'stroke-width': 3 }, g);
  }
  el('polyline', { points: '-70,-262 -28,-228 -52,-200 4,-166 -14,-130', fill: 'none', stroke: C.ink, 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  [-160, 110].forEach(x => el('rect', { x, y: -4, width: 50, height: 16, rx: 5, fill: C.ink }, g));
  const foam = el('g', null, g);
  const bubbles = Array.from({ length: 9 }, () => ({ n: el('circle', { r: 10, fill: C.white, stroke: C.ink, 'stroke-width': 5 }, foam), x: (rnd() - 0.5) * 160, r: 12 + rnd() * 20, ph: rnd() }));
  const bangs = [[236, -470, -10], [-246, -360, 12]].map(([x, y, r]) => {
    const b = el('g', null, g);
    el('circle', { r: 36, fill: C.lemon, stroke: C.ink, 'stroke-width': 6 }, b);
    text(b, '!', { y: 20, 'font-size': 56, 'font-weight': 800, fill: C.ink, 'text-anchor': 'middle' });
    return { b, x, y, r };
  });
  return { g, bubbles, bangs };
}
function sceneWasher({ g }, v0) {
  question(g, ['Сломалась', 'стиралка?'], v0);
  const old = oldWasher(g);
  const poof = el('g', null, g);
  const puffs = Array.from({ length: 11 }, (_, i) => ({ n: el('circle', { r: 30, fill: C.white, stroke: C.ink, 'stroke-width': 5 }, poof), a: (i / 11) * Math.PI * 2 }));
  const fl = product(g, 'flagman', { h: 560 });
  on(t => {
    const land = v0 + S.land;
    const pin = ease.outBack(P(t, v0 + 0.05, 0.35), 1.6);
    const crush = ease.in2(P(t, land - 0.02, 0.12));
    show(old.g, t > v0 && crush < 1);
    const shake = P(t, v0 + 0.1, 0.1);
    const jx = (Math.sin(t * 55) * 7 + Math.sin(t * 31) * 4) * shake, jr = Math.sin(t * 40) * 2.6 * shake;
    old.g.setAttribute('transform', `translate(${(540 + jx).toFixed(1)} ${FLOOR}) rotate(${jr.toFixed(2)}) scale(${(pin * (1 + crush * 0.25)).toFixed(4)} ${(pin * (1 - crush)).toFixed(4)})`);
    old.bubbles.forEach((b, i) => {
      const k = ((t - v0) * 0.9 + b.ph) % 1;
      pose(b.n, { x: b.x + Math.sin(t * 5 + i) * 8, y: -70 - k * 160, s: (b.r / 10) * (0.4 + k), o: (t > v0 + 0.15 ? 1 : 0) * (1 - k) });
    });
    old.bangs.forEach((b, i) => pose(b.b, { x: b.x, y: b.y, r: b.r + Math.sin(t * 20 + i) * 6, s: ease.outBack(P(t, v0 + 0.2 + i * 0.1, 0.3), 2.5) }));
    drop(fl, t, v0 + 0.45, land, 540, FLOOR);
    const pp = P(t, land, 0.55);
    show(poof, pp > 0 && pp < 1);
    puffs.forEach(pf => pose(pf.n, { x: 540 + Math.cos(pf.a) * (180 + 160 * ease.out3(pp)), y: FLOOR - 40 + Math.sin(pf.a) * 50 * (1 + pp) - 60 * pp, s: 1.3 * (1 - pp) + 0.2, o: 1 - pp }));
  });
}

// ---------- 2. Гости на пороге ----------
function piala(parent) {
  const g = el('g', null, parent);
  el('path', { d: 'M-62 -58 Q-58 0 0 0 Q58 0 62 -58 Z', fill: C.white, stroke: C.ink, 'stroke-width': 6, 'stroke-linejoin': 'round' }, g);
  el('path', { d: 'M-56 -36 Q0 -22 56 -36', fill: 'none', stroke: C.blue, 'stroke-width': 10, 'stroke-linecap': 'round' }, g);
  [-34, -11, 12, 35].forEach(x => el('circle', { cx: x, cy: -29 + Math.abs(x) * 0.12, r: 3.5, fill: C.white }, g));
  el('ellipse', { cx: 0, cy: -58, rx: 62, ry: 13, fill: '#c98a3c', stroke: C.ink, 'stroke-width': 6 }, g);
  return g;
}
function steam(parent, x, y, t0, n = 3) {
  const g = el('g', null, parent);
  const ws = Array.from({ length: n }, (_, i) => ({ p: el('path', { d: 'M0 0 C14 -22 -14 -44 0 -66 S14 -110 0 -132', fill: 'none', stroke: C.ink, 'stroke-width': 6, 'stroke-linecap': 'round', opacity: 0 }, g), dx: (i - (n - 1) / 2) * 30, ph: i / n }));
  on(t => ws.forEach(w => {
    const k = ((t - t0) * 0.8 + w.ph) % 1;
    const on_ = t > t0;
    pose(w.p, { x: x + w.dx, y: y - k * 70, o: on_ ? 0.55 * bump(k) : 0 });
  }));
}
function sceneGuests({ g }, v0) {
  question(g, ['Гости', 'на пороге?'], v0, { hl: C.white });
  const tea = product(g, 'hantaji', { h: 600 });
  const kettle = product(g, 'midea-kettle', { h: 300 });
  const cups = [[205, 0.18], [330, 0.26], [905, 0.34]].map(([x, d]) => ({ g: piala(g), x, d }));
  steam(g, 735, FLOOR - 310, v0 + 1.0);
  steam(g, 205, FLOOR - 80, v0 + 0.6, 2);
  steam(g, 905, FLOOR - 80, v0 + 0.75, 2);
  on(t => {
    drop(tea, t, v0 + 0.45, v0 + S.land, 455, FLOOR);
    drop(kettle, t, v0 + 0.58, v0 + S.land + 0.12, 735, FLOOR, { from: -500 });
    cups.forEach(c => pose(c.g, { x: c.x, y: FLOOR + 6, s: ease.outBack(P(t, v0 + c.d, 0.35), 2.4) }));
  });
}

// ---------- 3. Свадьба скоро ----------
// Коробка и крышка — отдельные группы: телевизор встаёт между ними.
function giftBox(parent) {
  const s = { stroke: C.ink, 'stroke-width': 9, 'stroke-linejoin': 'round' };
  const base = el('g', null, parent);
  el('rect', { x: -200, y: -220, width: 400, height: 220, rx: 18, fill: C.lemon, ...s }, base);
  el('rect', { x: -27, y: -220, width: 54, height: 220, fill: C.blue, stroke: C.ink, 'stroke-width': 6 }, base);
  const lid = el('g', null, parent);
  el('rect', { x: -220, y: -78, width: 440, height: 78, rx: 16, fill: C.lemon, ...s }, lid);
  el('rect', { x: -27, y: -78, width: 54, height: 78, fill: C.blue, stroke: C.ink, 'stroke-width': 6 }, lid);
  el('ellipse', { cx: -50, cy: -96, rx: 56, ry: 30, fill: C.blue, ...s, transform: 'rotate(-24 -50 -96)' }, lid);
  el('ellipse', { cx: 50, cy: -96, rx: 56, ry: 30, fill: C.blue, ...s, transform: 'rotate(24 50 -96)' }, lid);
  el('circle', { cx: 0, cy: -88, r: 20, fill: C.ink }, lid);
  return { base, lid };
}
function sceneWedding({ g }, v0) {
  question(g, ['Свадьба', 'скоро?'], v0);
  const shadow = el('ellipse', { cx: 540, cy: FLOOR + 4, rx: 200, ry: 20, fill: C.ink, opacity: 0.2, filter: 'url(#soft)' }, g);
  const box = giftBox(g);
  const tv = product(g, 'lg-tv', { w: 640 });
  show(tv.shadow, false);
  g.appendChild(box.lid);
  confetti(g, 540, FLOOR - 240, v0 + 0.5);
  sparkles(g, [[205, 760, 1], [880, 720, 1.3], [935, 1060, 0.8], [150, 1030, 0.9]], v0 + 0.9);
  on(t => {
    const vis = t > v0;
    show(box.base, vis); show(box.lid, vis); show(shadow, vis);
    const by = lerp(-500, FLOOR, ease.in2(P(t, v0 + 0.05, 0.23)));
    const sq = settle(P(t, v0 + 0.28, 0.5), 0.12, 20, 7);
    const sx = 1 + sq * 0.7, sy = 1 - sq;
    box.base.setAttribute('transform', `translate(540 ${by.toFixed(1)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)})`);
    // Крышка срывается и улетает, из коробки поднимается телевизор.
    const lp = P(t, v0 + 0.5, 0.6);
    const lx = 540 + lp * 280, ly = by - 220 * sy - 900 * ease.out3(lp) + 1000 * lp * lp;
    box.lid.setAttribute('transform', `translate(${lx.toFixed(1)} ${ly.toFixed(1)}) rotate(${(lp * 70).toFixed(2)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)})`);
    box.lid.setAttribute('opacity', 1 - P(lp, 0.7, 0.3));
    const tp = P(t, v0 + 0.52, 0.42);
    show(tv.g, tp > 0);
    const ty = lerp(FLOOR - 150, FLOOR - 222, ease.outBack(tp, 1.4));
    tv.g.setAttribute('transform', `translate(540 ${ty.toFixed(1)}) scale(${(0.25 + 0.75 * ease.outBack(tp, 1.6)).toFixed(4)})`);
  });
}

// ---------- 4. Переезд ----------
function cardboard(parent, w, h) {
  const g = el('g', null, parent);
  el('rect', { x: -w / 2, y: -h, width: w, height: h, rx: 10, fill: '#e2b97f', stroke: C.ink, 'stroke-width': 8, 'stroke-linejoin': 'round' }, g);
  el('rect', { x: -22, y: -h, width: 44, height: h * 0.42, fill: '#f2d9a8', stroke: C.ink, 'stroke-width': 5 }, g);
  el('line', { x1: -w / 2, y1: -h + 34, x2: w / 2, y2: -h + 34, stroke: C.ink, 'stroke-width': 5 }, g);
  const ax = w / 2 - 70, ay = -h * 0.42;
  [0, 26].forEach(dx => el('path', { d: `M${ax + dx} ${ay + 26}V${ay - 10}M${ax + dx - 10} ${ay}L${ax + dx} ${ay - 12}L${ax + dx + 10} ${ay}`, fill: 'none', stroke: C.ink, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g));
  return g;
}
function sceneMoving({ g }, v0) {
  question(g, ['Переезд?'], v0, { hl: C.white });
  const sh = el('ellipse', { cx: 330, cy: FLOOR + 4, rx: 170, ry: 18, fill: C.ink, opacity: 0.2, filter: 'url(#soft)' }, g);
  const b1 = cardboard(g, 330, 230), b2 = cardboard(g, 260, 180);
  const fridge = product(g, 'midea-fridge', { h: 560 });
  const micro = product(g, 'midea-micro', { h: 172 });
  on(t => {
    [[b1, 0.08, FLOOR], [b2, 0.2, FLOOR - 230]].forEach(([b, d, y]) => {
      const p = ease.outBack(P(t, v0 + d, 0.32), 1.3);
      show(b, t > v0);
      pose(b, { x: lerp(-300, 330, p), y, r: (1 - p) * -14 });
    });
    show(sh, t > v0 + 0.1);
    drop(fridge, t, v0 + 0.45, v0 + S.land, 795, FLOOR);
    drop(micro, t, v0 + 0.62, v0 + S.land + 0.14, 330, FLOOR - 410, { from: -500 });
    show(micro.shadow, false);
  });
}

// ---------- 5. Пыль везде ----------
function sceneDust({ g }, v0) {
  question(g, ['Пыль', 'везде?'], v0);
  const rnd = rng(21);
  const dust = Array.from({ length: 30 }, () => ({
    n: el('circle', { r: 10, fill: '#b9c2ce', opacity: 0.85 }, g),
    x: 170 + rnd() * 740, y: 780 + rnd() * 500, r: 14 + rnd() * 28, ph: rnd() * 6, d: rnd() * 0.25,
  }));
  const vac = product(g, 'uakeen', { h: 520 });
  sparkles(g, [[250, 900, 1.1], [460, 800, 0.8], [860, 860, 1], [330, 1180, 0.9]], v0 + 1.2);
  on(t => {
    const vx = lerp(1500, 650, ease.outExpo(P(t, v0 + 0.4, 0.4)));
    show(vac.g, t > v0 + 0.4); show(vac.shadow, t > v0 + 0.4);
    vac.g.setAttribute('transform', `translate(${vx.toFixed(1)} ${FLOOR}) rotate(${(Math.sin(t * 30) * 0.6).toFixed(2)})`);
    vac.shadow.setAttribute('transform', `translate(${vx.toFixed(1)} ${FLOOR + 4})`);
    const nx = vx + 135, ny = FLOOR - 26;
    dust.forEach(p => {
      const pin = ease.outBack(P(t, v0 + 0.02 + p.d * 0.6, 0.3), 2);
      const s = P(t, v0 + 0.6 + p.d, 0.55);
      const e = ease.in2(s);
      const x = lerp(p.x + Math.sin(t * 2.4 + p.ph) * 8, nx, e), y = lerp(p.y + Math.cos(t * 2 + p.ph) * 8, ny, e);
      show(p.n, t > v0 && s < 1);
      pose(p.n, { x, y, s: (p.r / 10) * pin * (1 - e) });
    });
  });
}

// ---------- 6. 3D-кухня: объясняем, что умеет конструктор ----------
function sceneKitchen({ g }, k0, src) {
  question(g, ['Новая', 'кухня?'], k0, { out: k0 + K.headline - 0.05 });
  // Заголовок и три пункта — тексты с главной страницы сайта.
  const head = el('g', null, g);
  const h1 = maskLine(head, 'Соберите в 3D', { x: 540, y: 318, size: 112, anchor: 'middle', ls: -0.045 });
  const w3d = measure('3D', 112, 800, -0.045);
  const mk = el('rect', { x: h1.x0 + h1.w - w3d - 14, y: 318 - 92, height: 116, rx: 22, fill: C.lemon }, head);
  head.insertBefore(mk, h1.g);
  const rows = [['по размерам ваших стен', K.f1], ['21 стиль фасадов', K.f2], ['техника из наличия — с ценой', K.f3]].map(([s, at], i) => {
    const y = 420 + i * 78, size = 46;
    const rw = measure(s, size, 700, -0.02) + 74, x = 540 - rw / 2;
    const r = el('g', null, g);
    const n = el('g', { transform: `translate(${x + 26} ${y - 16})` }, r);
    el('circle', { r: 26, fill: C.lemon, stroke: C.ink, 'stroke-width': 4 }, n);
    text(n, String(i + 1), { y: 11, 'font-size': 30, 'font-weight': 800, fill: C.ink, 'text-anchor': 'middle' });
    const ml = maskLine(r, s, { x: x + 74, y, size, weight: 700, ls: -0.02 });
    return { r, n, ml, at };
  });

  // Рисунок кухни с главной сайта: каждая строка файла — одна деталь.
  const lines = src.split('\n');
  const Kg = el('g', null, g);
  const groups = KITCHEN.map(k => ({ ...k, g: el('g') })).sort((a, b) => a.lines[0] - b.lines[0]);
  const parser = new DOMParser();
  const paintable = [];
  for (const grp of groups) {
    Kg.appendChild(grp.g);
    for (let ln = grp.lines[0]; ln <= grp.lines[1]; ln++) {
      const raw = lines[ln - 1].replace('url(#soft)', 'url(#kSoft)');
      const doc = parser.parseFromString(`<svg xmlns="${NS}">${raw}</svg>`, 'image/svg+xml');
      const node = document.importNode(doc.documentElement.firstElementChild, true);
      grp.g.appendChild(node);
      const fi = WOOD.indexOf(node.getAttribute('fill')), si = WOOD.indexOf(node.getAttribute('stroke'));
      if (fi >= 0 || si >= 0) paintable.push({ node, fi, si });
    }
    if (grp.kind === 'draw') {
      grp.strokes = [...grp.g.querySelectorAll('line')].filter(n => !n.getAttribute('stroke-dasharray')).map(n => {
        const len = Math.hypot(n.x2.baseVal.value - n.x1.baseVal.value, n.y2.baseVal.value - n.y1.baseVal.value);
        n.setAttribute('stroke-dasharray', len.toFixed(1));
        return { n, len };
      });
      grp.rest = [...grp.g.children].filter(n => !grp.strokes.some(s => s.n === n));
    }
  }
  const chips = [['A · 420 см', 739, 216], ['B · 220 см', 340, 146]].map(([str, x, y]) => {
    const c = el('g', null, Kg);
    const w = measure(str, 36, 800) + 46;
    el('rect', { x: -w / 2, y: -32, width: w, height: 64, rx: 32, fill: C.white, stroke: C.blue, 'stroke-width': 3 }, c);
    text(c, str, { y: 13, 'font-size': 36, 'font-weight': 800, fill: C.blue, 'text-anchor': 'middle' });
    return { c, x, y };
  });
  const KS = 0.8, KX = 540, KY = 1012;
  const toK = (x, y) => ({ x: KX + (x - 600) * KS, y: KY + (y - 480) * KS });
  // Ценник духовки и наклейка «Бесплатно».
  const oven = toK(590, 514);
  const leader = el('line', { x1: oven.x, y1: oven.y, stroke: C.blue, 'stroke-width': 4, 'stroke-dasharray': '10 9', 'stroke-linecap': 'round' }, g);
  const tag = el('g', null, g);
  el('rect', { x: 0, y: 0, width: 400, height: 132, rx: 28, fill: C.white, stroke: C.ink, 'stroke-width': 5, filter: 'url(#shCard)' }, tag);
  el('image', { href: 'assets/cutouts/midea-oven.png', x: 18, y: 16, width: 100, height: 100, preserveAspectRatio: 'xMidYMid meet' }, tag);
  text(tag, 'Духовка MIDEA', { x: 134, y: 54, 'font-size': 28, 'font-weight': 700, fill: C.inkSoft });
  text(tag, '25 500 сом', { x: 134, y: 104, 'font-size': 44, 'font-weight': 800, fill: C.ink, 'letter-spacing': '-0.02em' });
  const TAG = { x: 70, y: 1188 };
  const free = el('g', null, g);
  const star = Array.from({ length: 28 }, (_, i) => { const a = (i / 28) * Math.PI * 2, r = i % 2 ? 128 : 150; return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`; }).join(' ');
  el('polygon', { points: star, fill: C.lemon, stroke: C.ink, 'stroke-width': 6, 'stroke-linejoin': 'round' }, free);
  text(free, 'Бесплатно', { y: -2, 'font-size': 40, 'font-weight': 800, fill: C.ink, 'text-anchor': 'middle', 'letter-spacing': '-0.02em' });
  text(free, 'чертёж', { y: 34, 'font-size': 26, 'font-weight': 700, fill: C.ink, 'text-anchor': 'middle' });
  text(free, 'для мебельщика', { y: 62, 'font-size': 22, 'font-weight': 700, fill: C.ink, 'text-anchor': 'middle' });

  on(t => {
    const r = t - k0;
    h1.set(P(r, K.headline, 0.6));
    mk.setAttribute('width', (w3d + 28) * ease.outExpo(P(r, K.headline + 0.35, 0.4)));
    rows.forEach(row => {
      const p = P(r, row.at, 0.55);
      row.ml.set(p);
      show(row.n, p > 0);
      row.n.setAttribute('opacity', ease.out3(P(r, row.at, 0.25)));
    });
    Kg.setAttribute('transform', `translate(${KX} ${KY}) scale(${KS}) translate(-600 -480)`);
    for (const grp of groups) {
      const p = P(r, grp.t, grp.d);
      if (grp.kind === 'fade') grp.g.setAttribute('opacity', p);
      else if (grp.kind === 'rise') pose(grp.g, { y: (1 - ease.outExpo(p)) * grp.dy, o: p * 2.5 });
      else if (grp.kind === 'drop') pose(grp.g, { y: (1 - ease.in2(p)) * grp.dy + settle(P(r, grp.t + grp.d, 0.35), 6, 24, 7), o: p * 4 });
      else if (grp.kind === 'pop') {
        const s = ease.outBack(p, 2);
        grp.g.setAttribute('transform', `translate(${grp.cx} ${grp.cy}) scale(${s.toFixed(4)}) translate(${-grp.cx} ${-grp.cy})`);
        grp.g.setAttribute('opacity', clamp(p * 3));
      } else {
        const e = ease.out3(p);
        grp.g.setAttribute('opacity', p > 0 ? 1 : 0);
        grp.strokes.forEach(s => s.n.setAttribute('stroke-dashoffset', (s.len * (1 - e)).toFixed(1)));
        grp.rest.forEach(n => n.setAttribute('opacity', P(r, grp.t + grp.d * 0.6, grp.d * 0.6)));
      }
    }
    chips.forEach((c, i) => {
      const p = P(r, K.f1 + 0.2 + i * 0.1, 0.4);
      pose(c.c, { x: c.x, y: c.y, s: ease.outBack(p, 2.2), o: p * 3 });
    });
    // «21 стиль»: фасады меняют цвет прямо на рисунке — белые, шалфей, снова дерево.
    const step = r < K.f2 ? 0 : r < K.f2 + 0.25 ? 1 : r < K.f2 + 0.5 ? 2 : 0;
    const prevStep = r < K.f2 + 0.25 ? 0 : r < K.f2 + 0.5 ? 1 : 2;
    const swap = [K.f2, K.f2 + 0.25, K.f2 + 0.5].filter(a => r >= a).pop();
    const k = swap === undefined ? 1 : ease.out3(P(r, swap, 0.14));
    const from = PALETTES[swap === undefined ? 0 : prevStep], to = PALETTES[step];
    for (const pn of paintable) {
      if (pn.fi >= 0) pn.node.setAttribute('fill', mix(from[pn.fi], to[pn.fi], k));
      if (pn.si >= 0) pn.node.setAttribute('stroke', mix(from[pn.si], to[pn.si], k));
    }
    const pl = ease.out3(P(r, K.f3 + 0.05, 0.3));
    leader.setAttribute('x2', lerp(oven.x, TAG.x + 330, pl));
    leader.setAttribute('y2', lerp(oven.y, TAG.y + 10, pl));
    leader.setAttribute('opacity', pl > 0 ? 1 : 0);
    const pt = P(r, K.f3 + 0.2, 0.4);
    show(tag, pt > 0);
    pose(tag, { x: TAG.x, y: TAG.y + (1 - ease.outBack(pt, 1.8)) * 50, o: pt * 3 });
    const pf = P(r, K.free, 0.4);
    show(free, pf > 0);
    pose(free, { x: 905, y: 1228, s: ease.outBack(pf, 2.6), r: lerp(-30, 10, ease.outExpo(pf)) });
  });
}

// ---------- финал ----------
function sceneEnd({ g }, brand) {
  question(g, ['Нужна', 'техника?'], T.end, { hl: C.white, out: T.endShelf - 0.1 });
  const SHELF = [['hantaji', 130, 700, { h: 300 }], ['flagman', 318, 700, { h: 236 }], ['uakeen', 762, 700, { h: 226 }], ['midea-kettle', 962, 700, { h: 168 }], ['lg-tv', 540, 700, { w: 330 }]];
  const items = SHELF.map(([name, x, y, sz], i) => ({ p: product(g, name, sz), x, y, i }));
  const chipsStr = ['Доставка по всему Кыргызстану', 'Заказ 24/7'];
  const cw = chipsStr.map(s => measure(s, 32, 800) + 52), gap = 14;
  let cx = 540 - (cw[0] + cw[1] + gap) / 2;
  const chips = chipsStr.map((s, i) => {
    const c = el('g', null, g);
    el('rect', { x: cx, y: 1086, width: cw[i], height: 70, rx: 35, fill: i ? C.white : C.ink, stroke: C.ink, 'stroke-width': 4 }, c);
    text(c, s, { x: cx + cw[i] / 2, y: 1132, 'font-size': 32, 'font-weight': 800, fill: i ? C.ink : C.white, 'text-anchor': 'middle' });
    cx += cw[i] + gap;
    return c;
  });
  const apps = el('g', null, g);
  text(apps, 'Скачайте приложение', { x: 540, y: 1246, 'font-size': 36, 'font-weight': 800, fill: C.ink, 'text-anchor': 'middle', 'letter-spacing': '-0.02em' });
  const badges = [[brand.apple, IOS_LIVE ? 'Загрузите в' : 'Скоро в', 'App Store', 320], [brand.gplay, ANDROID_LIVE ? 'Доступно в' : 'Скоро в', 'Google Play', 760]].map(([d, small, name, x]) => {
    const b = el('g', null, g);
    el('rect', { x: -205, y: -60, width: 410, height: 120, rx: 26, fill: C.ink }, b);
    brandIcon(b, d, { x: -140, y: 0, size: 58 });
    text(b, small, { x: -94, y: -12, 'font-size': 24, 'font-weight': 600, fill: C.white, opacity: 0.85 });
    text(b, name, { x: -96, y: 34, 'font-size': 46, 'font-weight': 800, fill: C.white });
    return { b, x };
  });
  on(t => {
    items.forEach(it => {
      const p = P(t, T.endShelf + it.i * 0.08, 0.45);
      const vis = p > 0;
      show(it.p.g, vis); show(it.p.shadow, vis);
      const s = ease.outBack(p, 1.8);
      const bob = Math.sin(t * 2.2 + it.i) * 6 * P(t, T.endShelf + 0.6, 0.4);
      it.p.g.setAttribute('transform', `translate(${it.x} ${(it.y + (1 - s) * 80 + bob).toFixed(1)}) scale(${s.toFixed(4)})`);
      it.p.shadow.setAttribute('transform', `translate(${it.x} ${it.y + 4}) scale(${(0.6 * s).toFixed(3)})`);
    });
    chips.forEach((c, i) => {
      const p = ease.outBack(P(t, T.endChips + i * 0.12, 0.45), 1.8);
      pose(c, { x: 540 * (1 - p), y: 1121 * (1 - p), s: p, o: P(t, T.endChips + i * 0.12, 0.1) });
    });
    const pa = ease.outExpo(P(t, T.endApps - 0.1, 0.5));
    apps.firstChild.setAttribute('opacity', pa);
    badges.forEach((b, i) => {
      const p = P(t, T.endApps + i * 0.12, 0.45);
      pose(b.b, { x: b.x, y: 1350 + (1 - ease.outBack(p, 1.6)) * 60, o: p * 3 });
    });
  });
}
