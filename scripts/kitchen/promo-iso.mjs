// Изометрическая кухня для блока «Соберите свою кухню в 3D» на главной:
// считает проекцию и пишет SVG. Запуск из папки проекта:
//   node scripts/kitchen/promo-iso.mjs public/kitchen/kitchen-iso.svg
// Печатает, где стоят подписи (в процентах) — их вписать в KitchenPromo.tsx,
// а в адресе картинки поднять ?v=, чтобы браузеры взяли новую.
import { writeFileSync } from 'node:fs'

const OUT = process.argv[2]
const C = Math.cos(Math.PI / 6)
const S = 0.5

// комната, см
const L = 420 // задняя стена (ось x)
const W = 220 // боковая стена (ось y)
const H = 230
const T = 10 // толщина стен
const F = 14 // толщина пола

// палитра сайта: белый, облачный, ледяной, графит, лимон, кобальт
const ink = '#263244'
const knob = '#6f7c8f'
const line = '#b9c4d2'
const warm = '#c9ad86'
const col = {
  floor: '#f2e9dc',
  tile: '#e6d9c6',
  slabY: '#e4d6c1',
  slabX: '#d6c5ab',
  wallBack: '#ffffff',
  wallSide: '#f6f4f0',
  wallTop: '#ebe6de',
  wallEndX: '#f1ede7',
  wallEndY: '#e9e4dc',
  skirt: '#efe9e0',
  front: '#ffffff',
  frontX: '#f3f4f6',
  sideX: '#eceef1',
  topCab: '#fcfcfd',
  plinth: '#cdb89a',
  wood: '#e8d2b0',
  woodX: '#dcc39e',
  woodSide: '#d3b78f',
  stoneTop: '#f9f8f5',
  stoneY: '#e9e6df',
  stoneX: '#dedad1',
  oakY: '#d6b387',
  oakX: '#caa476',
  steel: '#e5eaf0',
  steelX: '#cfd7e1',
  steelTop: '#f1f4f7',
  glass: '#d6e5fa',
  glassHi: '#eaf2fe',
  lemon: '#eaf500',
  lemonShade: '#cdd700',
  leaf: '#7ea78a',
  leafDark: '#5f8b6d',
  cobalt: '#2563eb',
}

let k = 1
let ox = 0
let oy = 0
const P = (x, y, z) => [(x - y) * C * k + ox, ((x + y) * S - z) * k + oy]
const f1 = (v) => Math.round(v * 10) / 10
const pts = (arr) => arr.map(([x, y, z]) => P(x, y, z).map(f1).join(',')).join(' ')

let out = []
const poly = (arr, fill, extra = '') => out.push(`<polygon points="${pts(arr)}" fill="${fill}"${extra}/>`)
const edge = (arr, fill, stroke = line) => poly(arr, fill, ` stroke="${stroke}" stroke-width="1.1" stroke-linejoin="round"`)
const seg = (a, b, stroke, w = 1.2, extra = '') => {
  const [x1, y1] = P(...a).map(f1)
  const [x2, y2] = P(...b).map(f1)
  out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"${extra}/>`)
}
/** Круг на горизонтальной плоскости — в изометрии эллипс. */
const disc = (cx, cy, z, r, fill, extra = '') => {
  const [x, y] = P(cx, cy, z).map(f1)
  out.push(`<ellipse cx="${x}" cy="${y}" rx="${f1(r * Math.SQRT2 * C * k)}" ry="${f1(r * Math.SQRT2 * S * k)}" fill="${fill}"${extra}/>`)
}

// Грани коробки, которые видно: верх, лицо к зрителю слева (+y) и справа (+x).
function box(x0, y0, z0, x1, y1, z1, c) {
  const st = c.stroke ?? line
  if (c.top) edge([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], c.top, st)
  if (c.y) edge([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], c.y, st)
  if (c.x) edge([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], c.x, st)
}
// прямоугольник на плоскости y = const (лицо шкафа у задней стены)
const rectY = (y, x0, x1, z0, z1, fill, stroke = true, color = line) =>
  stroke ? edge([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], fill, color) : poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], fill)
// прямоугольник на плоскости x = const (лицо шкафа у боковой стены)
const rectX = (x, y0, y1, z0, z1, fill, stroke = true, color = line) =>
  stroke ? edge([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]], fill, color) : poly([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]], fill)

/* ───────── нижние шкафы ───────── */

const BASE = 86
const DEPTH = 58
function baseCab(x0, x1, kind) {
  // цоколь утоплен на 4 см, над ним корпус с фасадом
  box(x0, 0, 0, x1, DEPTH - 4, 10, { y: col.plinth, x: col.plinth, stroke: warm })
  box(x0, 0, 10, x1, DEPTH, BASE, { y: col.wood, x: col.woodSide, stroke: warm })
  const y = DEPTH + 0.2
  const pad = 2
  if (kind === 'drawers3' || kind === 'drawers2') {
    const n = kind === 'drawers3' ? 3 : 2
    const h = (BASE - 10 - pad * (n + 1)) / n
    for (let i = 0; i < n; i++) {
      const z0 = 10 + pad + i * (h + pad)
      rectY(y, x0 + pad, x1 - pad, z0, z0 + h, col.wood, true, warm)
      const mid = (x0 + x1) / 2
      seg([mid - 9, y + 0.5, z0 + h - 6], [mid + 9, y + 0.5, z0 + h - 6], knob, 2, ' stroke-opacity="0.9"')
    }
  } else if (kind === 'doors2') {
    const mid = (x0 + x1) / 2
    rectY(y, x0 + pad, mid - 1, 12, BASE - 2, col.wood, true, warm)
    rectY(y, mid + 1, x1 - pad, 12, BASE - 2, col.wood, true, warm)
    seg([mid - 4, y + 0.5, BASE - 12], [mid - 4, y + 0.5, BASE - 26], knob, 2, ' stroke-opacity="0.9"')
    seg([mid + 4, y + 0.5, BASE - 12], [mid + 4, y + 0.5, BASE - 26], knob, 2, ' stroke-opacity="0.9"')
  } else if (kind === 'door') {
    rectY(y, x0 + pad, x1 - pad, 12, BASE - 2, col.wood, true, warm)
    seg([x1 - 8, y + 0.5, BASE - 12], [x1 - 8, y + 0.5, BASE - 26], knob, 2, ' stroke-opacity="0.9"')
  } else if (kind === 'dishwasher') {
    rectY(y, x0 + pad, x1 - pad, 12, BASE - 2, col.wood, true, warm)
    seg([x0 + 12, y + 0.5, BASE - 9], [x1 - 12, y + 0.5, BASE - 9], knob, 2, ' stroke-opacity="0.9"')
  } else if (kind === 'oven') {
    // духовка: чёрное стекло, светлое окно, панель управления
    rectY(y, x0 + pad, x1 - pad, 12, BASE - 2, '#2b3548')
    rectY(y + 0.3, x0 + 7, x1 - 7, 20, 58, '#3d4a61', false)
    poly([[x0 + 12, y + 0.4, 22], [x0 + 24, y + 0.4, 22], [x0 + 36, y + 0.4, 56], [x0 + 24, y + 0.4, 56]], 'rgba(255,255,255,0.10)')
    seg([x0 + 10, y + 0.6, 64], [x1 - 10, y + 0.6, 64], '#c4cdd8', 2.4)
    seg([x0 + 12, y + 0.6, 76], [x0 + 12.5, y + 0.6, 76], '#c4cdd8', 4)
    seg([x1 - 12, y + 0.6, 76], [x1 - 11.5, y + 0.6, 76], '#c4cdd8', 4)
    rectY(y + 0.4, x0 + 24, x1 - 24, 72, 80, '#1c2433', false)
  }
}

// лицо шкафа у боковой стены смотрит в +x
function sideCab(y0, y1, kind) {
  box(0, y0, 0, DEPTH - 4, y1, 10, { y: col.plinth, x: col.plinth, stroke: warm })
  box(0, y0, 10, DEPTH, y1, BASE, { y: col.woodSide, x: col.woodX, stroke: warm })
  const x = DEPTH + 0.2
  const pad = 2
  if (kind === 'drawers3') {
    const h = (BASE - 10 - pad * 4) / 3
    for (let i = 0; i < 3; i++) {
      const z0 = 10 + pad + i * (h + pad)
      rectX(x, y0 + pad, y1 - pad, z0, z0 + h, col.woodX, true, warm)
      const mid = (y0 + y1) / 2
      seg([x + 0.5, mid - 9, z0 + h - 6], [x + 0.5, mid + 9, z0 + h - 6], knob, 2, ' stroke-opacity="0.9"')
    }
  } else {
    rectX(x, y0 + pad, y1 - pad, 12, BASE - 2, col.woodX, true, warm)
    seg([x + 0.5, y0 + 8, BASE - 12], [x + 0.5, y0 + 8, BASE - 26], knob, 2, ' stroke-opacity="0.9"')
  }
}

/* ───────── верхние шкафы ───────── */

const UP0 = 146
const UP1 = 222
const UPD = 34
function upperBack(x0, x1, doors = 1) {
  box(x0, 0, UP0, x1, UPD, UP1, { top: col.topCab, y: col.front, x: col.sideX })
  const y = UPD + 0.2
  if (doors === 2) {
    const mid = (x0 + x1) / 2
    rectY(y, x0 + 2, mid - 1, UP0 + 2, UP1 - 2, col.front)
    rectY(y, mid + 1, x1 - 2, UP0 + 2, UP1 - 2, col.front)
    seg([mid - 4, y + 0.5, UP0 + 8], [mid - 4, y + 0.5, UP0 + 22], knob, 2, ' stroke-opacity="0.9"')
    seg([mid + 4, y + 0.5, UP0 + 8], [mid + 4, y + 0.5, UP0 + 22], knob, 2, ' stroke-opacity="0.9"')
  } else {
    rectY(y, x0 + 2, x1 - 2, UP0 + 2, UP1 - 2, col.front)
    seg([x1 - 8, y + 0.5, UP0 + 8], [x1 - 8, y + 0.5, UP0 + 22], knob, 2, ' stroke-opacity="0.9"')
  }
}
function upperSide(y0, y1) {
  box(0, y0, UP0, UPD, y1, UP1, { top: col.topCab, y: col.front, x: col.frontX })
  const x = UPD + 0.2
  rectX(x, y0 + 2, y1 - 2, UP0 + 2, UP1 - 2, col.frontX)
  seg([x + 0.5, y1 - 8, UP0 + 8], [x + 0.5, y1 - 8, UP0 + 22], knob, 2, ' stroke-opacity="0.9"')
}

/* ───────── сцена ───────── */

function scene() {
  out = []
  // пол: торцы плиты, потом верх с плиткой
  edge([[-T, W, -F], [L, W, -F], [L, W, 0], [-T, W, 0]], col.slabY)
  edge([[L, -T, -F], [L, W, -F], [L, W, 0], [L, -T, 0]], col.slabX)
  poly([[0, 0, 0], [L, 0, 0], [L, W, 0], [0, W, 0]], col.floor)
  for (let y = 22; y < W; y += 22) seg([0, y, 0], [L, y, 0], col.tile, 1)
  // мягкая тень у шкафов на полу
  poly([[0, 58, 0], [350, 58, 0], [350, 70, 0], [0, 70, 0]], 'rgba(120, 95, 60, 0.10)')
  poly([[58, 58, 0], [70, 58, 0], [70, 178, 0], [58, 178, 0]], 'rgba(120, 95, 60, 0.10)')
  poly([[350, 66, 0], [420, 66, 0], [420, 76, 0], [350, 76, 0]], 'rgba(120, 95, 60, 0.10)')
  // стены: внутренние грани, плинтус, торцы и верх
  edge([[0, 0, 0], [L, 0, 0], [L, 0, H], [0, 0, H]], col.wallBack)
  edge([[0, 0, 0], [0, W, 0], [0, W, H], [0, 0, H]], col.wallSide)
  poly([[0, 0.3, 0], [L, 0.3, 0], [L, 0.3, 8], [0, 0.3, 8]], col.skirt)
  poly([[0.3, 0, 0], [0.3, W, 0], [0.3, W, 8], [0.3, 0, 8]], col.skirt)
  edge([[L, -T, 0], [L, 0, 0], [L, 0, H], [L, -T, H]], col.wallEndX)
  edge([[-T, W, 0], [0, W, 0], [0, W, H], [-T, W, H]], col.wallEndY)
  edge([[-T, -T, H], [L, -T, H], [L, 0, H], [0, 0, H], [0, W, H], [-T, W, H]], col.wallTop)
  // окно над мойкой
  const wx0 = 224
  const wx1 = 296
  rectY(0.4, wx0, wx1, 108, 206, '#ffffff')
  rectY(0.6, wx0 + 5, wx1 - 5, 113, 201, col.glass, false)
  poly([[wx0 + 12, 0.8, 113], [wx0 + 30, 0.8, 113], [wx0 + 58, 0.8, 201], [wx0 + 40, 0.8, 201]], col.glassHi)
  seg([(wx0 + wx1) / 2, 0.9, 113], [(wx0 + wx1) / 2, 0.9, 201], '#ffffff', 3)
  seg([wx0 + 5, 0.9, 157], [wx1 - 5, 0.9, 157], '#ffffff', 2.4)
  box(wx0 - 4, 0, 104, wx1 + 4, 7, 108, { top: '#f7f9fc', y: col.wallTop, x: col.wallTop })
  // растение на подоконнике
  box(wx0 + 8, 1, 108, wx0 + 18, 6, 116, { top: '#d8dfe8', y: '#e8edf3', x: '#d8dfe8' })
  for (const [dx, dz, c] of [[-3, 12, col.leafDark], [4, 14, col.leaf], [0, 18, col.leaf]]) {
    disc(wx0 + 13 + dx, 3.5, 116 + dz, 4.2, c)
  }

  // задний ряд, слева направо
  baseCab(0, 60, 'door')
  baseCab(60, 120, 'drawers3')
  baseCab(120, 180, 'oven')
  baseCab(180, 230, 'drawers2')
  baseCab(230, 290, 'doors2')
  baseCab(290, 340, 'dishwasher')
  // доборная планка у холодильника
  box(340, 0, 10, 350, DEPTH, BASE, { y: col.wood, x: col.woodSide, stroke: warm })
  box(340, 0, 0, 350, DEPTH - 4, 10, { y: col.plinth, x: col.plinth, stroke: warm })
  // столешница, варочная, мойка
  box(0, 0, BASE, 350, 62, BASE + 4, { top: col.stoneTop, y: col.stoneY, x: col.stoneX })
  edge([[128, 8, BASE + 4.2], [172, 8, BASE + 4.2], [172, 52, BASE + 4.2], [128, 52, BASE + 4.2]], ink)
  for (const [cx, cy, r] of [[139, 19, 7], [161, 19, 5.5], [139, 41, 5.5], [161, 41, 7]]) {
    disc(cx, cy, BASE + 4.4, r, 'none', ` stroke="#55647a" stroke-width="1.4"`)
  }
  edge([[240, 10, BASE + 4.2], [280, 10, BASE + 4.2], [280, 48, BASE + 4.2], [240, 48, BASE + 4.2]], '#d3dae3')
  poly([[244, 14, BASE + 4.3], [276, 14, BASE + 4.3], [276, 44, BASE + 4.3], [244, 44, BASE + 4.3]], '#c1cad5')
  seg([260, 5, BASE + 4], [260, 5, BASE + 30], ink, 3)
  seg([260, 5, BASE + 30], [260, 18, BASE + 30], ink, 3)
  seg([260, 18, BASE + 30], [260, 18, BASE + 25], ink, 3)
  // разделочная доска у стены
  poly([[190, 1.5, BASE + 4], [216, 1.5, BASE + 4], [216, 4, BASE + 38], [190, 4, BASE + 38]], col.oakY)
  poly([[190, 1.6, BASE + 4], [216, 1.6, BASE + 4], [216, 1.6, BASE + 6], [190, 1.6, BASE + 6]], col.oakX)

  // холодильник в конце ряда и шкаф над ним
  box(350, 0, 0, L, 66, 200, { top: col.steelTop, y: col.steel, x: col.steelX })
  seg([350.5, 66.2, 128], [L - 0.5, 66.2, 128], line, 1.4)
  seg([358, 66.4, 136], [358, 66.4, 176], ink, 3)
  seg([358, 66.4, 110], [358, 66.4, 84], ink, 3)
  box(350, 0, 204, L, 60, H, { top: col.topCab, y: col.front, x: col.sideX })
  rectY(60.2, 352, L - 2, 206, H - 2, col.front)

  // боковой ряд: шкафы и столешница
  sideCab(DEPTH, 118, 'door')
  sideCab(118, 178, 'drawers3')
  box(0, 58, BASE, 62, 178, BASE + 4, { top: col.stoneTop, y: col.stoneY, x: col.stoneX })
  // ваза с лимонами на боковой столешнице
  disc(32, 140, BASE + 4.2, 13, '#ffffff', ` stroke="${line}" stroke-width="1.1"`)
  for (const [dx, dy, dz] of [[-4, -3, 7], [5, -1, 7], [0, 5, 7], [1, -1, 12]]) {
    disc(32 + dx, 140 + dy, BASE + dz, 5.4, col.lemonShade)
    disc(32 + dx - 0.6, 140 + dy - 0.6, BASE + dz + 1, 4.6, col.lemon)
  }

  // верхние шкафы, вытяжка
  upperBack(0, 60)
  upperBack(60, 120)
  box(140, 0, 150, 160, 18, H, { y: col.steel, x: col.steelX })
  box(124, 0, 140, 176, 44, 150, { top: col.steelTop, y: col.steel, x: col.steelX })
  poly([[124.5, 44.2, 140], [175.5, 44.2, 140], [175.5, 44.2, 142.5], [124.5, 44.2, 142.5]], ink)
  upperBack(180, 220)
  upperBack(300, 350)
  upperSide(60, 118)
  upperSide(118, 178)

  // выбранный шкаф: кобальтовая рамка, как в конструкторе
  const sel = [120, 0, 0, 180, DEPTH, BASE]
  const [a0, b0, c0, a1, b1, c1] = sel
  for (const [p, q] of [
    [[a0, b1, c0], [a1, b1, c0]],
    [[a1, b1, c0], [a1, b1, c1]],
    [[a1, b1, c1], [a0, b1, c1]],
    [[a0, b1, c1], [a0, b1, c0]],
    [[a0, b0, c1], [a0, b1, c1]],
    [[a1, b0, c1], [a1, b1, c1]],
    [[a0, b0, c1], [a1, b0, c1]],
  ]) {
    seg(p, q, col.cobalt, 2.4)
  }
  for (const p of [[a0, b1, c1], [a1, b1, c1], [a0, b1, c0], [a1, b1, c0]]) {
    const [x, y] = P(...p).map(f1)
    out.push(`<rect x="${f1(x - 4)}" y="${f1(y - 4)}" width="8" height="8" rx="2" fill="#ffffff" stroke="${col.cobalt}" stroke-width="2"/>`)
  }

  // размеры стен сверху — как подписи в конструкторе
  const up = H + 30
  seg([0, -T / 2, up], [L, -T / 2, up], col.cobalt, 1.6)
  seg([-T / 2, 0, up], [-T / 2, W, up], col.cobalt, 1.6)
  for (const p of [[0, -T / 2], [L, -T / 2]]) seg([p[0], p[1], H + 4], [p[0], p[1], up + 8], col.cobalt, 1.2, ' stroke-dasharray="3 4"')
  for (const p of [[-T / 2, W]]) seg([p[0], p[1], H + 4], [p[0], p[1], up + 8], col.cobalt, 1.2, ' stroke-dasharray="3 4"')
  return out.join('\n')
}

/* ───────── кадр: вписать сцену в 1200 × 960 ───────── */

const VW = 1200
const VH = 960
const probe = [
  [-T, -T, H + 48], [L, -T, H + 48], [-T, W, H + 48],
  [-T, W, -F], [L, W, -F], [L, -T, -F],
]
k = 1
ox = 0
oy = 0
const xs = probe.map((p) => P(...p)[0])
const ys = probe.map((p) => P(...p)[1])
const bw = Math.max(...xs) - Math.min(...xs)
const bh = Math.max(...ys) - Math.min(...ys)
// сверху место под подписи стен, снизу — под мягкую тень
const TOP = 34
const BOTTOM = 58
const SIDE = 30
k = Math.min((VW - SIDE * 2) / bw, (VH - TOP - BOTTOM) / bh)
ox = VW / 2 - ((Math.max(...xs) + Math.min(...xs)) / 2) * k
oy = TOP - Math.min(...ys) * k + ((VH - TOP - BOTTOM) - bh * k) / 2

const body = scene()
// мягкая тень под макетом
const [sx, sy] = P(L / 2, W / 2, -F)
const shadow = `<ellipse cx="${f1(sx)}" cy="${f1(sy + 16)}" rx="${f1(L * 0.7 * k)}" ry="${f1(W * 0.3 * k)}" fill="#263244" opacity="0.10" filter="url(#soft)"/>`
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}">
<defs><filter id="soft" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="28"/></filter></defs>
${shadow}
${body}
</svg>
`
writeFileSync(OUT, svg)

// где поставить HTML-подписи: доли ширины и высоты картинки
const pct = ([x, y]) => [f1((x / VW) * 100), f1((y / VH) * 100)]
console.log(JSON.stringify({
  k: f1(k * 100) / 100,
  a: pct(P(L / 2, -T / 2, H + 30)),
  b: pct(P(-T / 2, W / 2, H + 30)),
  sel: pct(P(150, DEPTH, BASE + 6)),
  bytes: svg.length,
}))
