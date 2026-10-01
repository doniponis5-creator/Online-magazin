// Общие кирпичики для всех роликов: цвета сайта, знак «S», иконки, движение, текст.

export const W = 1080, H = 1920;
export const C = {
  lemon: '#eaf500', lemonHover: '#dce600', lemonSoft: '#f9fbdc', added: '#d9ee3a',
  ink: '#263244', inkSoft: '#4b5b70', muted: '#5d6d7e', white: '#ffffff', surface: '#f7f9fc',
  story: '#f3f2ed', bg: '#f6f7f2', border: '#e3e8ee', borderStrong: '#c4cdd8',
  blue: '#2563eb', ice: '#eaf3ff', red: '#d33b2e', green: '#1e9e5a', greenSoft: '#e1f4e9', orange: '#e89a2c',
};
// Знак «S» с сайта (viewBox 55.96 × 100): три детали.
export const LOGO_D = 'M3.09 26.51L3.68 26.8L3.68 27.25L4.57 28.28L6.77 29.6L35.2 40.8L43.3 43.59L46.69 45.36L48.9 47.13L50.81 49.04L53.02 51.99L54.34 54.49L55.52 58.32L55.96 61.71L55.82 65.24L54.93 69.07L53.31 72.75L52.58 73.2L52.14 72.31L50.96 71.13L49.04 70.1L46.24 69.22L42.71 67.6L40.65 67.01L32.55 63.62L29.31 62.59L24.59 60.53L10.9 55.38L6.48 52.28L4.57 50.37L2.06 46.69L0.74 43.3L0 39.62L0 34.9L0.44 32.55L1.33 29.75L3.09 26.51ZM27.54 63.62L50.07 72.46L50.96 73.64L50.96 75.41L50.52 76.44L48.9 78.06L45.07 80.56L21.06 90.87L18.26 92.34L12.37 94.7L11.93 95.14L9.28 96.02L0.88 99.85L0 100L0 81.89L1.18 78.35L2.5 76.29L4.12 74.52L6.04 73.05L15.91 68.92L17.08 68.19L27.54 63.62ZM55.38 0L55.82 0.15L55.82 17.82L55.52 19.29L54.49 22.09L53.61 23.42L49.93 26.95L29.01 36.08L27.98 36.08L12.81 30.04L10.75 29.46L8.84 28.42L6.33 27.54L5.3 26.66L5.01 25.04L5.6 23.27L8.54 20.77L10.01 19.88L55.38 0Z';
export const ICONS = {
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  arrow: '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
};

export const NS = 'http://www.w3.org/2000/svg';
let defs, probe, uid = 0;
export function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
export function text(parent, str, attrs) {
  const n = el('text', { 'font-family': 'Manrope', ...attrs }, parent);
  n.textContent = str;
  return n;
}
// Создаёт SVG-сцену 1080×1920 внутри #stage; возвращает её и <defs>.
export function initSvg(stage) {
  const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
  svg.setAttribute('class', 'abs');
  stage.appendChild(svg);
  defs = el('defs', null, svg);
  probe = text(el('g', { opacity: 0 }, svg), '', {});
  return { svg, defs };
}
export async function loadFonts() {
  await Promise.all(['800', '700', '600', '500'].map(w => document.fonts.load(`${w} 40px Manrope`, 'Смарт Центр 0123 Aa «»—')));
  await document.fonts.ready;
}
// Ждём, пока все картинки сцены будут декодированы — иначе первый кадр с ними может выйти пустым.
export async function preloadImages(root) {
  const srcs = new Set();
  root.querySelectorAll('image').forEach(n => srcs.add(n.getAttribute('href')));
  await Promise.all([...srcs].map(src => { const i = new Image(); i.src = src; return i.decode().catch(() => {}); }));
}

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
export const P = (t, a, d) => clamp((t - a) / d);
export const bump = p => Math.sin(Math.PI * clamp(p));
export const ease = {
  in2: p => p * p,
  out3: p => 1 - (1 - p) ** 3,
  inOut3: p => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
  outExpo: p => (p >= 1 ? 1 : 1 - 2 ** (-10 * p)),
  outBack: (p, s = 1.7) => 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2,
};
// Затухающая пружина — для предметов, которые физически «садятся» на место.
export const settle = (p, amp, freq = 16, decay = 6) => (p <= 0 || p >= 1 ? 0 : amp * Math.exp(-decay * p) * Math.cos(freq * p));
export function pose(n, { x = 0, y = 0, s = 1, r = 0, o } = {}) {
  let tr = `translate(${x.toFixed(2)} ${y.toFixed(2)})`;
  if (r) tr += ` rotate(${r.toFixed(3)})`;
  if (s !== 1) tr += ` scale(${s.toFixed(4)})`;
  n.setAttribute('transform', tr);
  if (o !== undefined) n.setAttribute('opacity', clamp(o).toFixed(3));
}
export const show = (n, on) => { n.style.display = on ? '' : 'none'; };
export const money = v => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export const mix = (a, b, p) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], p))).join(',')})`; };
export function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }
export function measure(str, size, weight = 800, ls = 0) {
  probe.setAttribute('font-size', size);
  probe.setAttribute('font-weight', weight);
  probe.setAttribute('letter-spacing', ls ? `${ls}em` : '0');
  probe.textContent = str;
  return probe.getComputedTextLength();
}
export function wrap(str, maxW, size, weight) {
  const lines = [];
  let cur = '';
  for (const w of str.split(' ')) {
    const t = cur ? `${cur} ${w}` : w;
    if (!cur || measure(t, size, weight) <= maxW) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
export function icon(parent, name, { x = 0, y = 0, size = 24, color = C.ink, sw = 2, fill = 'none' } = {}) {
  const g = el('g', { transform: `translate(${x - size / 2} ${y - size / 2}) scale(${size / 24})`, fill, stroke: color, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
  g.innerHTML = ICONS[name];
  return g;
}
export function clipRect(x, y, w, h, rx = 0) {
  const id = `c${++uid}`;
  const cp = el('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }, defs);
  el('rect', { x, y, width: w, height: h, rx }, cp);
  return `url(#${id})`;
}
export function clipPathOf(d, transform) {
  const id = `p${++uid}`;
  const cp = el('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }, defs);
  el('path', { d, transform }, cp);
  return `url(#${id})`;
}
// Скруглённый прямоугольник с разными углами: [левый верх, правый верх, правый низ, левый низ].
export function rrect(parent, x, y, w, h, [a, b, c, d], attrs) {
  const dpath = `M${x + a} ${y}H${x + w - b}Q${x + w} ${y} ${x + w} ${y + b}V${y + h - c}Q${x + w} ${y + h} ${x + w - c} ${y + h}H${x + d}Q${x} ${y + h} ${x} ${y + h - d}V${y + a}Q${x} ${y} ${x + a} ${y}Z`;
  return el('path', { d: dpath, ...attrs }, parent);
}
// Строка, выезжающая из-под маски.
export function maskLine(parent, str, { x, y, size, weight = 800, fill = C.ink, anchor = 'start', ls = 0 }) {
  const w = measure(str, size, weight, ls);
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  const g = el('g', { 'clip-path': clipRect(x0 - size * 0.3, y - size * 1.05, w + size * 0.6, size * 1.38) }, parent);
  const inner = el('g', null, g);
  text(inner, str, { x: x0, y, 'font-size': size, 'font-weight': weight, fill, 'letter-spacing': ls ? `${ls}em` : null });
  return {
    g, w, x0,
    set(pIn, pOut = 0) {
      const dy = (1 - ease.outExpo(pIn)) * size * 1.25 - ease.outExpo(pOut) * size * 1.25;
      inner.setAttribute('transform', `translate(0 ${dy.toFixed(2)})`);
      show(g, pIn > 0 && pOut < 1);
    },
  };
}
export function buildMark(parent, color) {
  const g = el('g', null, parent);
  el('path', { d: LOGO_D, fill: color }, g);
  return g;
}
export function brandIcon(parent, d, { x, y, size, color = C.white }) {
  const g = el('g', { transform: `translate(${x - size / 2} ${y - size / 2}) scale(${size / 24})`, fill: color }, parent);
  el('path', { d }, g);
  return g;
}
