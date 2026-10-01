// «Как заказать на smarket.kg» — 30-секундный ролик 1080×1920, целиком в одном SVG.
// Покупатель листает каталог, сомневается между двумя машинками, спрашивает консультанта
// и оформляет заказ. Экраны повторяют сайт: тексты, цены и кнопки взяты с smarket.kg.
// seek(t) рисует кадр для момента t (секунды): одно и то же t даёт один и тот же кадр.
import { T, CAPTIONS, STEPS, IOS_LIVE, ANDROID_LIVE } from './order.timeline.mjs';
import {
  W, H, C, el, text, initSvg, loadFonts, preloadImages, clamp, lerp, P, bump, ease, settle, pose, show, money, mix, rng,
  measure, wrap, icon, clipRect, rrect, maskLine, buildMark,
} from './lib.js';

const SW = 390, SH = 844; // экран телефона в pt

// Каталог «Стиральные машины» — товары, цены и фото с сайта (на 01.10.2026).
const GRID = [
  { img: 'lg-8w', name: ['Стиральная машина', 'LG F2V3PS6W 8 кг'], price: 34900 },
  { img: 'toshiba-8', name: ['Стиральная машина', 'TOSHIBA TW-BN90C4'], price: 38500 },
  { img: 'levo-wash', name: ['Стиральная машина', 'LEVO LV-70DG2T'], price: 24800, old: 27900 },
  { img: 'lg-8b', name: ['Стиральная машина', 'LG F2V5PS2S 8 кг'], price: 38500, old: 41500 },
  { img: 'hisense', name: ['Стиральная машина', 'HISENSE WFQA9014'], price: 38100 },
  { img: 'levo-lux', name: ['Стиральная машина', 'LEVO LV-80LUX-T'], price: 31900, old: 35500 },
  { img: 'lg-wash', name: ['Стиральная машина', 'LG F2V3FS4W 9 кг'], price: 37900, old: 42300 },
  { img: 'flagman', name: ['Стиральная машина', 'FLAGMAN AV-80 8 кг'], price: 21400, old: 28500 },
  { img: 'toshiba-9', name: ['Стиральная машина', 'TOSHIBA TW-BK100GF4'], price: 39500 },
  { img: 'lg-8w0', name: ['Стиральная машина', 'LG F2V5PS0W 8 кг'], price: 37200 },
];
const A = 6, B = 7; // LG 9 кг и FLAGMAN 8 кг — между ними выбирает покупатель
const ROW0 = 262, PITCH = 318, CW = 171, CH = 302;
const cardXY = i => ({ x: 16 + (i % 2) * (CW + 16), y: ROW0 + Math.floor(i / 2) * PITCH });
const SCROLL = [0, 560, ROW0 + 3 * PITCH - 160];
const QUESTION = 'Нас 6 человек. LG на 9 кг или FLAGMAN на 8 кг?';
const ANSWER = 'Для 6 человек берите LG на 9 кг: барабан больше, мотор с прямым приводом, есть пар. FLAGMAN на 8 кг дешевле на 16 500 сом.';
const NAME = 'Азизов Азиз', PHONE = '+996 700 000 000', ADDR = 'г. Ош, ул. Ленина';

// ---------- сборка ----------
const tracks = [];
const on = fn => tracks.push(fn);

export async function start(stage) {
  const { svg, defs } = initSvg(stage);
  const filter = (id, box = ['-30%', '-30%', '160%', '170%']) => el('filter', { id, x: box[0], y: box[1], width: box[2], height: box[3] }, defs);
  el('feDropShadow', { dx: 0, dy: 18, stdDeviation: 22, 'flood-color': C.ink, 'flood-opacity': 0.16 }, filter('shCard'));
  el('feDropShadow', { dx: 0, dy: 4, stdDeviation: 6, 'flood-color': C.ink, 'flood-opacity': 0.12 }, filter('shSoft'));
  el('feDropShadow', { dx: 0, dy: 40, stdDeviation: 46, 'flood-color': C.ink, 'flood-opacity': 0.26 }, filter('shPhone', ['-20%', '-10%', '140%', '125%']));
  const blurNode = el('feGaussianBlur', { stdDeviation: 0 }, filter('blurPhone', ['-5%', '-5%', '110%', '110%']));
  const glow = el('radialGradient', { id: 'glow' }, defs);
  el('stop', { offset: 0, 'stop-color': C.lemon, 'stop-opacity': 0.42 }, glow);
  el('stop', { offset: 1, 'stop-color': C.lemon, 'stop-opacity': 0 }, glow);
  const fade = el('linearGradient', { id: 'topFade', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  [[0, 1], [0.72, 1], [1, 0]].forEach(([o, a]) => el('stop', { offset: o, 'stop-color': C.bg, 'stop-opacity': a }, fade));

  await loadFonts();

  el('rect', { width: W, height: H, fill: C.bg }, svg);
  const bgGlow = el('circle', { cx: 540, cy: 1180, r: 760, fill: 'url(#glow)' }, svg);
  const phone = buildPhone(svg);
  const stageFx = el('g', null, svg);
  const top = el('g', null, svg);
  const topFade = el('rect', { width: W, height: 560, fill: 'url(#topFade)' }, top);
  const hand = buildHand(svg);
  const hook = el('g', null, svg);
  const endG = el('g', null, svg);

  const cam = camera();
  const screens = buildScreens(phone.screen);
  const fx = buildHesitation(stageFx, cam);
  buildTop(top, hook);
  buildEnd(endG);
  on(t => {
    const c = cam(t);
    pose(phone.g, { x: c.cx - c.fx * c.k, y: c.cy - c.fy * c.k, s: c.k });
    const b = fx.blur(t) / c.k;
    blurNode.setAttribute('stdDeviation', b.toFixed(2));
    if (b > 0.01) phone.blurG.setAttribute('filter', 'url(#blurPhone)');
    else phone.blurG.removeAttribute('filter');
    phone.g.setAttribute('opacity', (1 - 0.35 * fx.dim(t)).toFixed(3));
    show(phone.g, t > T.toPhone - 0.05);
    bgGlow.setAttribute('opacity', P(t, T.toPhone, 0.8));
    topFade.setAttribute('opacity', P(t, T.toPhone, 0.5) * (1 - P(t, T.end, 0.4)));
  });
  driveHand(hand, cam, screens);

  await preloadImages(svg);
  window.seek = seek;
  seek(0);
}

export function seek(t) {
  for (const fn of tracks) fn(t);
}

// ---------- камера: где телефон в кадре и насколько он крупный ----------
function camera() {
  const FULL = { fx: 195, fy: 0, cx: 540, cy: 468, k: 1.42 };
  const BACK = { fx: 195, fy: 0, cx: 540, cy: 520, k: 1.22 };
  const READ = { fx: 195, fy: 410, cx: 540, cy: 1010, k: 1.92 };
  const FORM1 = { fx: 195, fy: 330, cx: 540, cy: 1020, k: 1.86 };
  const FORM2 = { fx: 195, fy: 590, cx: 540, cy: 1060, k: 1.86 };
  const END = { fx: 195, fy: 0, cx: 540, cy: 1000, k: 1.0 };
  const LOW = { ...FULL, cy: FULL.cy + 1500 };
  const keys = [
    [0, LOW], [T.toPhone, LOW, 0.85, 'expo'], [T.toPhone + 0.85, FULL],
    [T.scaleIn, FULL, 0.6], [T.scaleIn + 0.6, BACK], [T.askFly, BACK, 0.6], [T.askFly + 0.6, FULL],
    [T.answer + 0.05, FULL, 0.6], [T.answer + 0.65, READ], [T.tapHit - 0.3, READ, 0.45], [T.tapHit + 0.15, FULL],
    [T.checkoutIn + 0.15, FULL, 0.5], [T.checkoutIn + 0.65, FORM1], [T.tapDelivery - 0.45, FORM1, 0.4], [T.tapDelivery - 0.05, FORM2],
    [T.scrollPay[0], FORM2, 0.5], [T.scrollPay[0] + 0.5, FULL], [T.end, FULL, 0.8], [T.end + 0.8, END],
  ];
  const mixCam = (a, b, p) => Object.fromEntries(Object.keys(a).map(k => [k, lerp(a[k], b[k], p)]));
  return t => {
    let cur = keys[0][1];
    for (let i = 0; i < keys.length; i++) {
      const [t0, v, dur, kind] = keys[i];
      if (t < t0) break;
      cur = v;
      if (dur && keys[i + 1] && t < t0 + dur) {
        const p = P(t, t0, dur);
        return mixCam(v, keys[i + 1][1], kind === 'expo' ? ease.outExpo(p) : ease.inOut3(p));
      }
    }
    return { ...cur };
  };
}
const toCanvas = (c, x, y) => ({ x: c.cx + (x - c.fx) * c.k, y: c.cy + (y - c.fy) * c.k });

// ---------- телефон ----------
function buildPhone(parent) {
  const g = el('g', null, parent);
  const blurG = el('g', null, g);
  el('rect', { x: -13, y: -13, width: SW + 26, height: SH + 26, rx: 64, fill: C.ink, filter: 'url(#shPhone)' }, blurG);
  el('rect', { x: -10, y: -10, width: SW + 20, height: SH + 20, rx: 61, fill: 'none', stroke: '#4b5b70', 'stroke-width': 1.5 }, blurG);
  [[-16, 150, 60], [-16, 222, 60]].forEach(([x, y, h]) => el('rect', { x, y, width: 4, height: h, rx: 2, fill: '#3a4556' }, blurG));
  el('rect', { x: SW + 12, y: 190, width: 4, height: 96, rx: 2, fill: '#3a4556' }, blurG);
  const screen = el('g', { 'clip-path': clipRect(0, 0, SW, SH, 52) }, blurG);
  el('rect', { width: SW, height: SH, fill: C.white }, screen);
  return { g, blurG, screen };
}
function statusBar(parent) {
  const g = el('g', null, parent);
  text(g, '9:41', { x: 40, y: 32, 'font-size': 15, 'font-weight': 800, fill: C.ink });
  el('rect', { x: 137, y: 11, width: 116, height: 33, rx: 16.5, fill: '#10151e' }, g);
  const r = el('g', { transform: 'translate(334 27)', fill: C.ink }, g);
  el('rect', { x: 0, y: -6.5, width: 23, height: 11.5, rx: 3.5, fill: 'none', stroke: C.ink, 'stroke-width': 1.5 }, r);
  el('rect', { x: 2.3, y: -4.2, width: 15, height: 7, rx: 1.6 }, r);
  [0, 1, 2, 3].forEach(i => el('rect', { x: -30 + i * 5.2, y: 3 - i * 2.8, width: 3.6, height: 3.5 + i * 2.8, rx: 1 }, r));
  return g;
}
function header(parent) {
  const m = buildMark(parent, C.ink);
  m.setAttribute('transform', 'translate(18 60) scale(0.27)');
  text(parent, 'Смарт Центр', { x: 40, y: 81, 'font-size': 20, 'font-weight': 800, fill: C.ink, 'letter-spacing': '-0.02em' });
  text(parent, 'RU', { x: 318, y: 80, 'font-size': 13, 'font-weight': 800, fill: C.ink });
  el('line', { x1: 342, y1: 69, x2: 342, y2: 83, stroke: C.border, 'stroke-width': 1.2 }, parent);
  text(parent, 'КЫР', { x: 350, y: 80, 'font-size': 13, 'font-weight': 600, fill: C.muted });
  el('rect', { x: 16, y: 100, width: 358, height: 42, rx: 12, fill: C.surface, stroke: C.border, 'stroke-width': 1 }, parent);
  icon(parent, 'search', { x: 38, y: 121, size: 17, color: C.muted, sw: 2 });
  text(parent, 'Найти: LG, холодильник…', { x: 58, y: 126, 'font-size': 14.5, 'font-weight': 500, fill: C.muted });
}
function bottomNav(parent, active, badge = 0) {
  const g = el('g', null, parent);
  el('rect', { x: 0, y: 778, width: SW, height: 66, fill: C.white }, g);
  el('line', { x1: 0, y1: 778, x2: SW, y2: 778, stroke: C.border, 'stroke-width': 1 }, g);
  const labels = ['Главная', 'Каталог', 'Корзина', 'Избранное', 'Кабинет'];
  ['home', 'grid', 'cart', 'heart', 'user'].forEach((ic, i) => {
    const x = SW * (i + 0.5) / 5;
    if (i === active) el('rect', { x: x - 15, y: 779, width: 30, height: 3.5, rx: 1.75, fill: C.lemon }, g);
    icon(g, ic, { x, y: 800, size: 22, sw: 1.8, color: i === active ? C.ink : C.muted, fill: i === active ? C.lemon : 'none' });
    text(g, labels[i], { x, y: 826, 'font-size': 10.5, 'font-weight': i === active ? 800 : 600, fill: i === active ? C.ink : C.muted, 'text-anchor': 'middle' });
  });
  const b = el('g', { transform: `translate(${SW * 2.5 / 5 + 10} 790)` }, g);
  el('circle', { r: 8, fill: C.lemon, stroke: C.white, 'stroke-width': 1.5 }, b);
  text(b, String(badge), { y: 3.8, 'font-size': 10, 'font-weight': 800, fill: C.ink, 'text-anchor': 'middle' });
  show(b, badge > 0);
  el('rect', { x: 128, y: 834, width: 134, height: 5, rx: 2.5, fill: C.ink }, g);
  return { g, badge: b };
}
function productCard(parent, it, { selected = false } = {}) {
  const g = el('g', null, parent);
  el('rect', { width: CW, height: CH, rx: 16, fill: C.white, stroke: C.border, 'stroke-width': 1 }, g);
  el('image', { href: `assets/products/${it.img}.jpg`, x: 14, y: 12, width: 143, height: 140, preserveAspectRatio: 'xMidYMid meet' }, g);
  if (it.old) {
    el('rect', { x: 10, y: 10, width: 50, height: 24, rx: 8, fill: C.red }, g);
    text(g, `−${Math.round((1 - it.price / it.old) * 100)}%`, { x: 35, y: 26.5, 'font-size': 12.5, 'font-weight': 800, fill: C.white, 'text-anchor': 'middle' });
  } else {
    el('rect', { x: 10, y: 10, width: 42, height: 24, rx: 8, fill: C.lemonSoft }, g);
    text(g, 'Хит', { x: 31, y: 26.5, 'font-size': 12.5, 'font-weight': 800, fill: C.ink, 'text-anchor': 'middle' });
  }
  const h = el('g', { transform: 'translate(146 24)' }, g);
  el('rect', { x: -14, y: -14, width: 28, height: 28, rx: 9, fill: C.white, stroke: C.border, 'stroke-width': 1 }, h);
  icon(h, 'heart', { size: 15, sw: 2 });
  text(g, 'Стиральные машины', { x: 12, y: 172, 'font-size': 10.5, 'font-weight': 600, fill: C.muted });
  text(g, it.name[0], { x: 12, y: 191, 'font-size': 12.5, 'font-weight': 700, fill: C.ink });
  text(g, it.name[1], { x: 12, y: 207, 'font-size': 12.5, 'font-weight': 700, fill: C.ink });
  text(g, `${money(it.price)} сом`, { x: 12, y: 235, 'font-size': 17, 'font-weight': 800, fill: it.old ? C.red : C.ink, 'letter-spacing': '-0.01em' });
  if (it.old) {
    const os = `${money(it.old)} сом`, ow = measure(os, 11, 600);
    text(g, os, { x: 12, y: 251, 'font-size': 11, 'font-weight': 600, fill: C.muted });
    el('line', { x1: 11, y1: 247, x2: 13 + ow, y2: 247, stroke: C.muted, 'stroke-width': 1.2 }, g);
  }
  el('rect', { x: 10, y: 260, width: 151, height: 32, rx: 10, fill: C.lemon }, g);
  icon(g, 'cart', { x: 49, y: 276, size: 15, sw: 2 });
  text(g, 'В корзину', { x: 62, y: 281, 'font-size': 12.5, 'font-weight': 800, fill: C.ink });
  const ring = el('rect', { x: -3, y: -3, width: CW + 6, height: CH + 6, rx: 19, fill: 'none', stroke: C.lemon, 'stroke-width': 5, opacity: selected ? 1 : 0 }, g);
  return { g, ring };
}

// ---------- экраны внутри телефона ----------
function buildScreens(root) {
  // Каталог.
  const cat = el('g', null, root);
  el('rect', { width: SW, height: SH, fill: C.white }, cat);
  const feed = el('g', { 'clip-path': clipRect(0, 150, SW, 628) }, cat);
  const list = el('g', null, feed);
  text(list, 'Стиральные машины', { x: 16, y: 190, 'font-size': 25, 'font-weight': 800, fill: C.ink, 'letter-spacing': '-0.03em' });
  let cx = 16;
  [['Все', false], ['Стиральные машины', true], ['Холодильники', false]].forEach(([s, act]) => {
    const w = measure(s, 13, 700) + 30;
    el('rect', { x: cx, y: 208, width: w, height: 36, rx: 18, fill: act ? C.blue : C.white, stroke: act ? C.blue : C.border, 'stroke-width': 1 }, list);
    text(list, s, { x: cx + 15, y: 231, 'font-size': 13, 'font-weight': 700, fill: act ? C.white : C.inkSoft });
    cx += w + 8;
  });
  const cards = GRID.map((it, i) => {
    const c = productCard(list, it);
    const { x, y } = cardXY(i);
    c.g.setAttribute('transform', `translate(${x} ${y})`);
    return c;
  });
  el('rect', { width: SW, height: 150, fill: C.white }, cat);
  header(cat);
  bottomNav(cat, 1);
  const fab = el('g', { transform: 'translate(344 722)' }, cat);
  const fabPulse = el('circle', { r: 28, fill: 'none', stroke: C.lemon, 'stroke-width': 4, opacity: 0 }, fab);
  const fabBody = el('g', null, fab);
  el('circle', { r: 28, fill: C.lemon, filter: 'url(#shSoft)' }, fabBody);
  icon(fabBody, 'chat', { size: 24, sw: 2 });

  const chat = buildChat(root);
  const prod = buildProduct(root);
  const co = buildCheckout(root);
  buildDone(root);
  statusBar(root);

  on(t => {
    const [s1, s2] = T.swipes;
    let scroll = lerp(SCROLL[0], SCROLL[1], ease.out3(P(t, s1[0], s1[1] - s1[0] + 0.3)));
    scroll = lerp(scroll, SCROLL[2], ease.out3(P(t, s2[0], s2[1] - s2[0] + 0.3)));
    pose(list, { y: -scroll });
    [[A, T.tapA], [B, T.tapB]].forEach(([i, tap]) => {
      cards[i].ring.setAttribute('opacity', P(t, tap, 0.3));
      const out = P(t, T.scaleIn, 0.2) * (1 - P(t, T.askFly + 0.35, 0.3));
      cards[i].g.setAttribute('opacity', 1 - 0.75 * out);
    });
    // «Спросить» вздрагивает, когда в него влетает вопрос.
    const pm = P(t, T.askFly + 0.55, 0.6);
    fabPulse.setAttribute('r', 28 + 26 * ease.out3(pm));
    fabPulse.setAttribute('opacity', pm > 0 && pm < 1 ? 1 - pm : 0);
    const press = bump(P(t, T.tapAsk - 0.05, 0.2));
    pose(fab, { x: 344, y: 722, s: (1 + settle(P(t, T.askFly + 0.55, 0.6), 0.22, 18, 5)) * (1 - 0.1 * press) });
    show(cat, t < T.productIn + 0.7);
  });
  return { chat, prod, co };
}

function bubble(parent, str, { x, y, maxW, size = 14.5, side = 'left' }) {
  const lines = wrap(str, maxW - 26, size, 500);
  const lh = size * 1.42, w = Math.max(...lines.map(l => measure(l, size, 500))) + 26, h = lines.length * lh + 18;
  const bx = side === 'left' ? x : x - w;
  const g = el('g', null, parent);
  rrect(g, bx, y, w, h, side === 'left' ? [14, 14, 14, 5] : [14, 14, 5, 14], { fill: side === 'left' ? C.surface : C.ink });
  const tl = lines.map((l, i) => text(g, l, { x: bx + 13, y: y + 7 + size + i * lh, 'font-size': size, 'font-weight': 500, fill: side === 'left' ? C.ink : C.white }));
  return { g, h, w, lines: tl };
}

function buildChat(root) {
  const g = el('g', null, root);
  el('rect', { width: SW, height: SH, fill: C.white }, g);
  text(g, 'Онлайн-консультант', { x: 18, y: 78, 'font-size': 18, 'font-weight': 800, fill: C.ink, 'letter-spacing': '-0.02em' });
  const x = el('g', { transform: 'translate(356 72)' }, g);
  el('circle', { r: 16, fill: C.surface }, x);
  icon(x, 'close', { size: 15, sw: 2.2, color: C.inkSoft });
  text(g, 'Отвечаем сразу. Цену и наличие подтвердим', { x: 18, y: 100, 'font-size': 11.5, 'font-weight': 500, fill: C.muted });
  text(g, 'перед оплатой.', { x: 18, y: 115, 'font-size': 11.5, 'font-weight': 500, fill: C.muted });
  el('line', { x1: 0, y1: 128, x2: SW, y2: 128, stroke: C.border, 'stroke-width': 1 }, g);
  const hello = bubble(g, 'Ассаламу алейкум! Спрашивайте про товары, цены, доставку и бонусы.', { x: 16, y: 142, maxW: 300 });
  const qY = 142 + hello.h + 12;
  const q = bubble(g, QUESTION, { x: SW - 16, y: qY, maxW: 290, side: 'right' });
  const aY = qY + q.h + 12;
  const dots = el('g', null, g);
  rrect(dots, 16, aY, 112, 38, [14, 14, 14, 5], { fill: C.surface });
  text(dots, 'Печатает', { x: 29, y: aY + 24, 'font-size': 14, 'font-weight': 500, fill: C.muted });
  const dd = [0, 1, 2].map(i => el('circle', { cx: 97 + i * 8, cy: aY + 20, r: 2.4, fill: C.muted }, dots));
  const ans = bubble(g, ANSWER, { x: 16, y: aY, maxW: 316 });
  const hitsY = aY + ans.h + 10;
  const hits = [[GRID[A], 'LG F2V3FS4W 9 кг'], [GRID[B], 'FLAGMAN AV-80 8 кг']].map(([it, name], i) => {
    const hg = el('g', { transform: `translate(16 ${hitsY + i * 96})` }, g);
    const frame = el('rect', { width: 300, height: 44, rx: 12, fill: C.white, stroke: C.border, 'stroke-width': 1 }, hg);
    text(hg, name, { x: 12, y: 27, 'font-size': 13.5, 'font-weight': 700, fill: C.ink });
    text(hg, `${money(it.price)} сом`, { x: 288, y: 27, 'font-size': 13.5, 'font-weight': 800, fill: C.ink, 'text-anchor': 'end' });
    el('rect', { y: 50, width: 300, height: 36, rx: 10, fill: C.lemon }, hg);
    text(hg, 'Заказать', { x: 150, y: 73, 'font-size': 14, 'font-weight': 800, fill: C.ink, 'text-anchor': 'middle' });
    const ring = el('rect', { x: -3, y: -3, width: 306, height: 50, rx: 14, fill: 'none', stroke: C.lemon, 'stroke-width': 4, opacity: 0 }, hg);
    return { g: hg, frame, ring, y: hitsY + i * 96 };
  });
  const tip = el('g', null, g);
  const tipW = measure('Совет консультанта', 12, 800) + 22;
  rrect(tip, 316 - tipW, hitsY - 13, tipW, 24, [12, 12, 12, 12], { fill: C.ink });
  text(tip, 'Совет консультанта', { x: 316 - tipW / 2, y: hitsY + 3.5, 'font-size': 12, 'font-weight': 800, fill: C.lemon, 'text-anchor': 'middle' });

  // Поле ввода.
  const form = el('g', null, g);
  el('rect', { x: 0, y: 760, width: SW, height: 84, fill: C.white }, form);
  el('line', { x1: 0, y1: 760, x2: SW, y2: 760, stroke: C.border, 'stroke-width': 1 }, form);
  el('rect', { x: 14, y: 774, width: 42, height: 42, rx: 12, fill: C.white, stroke: C.border, 'stroke-width': 1 }, form);
  icon(form, 'camera', { x: 35, y: 795, size: 18, sw: 1.8, color: C.inkSoft });
  const field = el('rect', { x: 62, y: 774, width: 226, height: 42, rx: 12, fill: C.white, stroke: C.border, 'stroke-width': 1 }, form);
  const ph = text(form, 'Напишите вопрос…', { x: 76, y: 800, 'font-size': 14, 'font-weight': 500, fill: C.muted });
  const typed = text(form, '', { x: 76, y: 800, 'font-size': 14, 'font-weight': 500, fill: C.ink });
  const caret = el('rect', { x: 76, y: 786, width: 1.6, height: 18, fill: C.blue }, form);
  const send = el('g', { transform: 'translate(333 795)' }, form);
  el('rect', { x: -39, y: -21, width: 78, height: 42, rx: 12, fill: C.lemon }, send);
  text(send, 'Отправить', { y: 5, 'font-size': 13, 'font-weight': 800, fill: C.ink, 'text-anchor': 'middle' });
  el('rect', { x: 128, y: 834, width: 134, height: 5, rx: 2.5, fill: C.ink }, g);

  on(t => {
    const open = ease.outExpo(P(t, T.chatOpen, 0.55));
    const leave = ease.outExpo(P(t, T.productIn, 0.55));
    show(g, t > T.chatOpen && t < T.productIn + 0.6);
    pose(g, { x: -0.3 * SW * leave, y: (1 - open) * SH });
    const n = Math.round(QUESTION.length * P(t, T.type[0], T.type[1] - T.type[0]));
    const sent = t >= T.tapSend + 0.05;
    let s = sent ? '' : QUESTION.slice(0, n);
    while (s && measure(s, 14, 500) > 200) s = s.slice(1);
    typed.textContent = s;
    show(ph, !s);
    const writing = t > T.type[0] - 0.3 && !sent;
    caret.setAttribute('x', 76 + (s ? measure(s, 14, 500) + 1 : 0));
    caret.setAttribute('opacity', writing && Math.floor(t * 3) % 2 === 0 ? 1 : 0);
    field.setAttribute('stroke', writing ? C.blue : C.border);
    pose(send, { x: 333, y: 795, s: 1 - 0.08 * bump(P(t, T.tapSend - 0.05, 0.2)) });
    const qp = ease.outExpo(P(t, T.tapSend + 0.05, 0.45));
    pose(q.g, { y: (1 - qp) * 60, o: qp * 2 });
    show(q.g, qp > 0);
    show(dots, t > T.dots[0] && t < T.answer);
    dd.forEach((d, i) => d.setAttribute('cy', aY + 20 - 3 * Math.max(0, Math.sin(t * 7 - i * 0.9))));
    const ap = ease.outExpo(P(t, T.answer, 0.45));
    show(ans.g, ap > 0);
    pose(ans.g, { y: (1 - ap) * 20, o: ap * 2 });
    ans.lines.forEach((l, i) => l.setAttribute('opacity', P(t, T.answer + 0.05 + i * 0.09, 0.2)));
    hits.forEach((h, i) => {
      const hp = ease.outExpo(P(t, T.answer + 0.55 + i * 0.12, 0.5));
      pose(h.g, { x: 16, y: h.y + (1 - hp) * 16, o: hp * 1.5 });
      if (i === 0) {
        const pk = P(t, T.pick, 0.35);
        h.ring.setAttribute('opacity', pk);
        h.frame.setAttribute('fill', mix('#ffffff', C.lemonSoft, pk));
      }
    });
    const tp = ease.outExpo(P(t, T.pick + 0.1, 0.45));
    show(tip, tp > 0);
    pose(tip, { y: (1 - tp) * 10, o: tp });
  });
  return { hitsY };
}

function buildProduct(root) {
  const it = GRID[A];
  const g = el('g', null, root);
  el('rect', { width: SW, height: SH, fill: C.white }, g);
  el('rect', { x: -40, width: 40, height: SH, fill: C.ink, opacity: 0.1 }, g);
  header(g);
  text(g, 'Главная  /  Каталог  /  Стиральные машины', { x: 18, y: 168, 'font-size': 11.5, 'font-weight': 600, fill: C.muted });
  el('image', { href: `assets/products/${it.img}.jpg`, x: 55, y: 180, width: 280, height: 280, preserveAspectRatio: 'xMidYMid meet' }, g);
  text(g, 'Стиральные машины', { x: 18, y: 488, 'font-size': 12.5, 'font-weight': 600, fill: C.muted });
  text(g, 'Стиральная машина LG', { x: 18, y: 516, 'font-size': 21, 'font-weight': 800, fill: C.ink, 'letter-spacing': '-0.02em' });
  text(g, 'F2V3FS4W 9 кг', { x: 18, y: 542, 'font-size': 21, 'font-weight': 800, fill: C.ink, 'letter-spacing': '-0.02em' });
  const ps = `${money(it.price)} сом`, pw = measure(ps, 27, 800, -0.02);
  text(g, ps, { x: 18, y: 584, 'font-size': 27, 'font-weight': 800, fill: C.red, 'letter-spacing': '-0.02em' });
  const os = `${money(it.old)} сом`, ow = measure(os, 16, 600);
  text(g, os, { x: 18 + pw + 12, y: 583, 'font-size': 16, 'font-weight': 600, fill: C.muted });
  el('line', { x1: 18 + pw + 11, y1: 577.5, x2: 18 + pw + 13 + ow, y2: 577.5, stroke: C.muted, 'stroke-width': 1.5 }, g);
  el('circle', { cx: 24, cy: 609, r: 4.5, fill: C.orange }, g);
  text(g, 'Осталось мало: 2', { x: 36, y: 614, 'font-size': 13.5, 'font-weight': 700, fill: C.ink });
  const btn = el('g', { transform: 'translate(161 664)' }, g);
  const bRect = el('rect', { x: -145, y: -26, width: 290, height: 52, rx: 13, fill: C.lemon }, btn);
  const l1 = el('g', null, btn);
  icon(l1, 'cart', { x: -48, y: 0, size: 19, sw: 2 });
  text(l1, 'В корзину', { x: -32, y: 5.5, 'font-size': 15.5, 'font-weight': 800, fill: C.ink });
  const l2 = el('g', null, btn);
  icon(l2, 'check', { x: -50, y: 0, size: 19, sw: 2.4 });
  text(l2, 'Добавлено', { x: -34, y: 5.5, 'font-size': 15.5, 'font-weight': 800, fill: C.ink });
  el('rect', { x: 316, y: 638, width: 58, height: 52, rx: 13, fill: C.white, stroke: C.border, 'stroke-width': 1 }, g);
  icon(g, 'heart', { x: 345, y: 664, size: 20, sw: 2 });
  const nav = bottomNav(g, 2, 1);
  // Плашка корзины снизу — как на сайте после «В корзину».
  const bar = el('g', null, g);
  el('rect', { x: 12, y: 702, width: 366, height: 66, rx: 16, fill: C.white, stroke: C.border, 'stroke-width': 1, filter: 'url(#shCard)' }, bar);
  el('image', { href: `assets/products/${it.img}.jpg`, x: 22, y: 712, width: 46, height: 46 }, bar);
  text(bar, 'Корзина · 1', { x: 76, y: 730, 'font-size': 12.5, 'font-weight': 600, fill: C.inkSoft });
  text(bar, `${money(it.price)} сом`, { x: 76, y: 752, 'font-size': 17, 'font-weight': 800, fill: C.ink });
  const go = el('g', { transform: 'translate(282 735)' }, bar);
  el('rect', { x: -58, y: -21, width: 116, height: 42, rx: 12, fill: C.lemon }, go);
  text(go, 'Оформить', { x: -10, y: 5, 'font-size': 14, 'font-weight': 800, fill: C.ink, 'text-anchor': 'middle' });
  icon(go, 'arrow', { x: 36, y: 0, size: 15, sw: 2.2 });
  icon(bar, 'close', { x: 358, y: 735, size: 14, sw: 2, color: C.muted });

  on(t => {
    const pin = ease.outExpo(P(t, T.productIn, 0.55));
    const pout = ease.outExpo(P(t, T.checkoutIn, 0.55));
    show(g, t > T.productIn && t < T.checkoutIn + 0.6);
    pose(g, { x: (1 - pin) * SW - 0.3 * SW * pout });
    pose(btn, { x: 161, y: 664, s: 1 - 0.05 * bump(P(t, T.tapAdd - 0.05, 0.2)) });
    const added = ease.outExpo(P(t, T.tapAdd + 0.03, 0.35));
    bRect.setAttribute('fill', mix(C.lemon, C.added, added));
    pose(l1, { y: -added * 30, o: 1 - added * 1.6 });
    pose(l2, { y: (1 - added) * 30, o: added });
    show(nav.badge, t > T.tapAdd + 0.1);
    pose(nav.badge, { x: SW * 2.5 / 5 + 10, y: 790, s: 1 + settle(P(t, T.tapAdd + 0.1, 0.5), 0.5, 18, 6) });
    const bp = ease.outExpo(P(t, T.bar, 0.5));
    show(bar, bp > 0);
    pose(bar, { y: (1 - bp) * 120, o: bp * 2 });
    pose(go, { x: 282, y: 735, s: 1 - 0.07 * bump(P(t, T.tapCheckout - 0.05, 0.2)) });
  });
}

function inputBox(parent, y, label, ph, value) {
  const g = el('g', null, parent);
  text(g, label, { x: 32, y, 'font-size': 12.5, 'font-weight': 700, fill: C.ink });
  const box = el('rect', { x: 32, y: y + 8, width: 326, height: 44, rx: 12, fill: C.white, stroke: C.border, 'stroke-width': 1 }, g);
  const phT = text(g, ph, { x: 46, y: y + 35, 'font-size': 14, 'font-weight': 500, fill: C.muted });
  const val = text(g, '', { x: 46, y: y + 35, 'font-size': 14.5, 'font-weight': 600, fill: C.ink });
  const caret = el('rect', { x: 46, y: y + 21, width: 1.6, height: 18, fill: C.blue }, g);
  return {
    g, cy: y + 30,
    set(t, [a, b]) {
      const n = Math.round(value.length * P(t, a, b - a));
      val.textContent = value.slice(0, n);
      show(phT, n === 0);
      const active = t > a - 0.25 && t < b + 0.35;
      box.setAttribute('stroke', active ? C.blue : C.border);
      box.setAttribute('stroke-width', active ? 2 : 1);
      caret.setAttribute('x', 46 + (n ? measure(value.slice(0, n), 14.5, 600) + 1 : 0));
      caret.setAttribute('opacity', active && Math.floor(t * 3) % 2 === 0 ? 1 : 0);
    },
  };
}
function buildCheckout(root) {
  const it = GRID[A];
  const g = el('g', null, root);
  el('rect', { width: SW, height: SH, fill: C.white }, g);
  el('rect', { x: -40, width: 40, height: SH, fill: C.ink, opacity: 0.1 }, g);
  const page = el('g', null, g);
  el('rect', { y: 150, width: SW, height: 1000, fill: C.surface }, page);
  text(page, 'Оформление заказа', { x: 18, y: 190, 'font-size': 24, 'font-weight': 800, fill: C.ink, 'letter-spacing': '-0.03em' });
  text(page, 'Оплата онлайн через O!Деньги. После оплаты', { x: 18, y: 213, 'font-size': 12.5, 'font-weight': 500, fill: C.inkSoft });
  text(page, 'заказ сразу поступает в магазин.', { x: 18, y: 230, 'font-size': 12.5, 'font-weight': 500, fill: C.inkSoft });
  el('rect', { x: 16, y: 246, width: 358, height: 226, rx: 16, fill: C.white, stroke: C.border, 'stroke-width': 1 }, page);
  text(page, 'Покупатель', { x: 32, y: 276, 'font-size': 16, 'font-weight': 800, fill: C.ink });
  const nameF = inputBox(page, 302, 'ФИО *', 'Например, Азизов Азиз Азизович', NAME);
  const phoneF = inputBox(page, 380, 'Телефон *', '+996 700 000 000', PHONE);
  text(page, 'На этот номер придёт подтверждение заказа в WhatsApp', { x: 32, y: 458, 'font-size': 10.5, 'font-weight': 500, fill: C.muted });
  el('rect', { x: 16, y: 486, width: 358, height: 240, rx: 16, fill: C.white, stroke: C.border, 'stroke-width': 1 }, page);
  text(page, 'Получение', { x: 32, y: 516, 'font-size': 16, 'font-weight': 800, fill: C.ink });
  const radio = (y, title, sub) => {
    const r = el('g', null, page);
    const box = el('rect', { x: 32, y, width: 326, height: 58, rx: 12, fill: C.white, stroke: C.border, 'stroke-width': 1 }, r);
    el('circle', { cx: 52, cy: y + 29, r: 8, fill: C.white, stroke: C.borderStrong, 'stroke-width': 1.6 }, r);
    const dot = el('circle', { cx: 52, cy: y + 29, r: 4.5, fill: C.blue }, r);
    text(r, title, { x: 70, y: y + 25, 'font-size': 13.5, 'font-weight': 800, fill: C.ink });
    text(r, sub, { x: 70, y: y + 43, 'font-size': 11, 'font-weight': 500, fill: C.muted });
    return { box, dot, cy: y + 29 };
  };
  const pickup = radio(530, 'Самовывоз из магазина', 'Бесплатно. Сотрудник сообщит, когда готово');
  const courier = radio(598, 'Доставка · Бесплатно', 'Привезём по указанному адресу');
  const addrF = inputBox(page, 668, 'Адрес', 'Улица, дом, квартира, ориентир', ADDR);
  el('rect', { x: 16, y: 740, width: 358, height: 214, rx: 16, fill: C.white, stroke: C.border, 'stroke-width': 1 }, page);
  text(page, 'Ваш заказ', { x: 32, y: 770, 'font-size': 16, 'font-weight': 800, fill: C.ink });
  text(page, 'Стиральная машина LG', { x: 32, y: 796, 'font-size': 12.5, 'font-weight': 500, fill: C.inkSoft });
  text(page, 'F2V3FS4W 9 кг × 1', { x: 32, y: 812, 'font-size': 12.5, 'font-weight': 500, fill: C.inkSoft });
  text(page, `${money(it.price)} сом`, { x: 358, y: 804, 'font-size': 13, 'font-weight': 800, fill: C.ink, 'text-anchor': 'end' });
  text(page, 'Доставка', { x: 32, y: 838, 'font-size': 12.5, 'font-weight': 500, fill: C.inkSoft });
  text(page, 'Бесплатно', { x: 358, y: 838, 'font-size': 13, 'font-weight': 800, fill: C.ink, 'text-anchor': 'end' });
  el('line', { x1: 32, y1: 852, x2: 358, y2: 852, stroke: C.border, 'stroke-width': 1 }, page);
  text(page, 'К оплате', { x: 32, y: 880, 'font-size': 17, 'font-weight': 800, fill: C.ink });
  text(page, `${money(it.price)} сом`, { x: 358, y: 881, 'font-size': 19, 'font-weight': 800, fill: C.ink, 'text-anchor': 'end' });
  const pay = el('g', { transform: 'translate(195 920)' }, page);
  const payRect = el('rect', { x: -163, y: -26, width: 326, height: 52, rx: 13, fill: C.lemon }, pay);
  const payL = text(pay, 'Оплатить онлайн', { y: 5.5, 'font-size': 16, 'font-weight': 800, fill: C.ink, 'text-anchor': 'middle' });
  el('rect', { width: SW, height: 150, fill: C.white }, g);
  header(g);
  bottomNav(g, 2, 1);
  const SCROLLPAY = 230;

  on(t => {
    const pin = ease.outExpo(P(t, T.checkoutIn, 0.55));
    show(g, t > T.checkoutIn && t < T.success + 0.7);
    pose(g, { x: (1 - pin) * SW });
    nameF.set(t, T.typeName);
    phoneF.set(t, T.typePhone);
    addrF.set(t, T.typeAddr);
    const dl = ease.outExpo(P(t, T.tapDelivery, 0.3));
    pickup.dot.setAttribute('r', 4.5 * (1 - dl));
    courier.dot.setAttribute('r', 4.5 * dl);
    pickup.box.setAttribute('stroke', mix(C.blue, C.border, dl));
    courier.box.setAttribute('stroke', mix(C.border, C.blue, dl));
    pickup.box.setAttribute('fill', mix(C.ice, '#ffffff', dl));
    courier.box.setAttribute('fill', mix('#ffffff', C.ice, dl));
    pickup.box.setAttribute('stroke-width', 1 + (1 - dl));
    courier.box.setAttribute('stroke-width', 1 + dl);
    addrF.g.setAttribute('opacity', dl);
    pose(page, { y: -SCROLLPAY * ease.inOut3(P(t, T.scrollPay[0], T.scrollPay[1] - T.scrollPay[0])) });
    pose(pay, { x: 195, y: 920, s: 1 - 0.05 * bump(P(t, T.tapPay - 0.05, 0.2)) });
    const busy = t > T.tapPay + 0.05;
    payL.textContent = busy ? 'Создаём заказ…' : 'Оплатить онлайн';
    payRect.setAttribute('fill', busy ? C.lemonHover : C.lemon);
  });
  return { nameY: nameF.cy, phoneY: phoneF.cy, courierY: courier.cy, addrY: addrF.cy, payY: 920 - SCROLLPAY };
}

function buildDone(root) {
  const it = GRID[A];
  const g = el('g', null, root);
  el('rect', { width: SW, height: SH, fill: C.white }, g);
  header(g);
  const disc = el('g', { transform: 'translate(195 236)' }, g);
  const ring = el('circle', { r: 46, fill: 'none', stroke: C.green, 'stroke-width': 3 }, disc);
  el('circle', { r: 44, fill: C.green }, disc);
  const ck = icon(disc, 'check', { size: 50, color: C.white, sw: 3 });
  ck.querySelector('path').setAttribute('stroke-dasharray', 23);
  text(g, 'Спасибо!', { x: 195, y: 328, 'font-size': 27, 'font-weight': 800, fill: C.ink, 'text-anchor': 'middle', 'letter-spacing': '-0.03em' });
  const pw = measure('Оплачен', 14, 800) + 30;
  el('rect', { x: 195 - pw / 2, y: 344, width: pw, height: 30, rx: 15, fill: C.greenSoft }, g);
  text(g, 'Оплачен', { x: 195, y: 364, 'font-size': 14, 'font-weight': 800, fill: C.green, 'text-anchor': 'middle' });
  ['Оплата получена. Подтверждение придёт', 'в WhatsApp, сотрудник свяжется с вами.'].forEach((s, i) =>
    text(g, s, { x: 195, y: 404 + i * 21, 'font-size': 14.5, 'font-weight': 500, fill: C.inkSoft, 'text-anchor': 'middle' }));
  el('rect', { x: 16, y: 452, width: 358, height: 84, rx: 16, fill: C.white, stroke: C.border, 'stroke-width': 1 }, g);
  el('image', { href: `assets/products/${it.img}.jpg`, x: 26, y: 462, width: 64, height: 64 }, g);
  text(g, 'Стиральная машина LG', { x: 102, y: 486, 'font-size': 13.5, 'font-weight': 700, fill: C.ink });
  text(g, 'F2V3FS4W 9 кг', { x: 102, y: 504, 'font-size': 13.5, 'font-weight': 700, fill: C.ink });
  text(g, `${money(it.price)} сом`, { x: 102, y: 525, 'font-size': 15, 'font-weight': 800, fill: C.ink });
  el('rect', { x: 16, y: 556, width: 358, height: 50, rx: 13, fill: C.white, stroke: C.borderStrong, 'stroke-width': 1 }, g);
  text(g, 'В каталог', { x: 195, y: 586, 'font-size': 15, 'font-weight': 800, fill: C.ink, 'text-anchor': 'middle' });
  bottomNav(g, 4);
  const burst = el('g', null, g);
  const rnd = rng(5);
  const bits = Array.from({ length: 22 }, (_, i) => {
    const n = el('rect', { x: -5, y: -2.5, width: 10, height: 5, rx: 1.5, fill: [C.lemon, C.green, C.blue, C.lemonHover][i % 4] }, burst);
    return { n, a: (i / 22) * Math.PI * 2 + rnd() * 0.3, v: 90 + rnd() * 70, spin: (rnd() - 0.5) * 900 };
  });
  on(t => {
    show(g, t > T.success);
    g.setAttribute('opacity', ease.outExpo(P(t, T.success, 0.5)));
    pose(disc, { x: 195, y: 236, s: 0.6 + 0.4 * ease.outBack(P(t, T.success + 0.05, 0.5), 2) });
    ck.querySelector('path').setAttribute('stroke-dashoffset', 23 * (1 - ease.out3(P(t, T.success + 0.2, 0.35))));
    const pr = P(t, T.success + 0.2, 0.7);
    ring.setAttribute('r', 46 + 40 * ease.out3(pr));
    ring.setAttribute('opacity', pr > 0 && pr < 1 ? 1 - pr : 0);
    const tb = t - (T.success + 0.2);
    show(burst, tb > 0 && tb < 1.2);
    bits.forEach(b => {
      const d = b.v * ease.out3(clamp(tb / 0.9));
      pose(b.n, { x: 195 + Math.cos(b.a) * (60 + d), y: 236 + Math.sin(b.a) * (60 + d) + 40 * tb * tb, r: b.spin * tb, o: 1 - P(tb, 0.6, 0.5) });
    });
  });
}

// ---------- сомнение: две карточки на весах ----------
function buildHesitation(root, cam) {
  const PIV = { x: 540, y: 1268 };
  const sc = 1.6;
  const base = el('g', null, root);
  el('path', { d: 'M0 4L-50 96H50Z', fill: C.ink }, base);
  el('rect', { x: -96, y: 92, width: 192, height: 18, rx: 9, fill: C.ink }, base);
  const beam = el('g', null, root);
  el('rect', { x: -300, y: -9, width: 600, height: 18, rx: 9, fill: C.ink }, beam);
  el('circle', { r: 13, fill: C.lemon, stroke: C.ink, 'stroke-width': 5 }, beam);
  const cards = [A, B].map(i => {
    const g = el('g', { filter: 'url(#shCard)' }, root);
    productCard(g, GRID[i], { selected: true });
    return { g, i };
  });
  const q = el('g', null, root);
  el('circle', { r: 74, fill: C.lemon, stroke: C.ink, 'stroke-width': 6 }, q);
  text(q, '?', { y: 40, 'font-size': 114, 'font-weight': 800, fill: C.ink, 'text-anchor': 'middle' });
  const callout = el('g', null, root.parentNode);
  const cw = measure('Спросить', 34, 800) + 56;
  el('rect', { x: -cw, y: -32, width: cw, height: 64, rx: 32, fill: C.ink }, callout);
  el('path', { d: 'M-4 -12L18 0L-4 12Z', fill: C.ink }, callout);
  text(callout, 'Спросить', { x: -cw / 2, y: 12, 'font-size': 34, 'font-weight': 800, fill: C.white, 'text-anchor': 'middle' });

  const theta = t => {
    const amp = 8 * P(t, T.scaleIn + 0.5, 0.4) * (1 - P(t, T.askFly - 0.4, 0.4));
    return amp * Math.sin((t - T.scaleIn - 0.5) * Math.PI / 0.6);
  };
  on(t => {
    const vis = t > T.scaleIn && t < T.askFly + 0.8;
    show(root, vis);
    if (!vis) return;
    const c = cam(t);
    const th = theta(t), rad = th * Math.PI / 180;
    const pin = ease.outExpo(P(t, T.scaleIn, 0.6)) * (1 - ease.inOut3(P(t, T.askFly + 0.1, 0.55)));
    const sIn = ease.outExpo(P(t, T.scaleIn + 0.25, 0.5)) * (1 - P(t, T.askFly, 0.35));
    pose(beam, { x: PIV.x, y: PIV.y, r: th, s: sIn, o: sIn });
    pose(base, { x: PIV.x, y: PIV.y, s: sIn, o: sIn });
    cards.forEach((cd, k) => {
      const side = k ? 1 : -1;
      const ex = PIV.x + Math.cos(rad) * 268 * side, ey = PIV.y + Math.sin(rad) * 268 * side - 9;
      const { x, y } = cardXY(cd.i);
      const from = toCanvas(c, x, y - SCROLL[2]);
      const tx = ex - CW * sc / 2, ty = ey - CH * sc;
      pose(cd.g, { x: lerp(from.x, tx, pin), y: lerp(from.y, ty, pin) - bump(pin) * 120, s: lerp(c.k, sc, pin), r: side * 4 * bump(pin), o: P(pin, 0, 0.05) });
    });
    // Знак вопроса качается между карточками, потом улетает в «Спросить».
    const qa = ease.outBack(P(t, T.scaleIn + 0.45, 0.5), 2);
    const fly = ease.inOut3(P(t, T.askFly, 0.6));
    const fab = toCanvas(c, 344, 722);
    const qx = lerp(PIV.x, fab.x, fly), qy = lerp(PIV.y - 560 + Math.sin(t * 6) * 14 * (1 - fly), fab.y, fly) - bump(fly) * 160;
    pose(q, { x: qx, y: qy, s: qa * lerp(1, 0.32, fly), r: Math.sin(t * 4) * 8 * (1 - fly), o: fly > 0.92 ? (1 - fly) / 0.08 : 1 });
    show(q, qa > 0);
  });
  on(t => {
    const c = cam(t);
    const fab = toCanvas(c, 344, 722);
    const p = ease.outExpo(P(t, T.askFly + 0.45, 0.45)) * (1 - P(t, T.tapAsk + 0.1, 0.25));
    show(callout, p > 0);
    pose(callout, { x: fab.x - 48 - (1 - p) * 40, y: fab.y, o: p });
  });
  return {
    blur: t => 7 * P(t, T.scaleIn, 0.5) * (1 - P(t, T.askFly + 0.1, 0.5)),
    dim: t => P(t, T.scaleIn, 0.5) * (1 - P(t, T.askFly + 0.1, 0.5)),
  };
}

// ---------- рука ----------
function buildHand(parent) {
  const ripple = el('circle', { r: 10, fill: 'none', stroke: C.blue, 'stroke-width': 5 }, parent);
  const g = el('g', null, parent);
  const body = el('g', { filter: 'url(#shSoft)' }, g);
  const shapes = [
    { x: -14, y: 0, width: 28, height: 96, rx: 14 },
    { x: -26, y: 66, width: 96, height: 98, rx: 34 },
    { x: 10, y: 58, width: 28, height: 46, rx: 14 },
    { x: 34, y: 66, width: 26, height: 44, rx: 13 },
    { x: 55, y: 78, width: 22, height: 40, rx: 11 },
    { x: -58, y: 86, width: 30, height: 64, rx: 15, transform: 'rotate(-32 -43 118)' },
  ];
  const outline = el('g', { fill: C.ink, stroke: C.ink, 'stroke-width': 10, 'stroke-linejoin': 'round' }, body);
  const fill = el('g', { fill: C.white }, body);
  shapes.forEach(a => { el('rect', a, outline); el('rect', a, fill); });
  [[24, 100, 24, 116], [47, 106, 47, 120], [66, 116, 66, 128]].forEach(([x1, y1, x2, y2]) =>
    el('line', { x1, y1, x2, y2, stroke: C.ink, 'stroke-width': 4, 'stroke-linecap': 'round' }, body));
  el('rect', { x: -30, y: 152, width: 104, height: 70, rx: 14, fill: C.lemon, stroke: C.ink, 'stroke-width': 5 }, body);
  el('line', { x1: -30, y1: 172, x2: 74, y2: 172, stroke: C.ink, 'stroke-width': 4 }, body);
  return { g, ripple };
}
function driveHand(hand, cam, S) {
  // Куда указывает палец: 'pt' — точка на экране телефона, 'cv' — точка кадра.
  const hitY = S.chat.hitsY + 22;
  const WAY = [
    [0, 'cv', 1180, 2200], [2.65, 'cv', 1180, 2200], [3.05, 'pt', 255, 640],
    [3.15, 'pt', 255, 640], [3.8, 'pt', 255, 300], [4.1, 'pt', 255, 640], [4.25, 'pt', 255, 640], [4.9, 'pt', 255, 300],
    [5.35, 'pt', 101, 311], [5.75, 'pt', 101, 311], [6.15, 'pt', 288, 311], [6.6, 'pt', 288, 311],
    [7.3, 'cv', 330, 1470], [7.9, 'cv', 760, 1470], [8.5, 'cv', 330, 1470], [9.1, 'cv', 760, 1470], [9.6, 'cv', 560, 1500],
    [10.55, 'pt', 344, 722], [11.0, 'pt', 344, 722], [11.5, 'pt', 180, 795], [13.3, 'pt', 300, 795], [13.6, 'pt', 333, 795],
    [14.1, 'cv', 1180, 2050], [17.6, 'cv', 1180, 2050], [18.2, 'pt', 150, hitY], [18.6, 'pt', 150, hitY],
    [19.4, 'pt', 161, 664], [19.85, 'pt', 161, 664], [20.5, 'pt', 282, 735], [20.95, 'pt', 282, 735],
    [21.4, 'pt', 230, S.co.nameY], [22.4, 'pt', 230, S.co.nameY], [22.6, 'pt', 230, S.co.phoneY], [23.5, 'pt', 230, S.co.phoneY],
    [23.85, 'pt', 120, S.co.courierY], [24.1, 'pt', 230, S.co.addrY], [24.95, 'pt', 230, S.co.addrY],
    [25.55, 'pt', 195, S.co.payY], [25.9, 'pt', 195, S.co.payY], [26.6, 'cv', 1180, 2200], [30, 'cv', 1180, 2200],
  ];
  const TAPS = [T.tapA, T.tapB, T.tapAsk, T.tapSend, T.tapHit, T.tapAdd, T.tapCheckout, T.typeName[0] - 0.12, T.typePhone[0] - 0.08, T.tapDelivery, T.typeAddr[0] - 0.05, T.tapPay];
  const at = (c, w) => (w[1] === 'pt' ? toCanvas(c, w[2], w[3]) : { x: w[2], y: w[3] });
  on(t => {
    const c = cam(t);
    let i = 0;
    while (i < WAY.length - 2 && t >= WAY[i + 1][0]) i++;
    const a = WAY[i], b = WAY[i + 1];
    const drag = T.swipes.some(([s, e]) => t >= s && t <= e);
    const p = P(t, a[0], b[0] - a[0]);
    const e = drag ? ease.out3(p) : ease.inOut3(p);
    const pa = at(c, a), pb = at(c, b);
    const lift = drag ? 0 : bump(p) * Math.min(80, Math.hypot(pb.x - pa.x, pb.y - pa.y) * 0.25);
    const x = lerp(pa.x, pb.x, e), y = lerp(pa.y, pb.y, e) - lift;
    let press = 0;
    for (const tp of TAPS) press = Math.max(press, bump(P(t, tp - 0.08, 0.22)));
    if (drag) press = Math.max(press, 0.8);
    const tilt = clamp((pb.x - pa.x) / 600, -1, 1) * 10 * bump(p);
    pose(hand.g, { x, y: y + press * 6, s: 1.25 * (1 - 0.07 * press), r: -8 + tilt });
    const lastTap = TAPS.filter(tp => t >= tp).pop() ?? -9;
    const rp = P(t, lastTap, 0.45);
    show(hand.ripple, rp > 0 && rp < 1);
    hand.ripple.setAttribute('cx', x);
    hand.ripple.setAttribute('cy', y);
    hand.ripple.setAttribute('r', 14 + 50 * ease.out3(rp));
    hand.ripple.setAttribute('opacity', 0.6 * (1 - rp));
    show(hand.g, t > 2.6 && t < 27.2);
  });
}

// ---------- шаги и подписи сверху; заставка из трёх слов ----------
function buildTop(top, hook) {
  const WORDS = ['Выберите', 'Спросите', 'Закажите'];
  const pillW = WORDS.map(w => measure(w, 29, 800, -0.02) + 92);
  const gap = 14, total = pillW.reduce((a, b) => a + b, 0) + gap * 2;
  let px = 540 - total / 2;
  const pills = WORDS.map((w, i) => {
    const g = el('g', null, top);
    const x = px;
    px += pillW[i] + gap;
    const bg = el('rect', { x, y: 112, width: pillW[i], height: 66, rx: 33, fill: C.white, stroke: C.border, 'stroke-width': 2 }, g);
    const num = el('circle', { cx: x + 36, cy: 145, r: 19, fill: C.surface }, g);
    const nt = text(g, String(i + 1), { x: x + 36, y: 154, 'font-size': 23, 'font-weight': 800, fill: C.muted, 'text-anchor': 'middle' });
    const ck = icon(g, 'check', { x: x + 36, y: 145, size: 22, sw: 3, color: C.white });
    const label = text(g, w, { x: x + 66, y: 155, 'font-size': 29, 'font-weight': 800, fill: C.muted, 'letter-spacing': '-0.02em' });
    return { g, bg, num, nt, ck, label, x: x + 66 };
  });
  const caps = CAPTIONS.map(([t0, str], i) => {
    let size = 66, lines = wrap(str, 980, size, 800);
    if (lines.length > 2) { size = 54; lines = wrap(str, 980, size, 800); }
    const ys = lines.length === 1 ? [300] : [272, 272 + size * 1.12];
    const ml = lines.map((l, k) => maskLine(top, l, { x: 540, y: ys[k], size, anchor: 'middle', ls: -0.03 }));
    return { t0, t1: CAPTIONS[i + 1]?.[0] ?? T.end, ml };
  });
  // Заставка: три слова на доли.
  const lock = el('g', null, hook);
  const lw = 60 * 0.56 + 16 + measure('Смарт Центр', 46, 800, -0.02);
  buildMark(lock, C.ink).setAttribute('transform', `translate(${540 - lw / 2} 238) scale(0.6)`);
  text(lock, 'Смарт Центр', { x: 540 - lw / 2 + 50, y: 284, 'font-size': 46, 'font-weight': 800, fill: C.ink, 'letter-spacing': '-0.02em' });
  const big = WORDS.map((w, i) => {
    const y = 720 + i * 220, size = 160;
    const ww = measure(w, size, 800, -0.045);
    const x0 = 540 - (ww + 150) / 2 + 150;
    const g = el('g', null, hook);
    const under = el('rect', { x: x0 - 6, y: y + 14, height: 28, rx: 14, fill: C.lemon }, g);
    const ml = maskLine(g, w, { x: x0, y, size, ls: -0.045 });
    const n = el('g', null, g);
    el('circle', { r: 54, fill: C.lemon }, n);
    text(n, String(i + 1), { y: 26, 'font-size': 74, 'font-weight': 800, fill: C.ink, 'text-anchor': 'middle' });
    return { g, under, ml, n, x0, y, size, ww };
  });
  const sub = maskLine(hook, 'прямо с телефона — на smarket.kg', { x: 540, y: 1420, size: 50, weight: 700, fill: C.inkSoft, anchor: 'middle', ls: -0.01 });

  on(t => {
    const mp = ease.inOut3(P(t, T.toPhone, 0.55));
    show(hook, t < T.toPhone + 0.6);
    lock.setAttribute('opacity', ease.out3(P(t, 0.2, 0.4)) * (1 - mp * 2));
    pose(lock, { y: (1 - ease.outExpo(P(t, 0.2, 0.6))) * 24 });
    big.forEach((b, i) => {
      const t0 = T.words[i];
      b.ml.set(P(t, t0 - 0.04, 0.55));
      b.under.setAttribute('width', (b.ww + 12) * ease.outExpo(P(t, t0 + 0.12, 0.45)));
      pose(b.n, { x: b.x0 - 90, y: b.y - 58, s: ease.outBack(P(t, t0, 0.4), 2.2), o: P(t, t0, 0.1) * (1 - mp * 3) });
      // Слово уезжает на место своей плашки.
      const k = 29 / b.size, pl = pills[i];
      const tx = pl.x - k * b.x0, ty = 155 - k * b.y;
      b.g.setAttribute('transform', `translate(${lerp(0, tx, mp).toFixed(2)} ${lerp(0, ty, mp).toFixed(2)}) scale(${lerp(1, k, mp).toFixed(4)})`);
      b.g.setAttribute('opacity', 1 - P(t, T.toPhone + 0.42, 0.13));
      b.under.setAttribute('opacity', 1 - mp * 2);
    });
    sub.set(P(t, T.wordSub, 0.55), P(t, T.toPhone, 0.3));

    // Шаги: активный — лимонный, пройденный — с галочкой.
    const step = STEPS.filter(([s]) => t >= s).pop()?.[1] ?? -1;
    const pIn = P(t, T.toPhone + 0.38, 0.2) * (1 - P(t, T.end, 0.35));
    pills.forEach((pl, i) => {
      pl.g.setAttribute('opacity', pIn);
      const active = i === step, doneS = i < step;
      pl.bg.setAttribute('fill', active ? C.lemon : C.white);
      pl.bg.setAttribute('stroke', active ? C.lemon : C.border);
      pl.num.setAttribute('fill', doneS ? C.green : active ? C.ink : C.surface);
      pl.nt.setAttribute('fill', active ? C.lemon : C.muted);
      show(pl.nt, !doneS);
      show(pl.ck, doneS);
      pl.label.setAttribute('fill', active || doneS ? C.ink : C.muted);
      const sAt = STEPS.find(([, k]) => k === i)?.[0] ?? 99;
      const pop = 1 + settle(P(t, sAt, 0.5), 0.08, 16, 6);
      pose(pl.g, { x: (pl.x - 30) * (1 - pop), y: 145 * (1 - pop), s: pop });
    });
    caps.forEach(cp => cp.ml.forEach((ml, k) => ml.set(P(t, cp.t0 + k * 0.08, 0.6), P(t, cp.t1 - 0.05, 0.35))));
  });
}

// ---------- финал ----------
function buildEnd(root) {
  const g = el('g', null, root);
  const lock = el('g', null, g);
  const lw = 60 * 0.56 + 16 + measure('Смарт Центр', 46, 800, -0.02);
  buildMark(lock, C.ink).setAttribute('transform', `translate(${540 - lw / 2} 150) scale(0.6)`);
  text(lock, 'Смарт Центр', { x: 540 - lw / 2 + 50, y: 196, 'font-size': 46, 'font-weight': 800, fill: C.ink, 'letter-spacing': '-0.02em' });
  const url = maskLine(g, 'smarket.kg', { x: 540, y: 404, size: 156, anchor: 'middle', ls: -0.045 });
  const line = maskLine(g, 'Выберите · Спросите · Закажите', { x: 540, y: 494, size: 46, weight: 700, fill: C.inkSoft, anchor: 'middle', ls: -0.01 });
  const chipsStr = ['Доставка по всему Кыргызстану', 'Заказ 24/7'];
  const cw = chipsStr.map(s => measure(s, 30, 800) + 48), gap = 14;
  let cx = 540 - (cw[0] + cw[1] + gap) / 2;
  const chips = chipsStr.map((s, i) => {
    const c = el('g', null, g);
    el('rect', { x: cx, y: 546, width: cw[i], height: 64, rx: 32, fill: i ? C.ink : C.lemon }, c);
    text(c, s, { x: cx + cw[i] / 2, y: 588, 'font-size': 30, 'font-weight': 800, fill: i ? C.white : C.ink, 'text-anchor': 'middle' });
    cx += cw[i] + gap;
    return c;
  });
  const apps = `Приложение: iPhone — ${IOS_LIVE ? 'в App Store' : 'скоро'} · Android — ${ANDROID_LIVE ? 'в Google Play' : 'скоро'}`;
  const store = text(g, apps, { x: 540, y: 676, 'font-size': 28, 'font-weight': 700, fill: C.inkSoft, 'text-anchor': 'middle' });
  on(t => {
    const vis = t > T.end;
    show(g, vis);
    if (!vis) return;
    lock.setAttribute('opacity', ease.out3(P(t, T.end + 0.2, 0.4)));
    pose(lock, { y: (1 - ease.outExpo(P(t, T.end + 0.2, 0.6))) * 24 });
    url.set(P(t, T.end + 0.3, 0.7));
    line.set(P(t, T.end + 0.5, 0.7));
    chips.forEach((c, i) => {
      const p = ease.outExpo(P(t, T.end + 0.75 + i * 0.12, 0.5));
      const s = 0.9 + 0.1 * p;
      pose(c, { x: 540 * (1 - s), y: 578 * (1 - s), s, o: p * 1.5 });
    });
    store.setAttribute('opacity', P(t, T.end + 1.0, 0.4));
  });
}
