// «Угадайте цену» — 24-секундный ролик-телеигра 1080×1920, целиком в одном SVG.
// Три товара с сайта: подиум, три варианта, таймер «3-2-1», правильный ответ и звуковой знак smarket.kg.
// Зритель пишет догадку в комментариях — так ролик досматривают до конца.
import { ROUNDS, R, T, PULSES, IOS_LIVE, ANDROID_LIVE } from './quiz.timeline.mjs';
import {
  W, C, el, text, initSvg, loadFonts, preloadImages, clamp, lerp, P, ease, settle, pose, show,
  money, measure, maskLine, buildMark, brandIcon, icon, rng, mix,
} from './lib.js';

const CUT = { flagman: 762 / 879, 'midea-kettle': 756 / 964, 'lg-tv': 1070 / 688, hantaji: 375 / 998, uakeen: 1056 / 1058 };
const POD = { x: 540, y: 905 }; // верх подиума
const OPT_Y = [1150, 1285, 1420];
const TIMER = { x: 905, y: 430 };

const tracks = [];
const on = fn => tracks.push(fn);

export async function start(stage) {
  const { svg, defs } = initSvg(stage);
  const f = (id, box = ['-40%', '-40%', '180%', '180%']) => el('filter', { id, x: box[0], y: box[1], width: box[2], height: box[3] }, defs);
  el('feGaussianBlur', { stdDeviation: 12 }, f('soft'));
  el('feDropShadow', { dx: 0, dy: 14, stdDeviation: 16, 'flood-color': C.ink, 'flood-opacity': 0.2 }, f('sh'));
  const spot = el('radialGradient', { id: 'spot' }, defs);
  el('stop', { offset: 0, 'stop-color': '#ffffff', 'stop-opacity': 0.85 }, spot);
  el('stop', { offset: 1, 'stop-color': '#ffffff', 'stop-opacity': 0 }, spot);
  await loadFonts();
  const brand = await fetch('assets/brand-icons.json').then(r => r.json());

  el('rect', { width: W, height: 1920, fill: C.lemon }, svg);
  const burst = sunburst(svg);
  const world = el('g', null, svg);
  el('circle', { cx: 540, cy: 690, r: 560, fill: 'url(#spot)' }, world);
  const podium = buildPodium(world);
  const rounds = ROUNDS.map((r, i) => buildRound(world, r, i));
  const header = buildHeader(svg);
  const intro = buildIntro(svg);
  buildEnd(svg, brand);

  const hits = [0, ...ROUNDS.map(r => r.t + R.land), ...ROUNDS.map(r => r.t + R.reveal), T.endPill + 0.35];
  on(t => {
    let dx = 0, dy = 0;
    for (const h of hits) {
      const d = t - h;
      if (d > 0 && d < 0.35) { const a = 10 * Math.exp(-14 * d); dx += a * Math.sin(d * 95); dy += a * Math.cos(d * 80); }
    }
    world.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)})`);
    burst(t);
    const pv = t > ROUNDS[0].t - 0.2 && t < T.end + 0.3;
    show(podium, pv);
    const pin = ease.outBack(P(t, ROUNDS[0].t - 0.15, 0.45), 1.5), pout = ease.inOut3(P(t, T.end - 0.2, 0.4));
    pose(podium, { x: 0, y: (1 - pin) * 700 + pout * 900 });
    rounds.forEach(rd => rd(t));
    header(t);
    intro(t);
  });
  await preloadImages(svg);
  window.seek = seek;
  seek(0);
}

export function seek(t) {
  for (const fn of tracks) fn(t);
}

// ---------- фон телеигры: лучи и подиум ----------
function sunburst(svg) {
  const g = el('g', null, svg);
  const n = 28;
  for (let i = 0; i < n; i += 2) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    el('path', { d: `M0 0L${Math.cos(a0) * 2000} ${Math.sin(a0) * 2000}L${Math.cos(a1) * 2000} ${Math.sin(a1) * 2000}Z`, fill: '#ffffff', opacity: 0.2 }, g);
  }
  // Лучи медленно вращаются; на сменах раунда — резкий доворот.
  const kicks = [...ROUNDS.map(r => r.t - 0.1), T.end - 0.1];
  return t => {
    let a = t * 7;
    for (const k of kicks) a += 40 * ease.inOut3(P(t, k, 0.6));
    g.setAttribute('transform', `translate(540 690) rotate(${a.toFixed(2)})`);
  };
}
function buildPodium(parent) {
  const g = el('g', null, parent);
  const { x, y } = POD;
  el('path', { d: `M${x - 310} ${y}V${y + 70}A310 64 0 0 0 ${x + 310} ${y + 70}V${y}Z`, fill: C.ink }, g);
  el('ellipse', { cx: x, cy: y, rx: 310, ry: 64, fill: C.white, stroke: C.ink, 'stroke-width': 8 }, g);
  el('ellipse', { cx: x, cy: y, rx: 250, ry: 46, fill: 'none', stroke: C.lemon, 'stroke-width': 8 }, g);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.12 + i * 0.095);
    el('circle', { cx: x - Math.cos(a) * 300, cy: y + 70 + Math.sin(a) * 60, r: 9, fill: C.lemon }, g);
  }
  return g;
}
function bulbs(parent, x, y, w, h, step = 62) {
  const pts = [];
  for (let px = x + 30; px <= x + w - 30; px += step) { pts.push([px, y]); pts.push([px, y + h]); }
  for (let py = y + 30 + step; py <= y + h - 30; py += step) { pts.push([x, py]); pts.push([x + w, py]); }
  const ns = pts.map(([cx, cy], i) => ({ n: el('circle', { cx, cy, r: 12, stroke: C.ink, 'stroke-width': 3.5 }, parent), i }));
  return t => ns.forEach(b => b.n.setAttribute('fill', (Math.floor(t * 5) + b.i) % 2 ? C.lemon : C.white));
}

// ---------- шапка: «Угадайте цену · 1/3» ----------
function buildHeader(svg) {
  const g = el('g', null, svg);
  const labels = ROUNDS.map((_, i) => `Угадайте цену · ${i + 1}/3`);
  const w = measure(labels[0], 36, 800) + 70;
  el('rect', { x: -w / 2, y: -38, width: w, height: 76, rx: 38, fill: C.ink }, g);
  const lab = text(g, labels[0], { y: 13, 'font-size': 36, 'font-weight': 800, fill: C.lemon, 'text-anchor': 'middle' });
  return t => {
    const vis = t > ROUNDS[0].t - 0.2 && t < T.end;
    show(g, vis);
    const k = ROUNDS.filter(r => t >= r.t - 0.1).length - 1;
    lab.textContent = labels[Math.max(0, k)];
    const p = ease.outBack(P(t, ROUNDS[0].t - 0.15, 0.4), 2);
    const pop = 1 + settle(P(t, ROUNDS[Math.max(0, k)].t - 0.1, 0.5), 0.1, 18, 6);
    pose(g, { x: 540, y: 170, s: p * pop, o: 1 - P(t, T.end - 0.25, 0.25) });
  };
}

// ---------- раунд ----------
function buildRound(parent, r, idx) {
  const g = el('g', null, parent);
  // Товар на подиуме.
  const ratio = CUT[r.img], ph = r.h ?? r.w / ratio, pw = r.w ?? r.h * ratio;
  const shadow = el('ellipse', { cx: 0, cy: 0, rx: pw * 0.42, ry: 20, fill: C.ink, opacity: 0.22, filter: 'url(#soft)' }, g);
  const prod = el('g', null, g);
  el('image', { href: `assets/cutouts/${r.img}.png`, x: -pw / 2, y: -ph, width: pw, height: ph }, prod);
  // Название.
  const nameG = el('g', null, g);
  const nw = measure(r.name, 38, 800, -0.01) + 64;
  el('rect', { x: -nw / 2, y: -36, width: nw, height: 72, rx: 36, fill: C.white, stroke: C.ink, 'stroke-width': 5 }, nameG);
  text(nameG, r.name, { y: 13, 'font-size': 38, 'font-weight': 800, fill: C.ink, 'text-anchor': 'middle', 'letter-spacing': '-0.01em' });
  // Варианты A/B/C.
  const opts = r.options.map((v, i) => {
    const o = el('g', null, g);
    const body = el('rect', { x: -430, y: -56, width: 860, height: 112, rx: 56, fill: C.white, stroke: C.ink, 'stroke-width': 6 }, o);
    const disc = el('circle', { cx: -366, cy: 0, r: 38, fill: C.lemon, stroke: C.ink, 'stroke-width': 5 }, o);
    const letter = text(o, 'ABC'[i], { x: -366, y: 15, 'font-size': 42, 'font-weight': 800, fill: C.ink, 'text-anchor': 'middle' });
    const ck = icon(o, 'check', { x: -366, y: 0, size: 44, sw: 3.2, color: C.green });
    const label = `${money(v)} сом`;
    const price = text(o, label, { x: -296, y: 23, 'font-size': 64, 'font-weight': 800, fill: C.ink, 'letter-spacing': '-0.02em' });
    const pwid = measure(label, 64, 800, -0.02);
    const extra = el('g', null, o);
    if (i === r.answer && r.off) {
      el('rect', { x: 300, y: -30, width: 108, height: 60, rx: 30, fill: C.red }, extra);
      text(extra, `−${r.off}%`, { x: 354, y: 12, 'font-size': 32, 'font-weight': 800, fill: C.white, 'text-anchor': 'middle' });
    }
    let strike = null, oldNote = null;
    if (r.old && v === r.old && i !== r.answer) {
      strike = el('line', { x1: -306, y1: 2, x2: -306, y2: 2, stroke: C.red, 'stroke-width': 9, 'stroke-linecap': 'round' }, o);
      oldNote = text(o, 'до скидки', { x: 404, y: 12, 'font-size': 32, 'font-weight': 800, fill: C.red, 'text-anchor': 'end' });
    }
    return { o, body, disc, letter, ck, price, pwid, extra, strike, oldNote, i };
  });
  // Таймер «3-2-1»; в конце он становится знаком «S» — ответ всегда на smarket.kg.
  const timer = el('g', null, g);
  el('circle', { r: 78, fill: C.white, stroke: C.ink, 'stroke-width': 7 }, timer);
  const arc = el('circle', { r: 62, fill: 'none', stroke: C.lemon, 'stroke-width': 18, transform: 'rotate(-90)', 'stroke-dasharray': `${2 * Math.PI * 62}` }, timer);
  const num = text(timer, '3', { y: 26, 'font-size': 76, 'font-weight': 800, fill: C.ink, 'text-anchor': 'middle' });
  const badge = el('g', null, timer);
  el('circle', { r: 78, fill: C.lemon, stroke: C.ink, 'stroke-width': 7 }, badge);
  buildMark(badge, C.ink).setAttribute('transform', 'translate(-26 -47) scale(0.94)');
  // Конфетти от правильного ответа.
  const conf = el('g', null, g);
  const rnd = rng(13 + idx);
  const bits = Array.from({ length: 40 }, (_, i) => {
    const b = el('rect', { x: -11, y: -6, width: 22, height: 12, rx: 3, fill: [C.lemon, C.blue, C.red, C.green, C.white][i % 5], stroke: C.ink, 'stroke-width': 2.5 }, conf);
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6;
    return { b, vx: Math.cos(a) * (400 + rnd() * 700), vy: Math.sin(a) * (800 + rnd() * 700), spin: (rnd() - 0.5) * 1200 };
  });

  return t => {
    const r0 = r.t, rel = t - r0;
    const vis = rel > -0.2 && rel < R.out + 0.6;
    show(g, vis);
    if (!vis) return;
    const out = ease.inOut3(P(rel, R.out, 0.5));
    const ox = -1250 * out;
    // Товар падает на подиум, потом медленно «дышит».
    const fall = P(rel, 0.15, R.land - 0.15);
    const y = lerp(-800, POD.y, ease.in2(fall));
    const sq = settle(P(rel, R.land, 0.55), 0.13, 20, 7);
    const breathe = 1 + 0.012 * Math.sin(t * 3) * P(rel, R.land + 0.5, 0.5);
    show(prod, rel > 0.15);
    prod.setAttribute('transform', `translate(${(POD.x + ox).toFixed(1)} ${y.toFixed(1)}) rotate(${(-out * 18).toFixed(2)}) scale(${((1 + sq * 0.7) * breathe).toFixed(4)} ${((1 - sq) * breathe).toFixed(4)})`);
    const near = clamp(1 - (POD.y - y) / 900);
    shadow.setAttribute('transform', `translate(${POD.x + ox} ${POD.y + 2}) scale(${(0.3 + 0.7 * near).toFixed(3)})`);
    shadow.setAttribute('opacity', (0.24 * near * (1 - out)).toFixed(3));
    const pn = ease.outBack(P(rel, R.name, 0.4), 1.8);
    pose(nameG, { x: 540 + ox, y: 1028 + (1 - pn) * 50, s: 0.9 + 0.1 * pn, o: P(rel, R.name, 0.1) });

    const rv = P(rel, R.reveal, 0.35);
    opts.forEach(op => {
      const pin = ease.outBack(P(rel, R.options + op.i * 0.12, 0.45), 1.4);
      const right = op.i === r.answer;
      const shake = right ? 0 : Math.sin((rel - R.reveal) * 60) * 14 * Math.exp(-6 * Math.max(0, rel - R.reveal)) * (rel > R.reveal ? 1 : 0);
      const pulse = right ? 1 + settle(P(rel, R.reveal, 0.6), 0.08, 18, 6) : 1;
      pose(op.o, { x: 540 + (1 - pin) * 1100 + ox + shake, y: OPT_Y[op.i], s: pulse, o: right ? 1 : 1 - 0.55 * rv });
      op.body.setAttribute('fill', right ? mix(C.white, C.green, rv) : C.white);
      op.body.setAttribute('stroke', right ? mix(C.ink, '#157a45', rv) : C.ink);
      op.price.setAttribute('fill', right ? mix(C.ink, C.white, rv) : C.ink);
      op.disc.setAttribute('fill', right ? mix(C.lemon, C.white, rv) : C.lemon);
      op.letter.setAttribute('opacity', right ? 1 - rv : 1);
      op.ck.setAttribute('opacity', right ? rv : 0);
      op.extra.setAttribute('opacity', ease.out3(P(rel, R.reveal + 0.25, 0.3)));
      if (op.strike) {
        const ps = ease.out3(P(rel, R.reveal + 0.35, 0.3));
        op.strike.setAttribute('x2', (-306 + (op.pwid + 20) * ps).toFixed(1));
        op.strike.setAttribute('opacity', ps > 0 ? 1 : 0);
        op.oldNote.setAttribute('opacity', P(rel, R.reveal + 0.5, 0.3));
      }
    });
    // Таймер: дуга убывает, цифры 3-2-1, в ноль — превращается в «S».
    const tp = P(rel, R.timer - 0.15, 0.3);
    show(timer, tp > 0);
    const tl = P(rel, R.timer, R.timerLen);
    arc.setAttribute('stroke-dashoffset', (2 * Math.PI * 62 * tl).toFixed(1));
    const sec = Math.min(2, Math.floor(tl * 3));
    num.textContent = String(3 - sec);
    const tick = R.timer + sec * (R.timerLen / 3);
    const flip = ease.outBack(P(rel, R.reveal - 0.05, 0.4), 2);
    badge.setAttribute('opacity', P(rel, R.reveal - 0.05, 0.08));
    badge.setAttribute('transform', `scale(${(0.6 + 0.4 * flip).toFixed(4)}) rotate(${((1 - flip) * -120).toFixed(2)})`);
    pose(timer, { x: TIMER.x + ox, y: TIMER.y, s: ease.outBack(tp, 2) * (1 + settle(P(rel, tick, 0.4), 0.12, 18, 6)) });
    const cb = rel - R.reveal;
    show(conf, cb > 0 && cb < 1.5);
    if (cb > 0 && cb < 1.5) bits.forEach(k => pose(k.b, { x: 540 + k.vx * cb, y: OPT_Y[r.answer] - 40 + k.vy * cb + 1500 * cb * cb, r: k.spin * cb, o: 1 - P(cb, 1.0, 0.5) }));
  };
}

// ---------- заставка ----------
function buildIntro(svg) {
  const g = el('g', null, svg);
  const panel = el('g', null, g);
  el('rect', { x: 90, y: 470, width: 900, height: 560, rx: 60, fill: C.white, stroke: C.ink, 'stroke-width': 9 }, panel);
  const lights = bulbs(panel, 90, 470, 900, 560);
  const l1 = maskLine(panel, 'Угадайте', { x: 540, y: 715, size: 158, anchor: 'middle', ls: -0.045 });
  const w2 = measure('цену', 190, 800, -0.045);
  const mk = el('rect', { x: 540 - w2 / 2 - 22, y: 860, height: 96, rx: 20, fill: C.lemon }, panel);
  const l2 = maskLine(panel, 'цену', { x: 540, y: 922, size: 190, anchor: 'middle', ls: -0.045 });
  const sub = maskLine(g, '3 товара с smarket.kg', { x: 540, y: 1160, size: 54, weight: 800, anchor: 'middle', ls: -0.02 });
  const cta = el('g', null, g);
  const cs = 'Пишите ответы в комментариях', cw = measure(cs, 40, 700) + 60;
  icon(cta, 'chat', { x: 540 - cw / 2 + 22, y: -13, size: 40, sw: 2.2 });
  text(cta, cs, { x: 540 - cw / 2 + 60, y: 0, 'font-size': 40, 'font-weight': 700, fill: C.inkSoft });
  return t => {
    const vis = t < ROUNDS[0].t + 0.1;
    show(g, vis);
    if (!vis) return;
    const pin = ease.outBack(P(t, 0, 0.45), 1.7);
    const pout = ease.inOut3(P(t, ROUNDS[0].t - 0.35, 0.4));
    const s = pin * (1 + pout * 0.25);
    pose(panel, { x: 540 * (1 - s), y: 750 * (1 - s), s, o: 1 - pout });
    lights(t);
    l1.set(P(t, 0.1, 0.55));
    l2.set(P(t, 0.22, 0.55));
    mk.setAttribute('width', (w2 + 44) * ease.outExpo(P(t, 0.45, 0.4)));
    sub.set(P(t, 0.7, 0.55), P(t, ROUNDS[0].t - 0.35, 0.3));
    const pc = ease.outBack(P(t, T.cta, 0.45), 1.8);
    pose(cta, { y: 1262 + (1 - pc) * 40, o: P(t, T.cta, 0.15) * (1 - pout) });
  };
}

// ---------- финал ----------
function buildEnd(svg, brand) {
  const g = el('g', null, svg);
  const panel = el('g', null, g);
  el('rect', { x: 80, y: 300, width: 920, height: 330, rx: 50, fill: C.white, stroke: C.ink, 'stroke-width': 8 }, panel);
  const lights = bulbs(panel, 80, 300, 920, 330, 64);
  const q = maskLine(panel, 'Сколько угадали?', { x: 540, y: 470, size: 84, anchor: 'middle', ls: -0.04 });
  const cm = maskLine(panel, 'Пишите в комментариях', { x: 540, y: 556, size: 44, weight: 700, fill: C.inkSoft, anchor: 'middle' });
  // Адресная строка — та же, что в ролике «Запомните один адрес».
  const pill = el('g', null, g);
  const tw = measure('smarket.kg', 92, 800, -0.035), pw = 22 + 104 + 24 + tw + 50, ph = 148;
  const ring = el('rect', { x: -pw / 2, y: -ph / 2, width: pw, height: ph, rx: ph / 2, fill: 'none', stroke: C.ink, 'stroke-width': 6 }, pill);
  el('rect', { x: -pw / 2, y: -ph / 2, width: pw, height: ph, rx: ph / 2, fill: C.white, stroke: C.ink, 'stroke-width': 6, filter: 'url(#sh)' }, pill);
  const x0 = -pw / 2 + 22;
  el('circle', { cx: x0 + 52, cy: 0, r: 52, fill: C.lemon, stroke: C.ink, 'stroke-width': 5 }, pill);
  buildMark(pill, C.ink).setAttribute('transform', `translate(${x0 + 52 - 17.9} -32) scale(0.64)`);
  text(pill, 'smarket.kg', { x: x0 + 150, y: 32, 'font-size': 92, 'font-weight': 800, fill: C.ink, 'letter-spacing': '-0.035em' });
  const caret = el('rect', { x: x0 + 150 + tw + 8, y: -40, width: 7, height: 80, rx: 3, fill: C.blue }, pill);
  const all = maskLine(g, 'Все цены — на smarket.kg', { x: 540, y: 1080, size: 50, weight: 800, anchor: 'middle', ls: -0.02 });
  const chipsStr = ['Доставка по всему Кыргызстану', 'Заказ 24/7'];
  const cw = chipsStr.map(s => measure(s, 32, 800) + 52), gap = 14;
  let cx = 540 - (cw[0] + cw[1] + gap) / 2;
  const chips = chipsStr.map((s, i) => {
    const c = el('g', null, g);
    el('rect', { x: cx, y: 1136, width: cw[i], height: 70, rx: 35, fill: i ? C.white : C.ink, stroke: C.ink, 'stroke-width': 4 }, c);
    text(c, s, { x: cx + cw[i] / 2, y: 1182, 'font-size': 32, 'font-weight': 800, fill: i ? C.ink : C.white, 'text-anchor': 'middle' });
    cx += cw[i] + gap;
    return c;
  });
  const appsT = text(g, 'Скачайте приложение', { x: 540, y: 1292, 'font-size': 36, 'font-weight': 800, fill: C.ink, 'text-anchor': 'middle', 'letter-spacing': '-0.02em' });
  const badges = [[brand.apple, IOS_LIVE ? 'Загрузите в' : 'Скоро в', 'App Store', 320], [brand.gplay, ANDROID_LIVE ? 'Доступно в' : 'Скоро в', 'Google Play', 760]].map(([d, small, name, x]) => {
    const b = el('g', null, g);
    el('rect', { x: -205, y: -60, width: 410, height: 120, rx: 26, fill: C.ink }, b);
    brandIcon(b, d, { x: -140, y: 0, size: 58 });
    text(b, small, { x: -94, y: -12, 'font-size': 24, 'font-weight': 600, fill: C.white, opacity: 0.85 });
    text(b, name, { x: -96, y: 34, 'font-size': 46, 'font-weight': 800, fill: C.white });
    return { b, x };
  });
  on(t => {
    const vis = t > T.end - 0.05;
    show(g, vis);
    if (!vis) return;
    const pp = ease.outBack(P(t, T.endQ, 0.45), 1.6);
    pose(panel, { x: 540 * (1 - pp), y: 465 * (1 - pp), s: pp });
    lights(t);
    q.set(P(t, T.endQ + 0.1, 0.55));
    cm.set(P(t, T.endQ + 0.3, 0.55));
    const slam = ease.outExpo(P(t, T.endPill, 0.35));
    const last = PULSES[PULSES.length - 1];
    const s = lerp(2.4, 1.18, slam) * (1 + settle(P(t, last, 0.6), 0.12, 18, 6));
    show(pill, t > T.endPill);
    pose(pill, { x: 540, y: 880, s, o: P(t, T.endPill, 0.08) });
    const rp = P(t, last, 0.55);
    ring.setAttribute('transform', `scale(${(1 + 0.32 * ease.out3(rp)).toFixed(4)})`);
    ring.setAttribute('opacity', rp > 0 && rp < 1 ? (0.5 * (1 - rp)).toFixed(3) : 0);
    caret.setAttribute('opacity', Math.floor(t * 2.5) % 2 === 0 ? 1 : 0);
    all.set(P(t, T.endPill + 0.45, 0.55));
    chips.forEach((c, i) => {
      const p = ease.outBack(P(t, T.endChips + i * 0.12, 0.45), 1.8);
      pose(c, { x: 540 * (1 - p), y: 1171 * (1 - p), s: p, o: P(t, T.endChips + i * 0.12, 0.1) });
    });
    appsT.setAttribute('opacity', ease.out3(P(t, T.endApps - 0.1, 0.4)));
    badges.forEach((b, i) => {
      const p = P(t, T.endApps + i * 0.12, 0.45);
      pose(b.b, { x: b.x, y: 1400 + (1 - ease.outBack(p, 1.6)) * 60, o: p * 3 });
    });
  });
}
