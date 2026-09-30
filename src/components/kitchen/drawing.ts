import { WINDOW_GAP } from '@/lib/kitchen/dims'
import { DEPTH, UPPER_DEPTH, type Plan } from '@/lib/kitchen/layout'
import { modulesOf, type DimsKind, type SpecBox, type SpecData, type SpecFront, type SpecRun } from '@/lib/kitchen/spec'
import type { KitchenAppliance, SlotKind } from '@/lib/kitchen/types'
import { rectOf } from './planGeom'
import type { KitchenTexts } from './texts'

/**
 * Развёртка стены — чертёж, как у мебельщика: шкафы и фасады в масштабе,
 * стрелки открывания дверец, цепочки ширин снизу (низ) и сверху (верх с окном),
 * отметки высот справа, колонны — слева, высота вытяжки над панелью.
 * Возвращает готовый SVG строкой: он же идёт на страницу и в PDF.
 * Единицы чертежа — сантиметры. Здесь же план сверху для PDF.
 */

const CARCASS: DimsKind[] = [
  'base',
  'drawers',
  'sinkBase',
  'hobBase',
  'ovenBase',
  'corner',
  'bottle',
  'filler',
  'openBase',
  'tall',
  'pantry',
  'upper',
  'vitrine',
  'lift',
  'antresol',
  'overFridge',
  'mantel',
  'shelf',
]

export type DrawingLabels = {
  cm: string
  /** подпись техники по её месту */
  appliance: (slot: string) => string
  /** отрезок цепочки, занятый угловым шкафом соседней стены */
  corner: string
  /** с какой стороны смотрим: у стены и у острова */
  view: string
  islandView: string
  /** подпись к высоте «низ вытяжки — панель» */
  hoodOver: string
  /** рамка отдельностоящей плиты (`t.stove.name`); нет — как у варочной */
  stove?: string
  /** подпись шкафа под мойку (P3: мастер видит мойку, как духовку и вытяжку); нет — без подписи */
  sink?: string
  /** разрез острова со свесом */
  section: string
  /** высоты окна типовые (покупатель их не вводил): подоконник и верх, см */
  windowNote: (sill: string, top: string) => string
}

export type ElevationOpts = {
  /** общий масштаб листа 1:N — одинаковый шрифт и размер на всех развёртках */
  scale?: number
  /** свес столешницы острова (`islandOverhang`): без него разрез острова не рисуется */
  overhang?: number
}

/** Стандартные масштабы чертежа. */
export const SCALES = [10, 15, 20, 25, 30, 40, 50, 60, 75, 100]
/** Место под один чертёж стены на листе A4 PDF, мм (две стены на лист). */
export const SHEET_BOX = { w: 180, h: 110 }
/** Место под план сверху на листе A4 PDF, мм. */
export const PLAN_BOX = { w: 180, h: 215 }
/** Высота цифр на бумаге, мм. */
const PAPER_FS = 2.6
/** Ширина буквы жирного Manrope в долях кегля, с запасом (в аудите — 0,61). */
const CHAR = 0.64

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
const n = (v: number) => (Math.round(v * 10) / 10).toString()
const fmt = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1).replace('.', ','))
const tw = (s: string, size: number) => s.length * CHAR * size

/** Кегль цифр чертежа (см) для масштаба 1:N; без масштаба — по длине стены, как раньше. */
const fsOf = (scale: number | undefined, span: number) => (scale ? (PAPER_FS * scale) / 10 : Math.max(7, (span + 120) / 52))

/** Рисовалка: копит элементы SVG и следит за рамкой рисунка. */
class Pen {
  out: string[] = []
  box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  constructor(public fs: number) {}
  grow(x0: number, y0: number, x1: number, y1: number) {
    this.box.x0 = Math.min(this.box.x0, x0, x1)
    this.box.y0 = Math.min(this.box.y0, y0, y1)
    this.box.x1 = Math.max(this.box.x1, x0, x1)
    this.box.y1 = Math.max(this.box.y1, y0, y1)
  }
  rect(x: number, y: number, w: number, h: number, cls: string) {
    this.out.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" class="${cls}"/>`)
    this.grow(x, y, x + w, y + h)
  }
  line(x1: number, y1: number, x2: number, y2: number, cls: string) {
    this.out.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" class="${cls}"/>`)
    this.grow(x1, y1, x2, y2)
  }
  /** Надпись; size — свой кегль (иначе общий), rotate — снизу вверх; data — атрибуты data-*. */
  text(x: number, y: number, s: string, cls: string, o: { size?: number; rotate?: boolean; anchor?: 'start' | 'middle' | 'end'; data?: Record<string, string> } = {}) {
    const size = o.size ?? this.fs
    const anchor = o.anchor ?? 'middle'
    const data = Object.entries(o.data ?? {})
      .map(([k, v]) => ` data-${k}="${esc(v)}"`)
      .join('')
    const style = o.size ? ` style="font-size:${n(size)}px"` : ''
    const rot = o.rotate ? ` transform="rotate(-90 ${n(x)} ${n(y)})"` : ''
    this.out.push(`<text x="${n(x)}" y="${n(y)}" class="${cls}" text-anchor="${anchor}" dominant-baseline="central"${style}${rot}${data}>${esc(s)}</text>`)
    const len = tw(s, size)
    const a = anchor === 'start' ? 0 : anchor === 'end' ? -len : -len / 2
    if (o.rotate) this.grow(x - size / 2, y - a - len, x + size / 2, y - a)
    else this.grow(x + a, y - size / 2, x + a + len, y + size / 2)
  }
  /** Штриховка прямоугольника линиями под 45° (разрез, торец). */
  hatch(x0: number, y0: number, x1: number, y1: number) {
    this.rect(x0, y0, x1 - x0, y1 - y0, 'el-cut')
    const step = this.fs * 0.55
    for (let c = x0 - y1 + step / 2; c < x1 - y0; c += step) {
      const ya = Math.max(y0, x0 - c)
      const yb = Math.min(y1, x1 - c)
      if (yb > ya) this.line(ya + c, ya, yb + c, yb, 'el-hatch')
    }
  }
  /**
   * Цепочка размеров по оси X на высоте y: число у каждого отрезка. Узкий
   * отрезок — мельче, ещё уже — повёрнутым числом. up — числа над линией.
   */
  chainX(cuts: number[], y: number, chain: string, up = true) {
    const fs = this.fs
    this.line(cuts[0], y, cuts[cuts.length - 1], y, 'el-dim')
    for (const c of cuts) this.line(c, y - fs * 0.45, c, y + fs * 0.45, 'el-dim')
    for (let i = 0; i < cuts.length - 1; i++) this.segLabel(cuts[i], cuts[i + 1], y, fmt(cuts[i + 1] - cuts[i]), { chain }, up)
  }
  segLabel(c0: number, c1: number, y: number, s: string, data: Record<string, string>, up = true) {
    const fs = this.fs
    const w = c1 - c0
    const cx = (c0 + c1) / 2
    const dir = up ? -1 : 1
    const fit = Math.min(fs, (w - fs * 0.15) / (s.length * CHAR))
    if (fit >= fs * 0.6) {
      this.text(cx, y + dir * fs * 0.62, s, 'el-num', { size: fit < fs ? fit : undefined, data })
      return
    }
    // узко: число поворачиваем, оно встаёт вдоль выносной линии
    const size = fs * 0.62
    const len = tw(s, size)
    this.text(cx, y + dir * (fs * 0.2 + len / 2), s, 'el-num', { size, rotate: true, data })
  }
  /**
   * Отметки высот столбиком: риска на линии, число справа (или слева).
   * Близкие числа раздвигаются и получают выноску.
   */
  marks(x: number, Y: (y: number) => number, values: number[], side: 'right' | 'left', cls = 'el-num') {
    const fs = this.fs
    const list = [...new Set(values.map((v) => Math.round(v * 10) / 10))].sort((a, b) => a - b)
    if (list.length < 2) return
    this.line(x, Y(list[0]), x, Y(list[list.length - 1]), 'el-dim')
    let last = Infinity
    const tx = side === 'right' ? x + fs * 0.9 : x - fs * 0.9
    for (const v of list) {
      this.line(x - fs * 0.45, Y(v), x + fs * 0.45, Y(v), 'el-dim')
      const at = Math.min(Y(v), last - fs * 1.05)
      if (Y(v) - at > fs * 0.15) this.line(side === 'right' ? x + fs * 0.45 : x - fs * 0.45, Y(v), side === 'right' ? tx - fs * 0.1 : tx + fs * 0.1, at, 'el-lead')
      this.text(tx, at, fmt(v), cls, { anchor: side === 'right' ? 'start' : 'end', data: { mark: '' } })
      last = at
    }
  }
  svg(extra: string, pad: number) {
    const b = this.box
    const vb = `${n(b.x0 - pad)} ${n(b.y0 - pad)} ${n(b.x1 - b.x0 + 2 * pad)} ${n(b.y1 - b.y0 + 2 * pad)}`
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" class="el" style="--el-fs:${n(this.fs)}px"${extra} role="img">${this.out.join('')}</svg>`
  }
}

export function elevationSvg(
  run: SpecRun,
  heights: SpecData['heights'],
  labels: DrawingLabels,
  window?: { at: number; w: number; sill: number; top: number } | null,
  opts: ElevationOpts = {},
): string {
  const L = run.length
  const island = run.id === 'I'
  const fs = fsOf(opts.scale, L)
  const p = new Pen(fs)
  const boxes = run.boxes
  const thick = run.tops[0]?.thick ?? 0
  // у острова нет стены: рисуем до верха самого высокого, а не до потолка
  const H = island ? Math.min(heights.ceiling, Math.max(heights.counter, ...boxes.map((b) => b.y + b.h)) + 5) : heights.ceiling
  const Y = (y: number) => H - y

  // стена, пол, окно
  if (!island) p.rect(0, 0, L, H, 'el-wall')
  p.line(-6, Y(0), L + 6, Y(0), 'el-floor')
  const win = !island && window ? { x0: Math.max(0, window.at - window.w / 2), x1: Math.min(L, window.at + window.w / 2), sill: window.sill, top: window.top } : null
  if (win) p.rect(win.x0, Y(win.top), win.x1 - win.x0, win.top - win.sill, 'el-window')

  // угол: торец углового шкафа соседней стены (то же правило, что в списке для мастера)
  const mods = [...run.modules].sort((a, b) => a.x - b.x)
  const { upper } = modulesOf(run)
  const corners = island ? [] : cornerZones(L, mods, run.gaps)
  for (const z of corners) {
    p.hatch(z.x0, Y(heights.counter), z.x1, Y(0))
    if (upper.length) p.hatch(z.up[0], Y(heights.upperTop), z.up[1], Y(heights.upperBottom))
  }

  // рамки: столешница, панели, корпуса, фасады, техника
  for (const b of boxes.filter((b) => b.kind === 'top' || b.kind === 'island')) p.rect(b.x, Y(b.y + b.h), b.w, b.h, 'el-top')
  for (const b of boxes.filter((b) => b.kind === 'panel')) p.rect(b.x, Y(b.y + b.h), b.w, b.h, 'el-panel')
  for (const b of boxes.filter((b) => CARCASS.includes(b.kind))) p.rect(b.x, Y(b.y + b.h), b.w, b.h, 'el-box')
  for (const f of run.fronts) front(p, f, Y)
  for (const b of boxes.filter((b) => b.kind === 'appliance')) appliance(p, b, Y, labels)
  // шкаф под мойку — подпись в верхней части фасада, вписана в ширину
  if (labels.sink)
    for (const b of boxes.filter((b) => b.kind === 'sinkBase')) {
      const size = Math.min(p.fs, (b.w - Math.min(4, b.w * 0.12)) / (labels.sink.length * CHAR))
      if (size >= p.fs * 0.5) p.text(b.x + b.w / 2, Y(b.y + b.h * 0.78), labels.sink, 'el-cap', { size: size < p.fs ? size : undefined, data: { label: 'sink' } })
    }

  // низ вдоль пола: каждый модуль и угол; ниже — общая длина
  const round = (v: number) => Math.round(v * 10) / 10
  const lowCuts = [...new Set([0, L, ...mods.flatMap((m) => [round(m.x), round(m.x + m.w)])])].sort((a, b) => a - b)
  const chainY = Y(0) + fs * 1.9
  p.chainX(lowCuts, chainY, 'low')
  for (const z of corners) p.text((z.x0 + z.x1) / 2, chainY + fs * 0.75, labels.corner, 'el-cap', { size: fs * 0.72 })
  const totalY = chainY + fs * 2.3
  p.line(0, totalY, L, totalY, 'el-dim')
  for (const c of [0, L]) p.line(c, totalY - fs * 0.45, c, totalY + fs * 0.45, 'el-dim')
  p.text(L / 2, totalY - fs * 0.62, `${fmt(L)} ${labels.cm}`, 'el-num el-num--total')
  p.text(0, totalY + fs * 1.3, island ? labels.islandView : labels.view, 'el-cap', { anchor: 'start', size: fs * 0.8 })
  // высоты окна покупатель не вводил — это типовые из 3D, мастер меряет на месте
  if (win) {
    const note = labels.windowNote(fmt(win.sill), fmt(win.top))
    const lines = tw(note, fs * 0.8) > L && note.includes(' — ') ? note.split(' — ') : [note]
    lines.forEach((s, i) => p.text(0, totalY + fs * (2.4 + i), s, 'el-cap', { anchor: 'start', size: fs * 0.8, data: { cap: 'window' } }))
  }

  // верх над чертежом: шкафы, окно отдельным отрезком
  if (!island && (upper.length || win)) {
    const edges = [...upper.flatMap((b) => [b.x, b.x + b.w]), ...(win ? [win.x0, win.x1] : [])].map(round)
    const cuts = [...new Set([0, L, ...edges.filter((c) => c > 0 && c < L)])].sort((a, b) => a - b)
    p.chainX(cuts, Y(H) - fs * 1.9, 'up')
  }

  // высота низа вытяжки над панелью, у отдельностоящей плиты — над её верхом
  const hood = boxes.find((b) => b.slot === 'hood')
  const stove = boxes.find((b) => b.stove)
  const cook = stove ? stove.y + stove.h : heights.counter
  const over = hood ? hood.y - cook : 0
  if (hood && over > 5) {
    const x = hood.x + hood.w / 2
    p.line(x, Y(cook), x, Y(hood.y), 'el-dim')
    for (const y of [cook, hood.y]) p.line(x - fs * 0.45, Y(y), x + fs * 0.45, Y(y), 'el-dim')
    const mid = Y(cook + over / 2)
    p.text(x + fs * 0.35, mid, fmt(over), 'el-num', { anchor: 'start', data: { dim: 'hood' } })
    const size = Math.min(fs * 0.72, (over - 4) / (labels.hoodOver.length * CHAR))
    p.text(x - fs * 0.55, mid, labels.hoodOver, 'el-cap', { size, rotate: true })
  }

  // отметки высот справа: пол, цоколь, корпус, столешница, верхние, антресоль, окно, потолок
  const hx = L + fs * 1.4
  const main = [0, heights.plinth, heights.counter]
  if (thick) main.push(heights.counter - thick)
  if (!island) {
    if (upper.length) main.push(heights.upperBottom, heights.upperTop)
    if (heights.mezzTop) main.push(heights.mezzTop)
    if (win) main.push(win.sill, win.top)
    main.push(heights.ceiling)
  }
  p.marks(hx, Y, main, 'right')

  // колонны, ниша холодильника и шкаф над ним — своим столбиком слева
  const tall = boxes.filter((b) => b.kind === 'tall' || b.kind === 'pantry' || b.kind === 'overFridge' || b.slot === 'fridge')
  const tallMarks = tall.flatMap((b) => (b.kind === 'overFridge' ? [b.y, b.y + b.h] : [b.y + b.h])).filter((v) => main.every((m) => Math.abs(m - v) > 0.3))
  if (tallMarks.length) p.marks(-fs * 1.4, Y, [0, ...tallMarks], 'left')

  // остров: разрез со свесом справа от вида. Столешница — из сборки, шкаф — DEPTH
  // раскладки, свес — разница столешниц острова и стены (`islandOverhang`).
  const ov = opts.overhang
  if (island && run.tops[0] && ov !== undefined) {
    const D = run.tops[0].depth
    const F = D - ov
    const sx = p.box.x1 + fs * 3
    const cab = sx + F - DEPTH
    p.line(sx - 4, Y(0), sx + D + 4, Y(0), 'el-floor')
    p.rect(cab, Y(heights.plinth), DEPTH, heights.plinth, 'el-panel')
    p.rect(cab, Y(heights.counter - thick), DEPTH, heights.counter - thick - heights.plinth, 'el-box')
    p.rect(sx, Y(heights.counter), D, thick, 'el-top')
    const y = chainY
    p.line(sx, y, sx + D, y, 'el-dim')
    for (const c of [0, F, D]) p.line(sx + c, y - fs * 0.45, sx + c, y + fs * 0.45, 'el-dim')
    p.segLabel(sx, sx + F, y, fmt(F), { dim: 'top' })
    p.segLabel(sx + F, sx + D, y, fmt(ov), { dim: 'overhang' })
    p.text(sx, totalY + fs * 1.3, labels.section, 'el-cap', { anchor: 'start', size: fs * 0.8 })
  }

  return p.svg(opts.scale ? ` data-scale="${opts.scale}"` : '', fs * 0.6)
}

/** Фасад и его знак открывания: вершина угла — там, где петли. */
function front(p: Pen, f: SpecFront, Y: (y: number) => number) {
  const x0 = f.x
  const x1 = f.x + f.w
  const y0 = Y(f.y)
  const y1 = Y(f.y + f.h)
  p.rect(x0, y1, f.w, f.h, `el-front${f.glass ? ' el-front--glass' : ''}`)
  const path = (d: string) => p.out.push(`<path d="${d}" class="el-swing"/>`)
  const my = (y0 + y1) / 2
  if (f.hinge === 'left') path(`M${n(x1)} ${n(y1)}L${n(x0)} ${n(my)}L${n(x1)} ${n(y0)}`)
  else if (f.hinge === 'right') path(`M${n(x0)} ${n(y1)}L${n(x1)} ${n(my)}L${n(x0)} ${n(y0)}`)
  else if (f.hinge === 'top') path(`M${n(x0)} ${n(y0)}L${n((x0 + x1) / 2)} ${n(y1)}L${n(x1)} ${n(y0)}`)
  else if (f.hinge === 'fold') path(`M${n(x0)} ${n(y1)}L${n((x0 + x1) / 2)} ${n(y0)}L${n(x1)} ${n(y1)}`)
  else if (f.hinge === 'drawer' && f.w > 8) {
    const cx = (x0 + x1) / 2
    const hy = y1 + Math.min(4, f.h / 3)
    p.line(cx - Math.min(8, f.w / 5), hy, cx + Math.min(8, f.w / 5), hy, 'el-handle')
  }
}

/**
 * Техника: рамка, название и размер — вписаны в рамку; высокая узкая — подписана
 * вдоль. Варочная панель лежит на столешнице — без рамки; отдельностоящая плита
 * стоит на полу — рамка «Плита W×H».
 */
function appliance(p: Pen, b: SpecBox, Y: (y: number) => number, labels: DrawingLabels) {
  if (!b.slot || (b.slot === 'hob' && !b.stove)) return
  const fs = p.fs
  p.rect(b.x, Y(b.y + b.h), b.w, b.h, 'el-tech')
  const name = b.stove ? (labels.stove ?? labels.appliance(b.slot)) : labels.appliance(b.slot)
  const dims = `${fmt(b.w)}×${fmt(b.h)}`
  const cx = b.x + b.w / 2
  const cy = Y(b.y + b.h / 2)
  const min = fs * 0.55
  const fit = (s: string, room: number) => Math.min(fs, room / (s.length * CHAR))
  const size = (v: number) => (v < fs ? v : undefined)
  // поперёк: две строки
  const wRoom = b.w - Math.min(4, b.w * 0.12)
  let ns = fit(name, wRoom)
  let ds = fit(dims, wRoom)
  if (ns >= min && ds >= min && (ns + ds) * 1.25 <= b.h - 2) {
    p.text(cx, cy - ds * 0.62, name, 'el-tech-name', { size: size(ns) })
    p.text(cx, cy + ns * 0.62, dims, 'el-num el-tech-num', { size: size(ds) })
    return
  }
  // вдоль: высокая узкая техника
  const hRoom = b.h - Math.min(4, b.h * 0.12)
  ns = fit(name, hRoom)
  ds = fit(dims, hRoom)
  if (ns >= min && ds >= min && (ns + ds) * 1.25 <= b.w - 1) {
    p.text(cx - ds * 0.62, cy, name, 'el-tech-name', { size: size(ns), rotate: true })
    p.text(cx + ns * 0.62, cy, dims, 'el-num el-tech-num', { size: size(ds), rotate: true })
    return
  }
  // совсем мало места: только размер, если влезает
  ds = fit(dims, wRoom)
  if (ds >= min * 0.8 && ds * 1.2 <= b.h) p.text(cx, cy, dims, 'el-num el-tech-num', { size: size(ds) })
}

/* ───────── масштаб листа ───────── */

/** Размер рисунка SVG в мм на бумаге при масштабе 1:N. */
export function paperSize(svg: string, scale: number): { w: number; h: number } {
  const v = (/viewBox="([^"]+)"/.exec(svg)?.[1] ?? '0 0 0 0').split(/\s+/).map(Number)
  return { w: (v[2] * 10) / scale, h: (v[3] * 10) / scale }
}

/** Самый крупный стандартный масштаб, при котором все рисунки влезают в место на листе. */
export function pickScale(make: (scale: number) => string[], box: { w: number; h: number } = SHEET_BOX): number {
  for (const s of SCALES) {
    if (make(s).every((svg) => paperSize(svg, s).w <= box.w && paperSize(svg, s).h <= box.h)) return s
  }
  return SCALES[SCALES.length - 1]
}

/**
 * Масштаб, который честно подписать на листе: все рисунки при 1:N влезают в
 * место (мм). Не влезают — лист их ужмёт, и «М 1:N» будет враньём: null.
 */
export function printedScale(svgs: string[], scale: number, box: { w: number; h: number }): number | null {
  return svgs.every((svg) => paperSize(svg, scale).w <= box.w + 0.01 && paperSize(svg, scale).h <= box.h + 0.01) ? scale : null
}

/* ───────── угол ───────── */

/** Угол у стены: где торец углового шкафа соседней, низ и верх. */
export type CornerZone = { x0: number; x1: number; up: [number, number] }

/**
 * Одно правило для развёртки и для списка «что где стоит»: угол — конец ряда,
 * не занятый модулями этой стены (там стоит угловой шкаф соседней, у B — в
 * конце, у C — в начале). Верхний ряд соседней стены заходит туда на глубину
 * верхнего шкафа (`UPPER_DEPTH`) от стены.
 */
export function cornerZones(length: number, modules: { x: number; w: number }[], empty: { x: number; w: number; row?: string }[] = []): CornerZone[] {
  // пустое место (run.gaps) — занятая длина стены, а не угол (P4)
  const mods = [...modules, ...empty.filter((g) => g.row !== 'upper')].sort((a, b) => a.x - b.x)
  const gaps: [number, number][] = []
  let at = 0
  for (const m of mods) {
    if (m.x - at > 0.5) gaps.push([at, m.x])
    at = Math.max(at, m.x + m.w)
  }
  if (length - at > 0.5) gaps.push([at, length])
  return gaps
    .filter(([a, b]) => a < 0.5 || b > length - 0.5)
    .map(([a, b]) => {
      const d = Math.min(UPPER_DEPTH, b - a)
      return { x0: a, x1: b, up: b > length - 0.5 ? [b - d, b] : [a, a + d] }
    })
}

/* ───────── план сверху для PDF ───────── */

export type PlanDepths = { low: number; top: number; up: number; island?: { depth: number; overhang: number } }

export type PlanLabels = {
  cm: string
  window: string
  /** проход до острова: подпись говорит, между какими гранями */
  passage: string
  island: string
  depths: (d: PlanDepths) => string
}

export type PlanOpts = {
  scale?: number
  /** ряды из сборки: глубины столешниц у стены и у острова */
  runs: SpecRun[]
}

/**
 * План сверху: стены с длинами, шкафы и верхние (пунктиром), окно с привязкой,
 * остров с привязкой от левой стены и проходом, глубины — подписью.
 */
export function planSvg(plan: Plan, labels: PlanLabels, opts: PlanOpts): string {
  const W = plan.room.w
  // глубины — из модели: шкафы и верхние — раскладка, столешницы — сборка
  const wallTop = opts.runs.find((r) => r.id !== 'I' && r.tops.length)?.tops[0].depth
  const islTop = opts.runs.find((r) => r.id === 'I')?.tops[0]?.depth
  const ov = islandOverhang(opts.runs) ?? 0
  const fs = fsOf(opts.scale, W)
  const p = new Pen(fs)
  const T = 10
  const round = (v: number) => Math.round(v * 10) / 10
  const wallRuns = plan.runs.filter((r) => r.wall)
  const win = plan.window
  const extent = Math.max(
    120,
    ...wallRuns.filter((r) => r.id !== 'A').map((r) => r.length),
    win?.wall === 'left' ? win.at + win.w / 2 + 20 : 0,
  )
  const D = plan.island ? Math.max(extent, plan.island.z + ov + 20) : extent

  // стены
  const u = plan.shape === 'u'
  p.rect(-T, -T, W + T + (u ? T : 0), T, 'pl-wall')
  p.rect(-T, 0, T, D, 'pl-wall')
  if (u) p.rect(W, 0, T, D, 'pl-wall')
  if (win?.wall === 'back') p.rect(win.at - win.w / 2, -T, win.w, T, 'pl-win')
  if (win?.wall === 'left') p.rect(-T, win.at - win.w / 2, T, win.w, 'pl-win')

  // остров со столешницей и свесом
  const isl = plan.island
  // столешница острова: к кухне — как у стены, к стульям — свес
  if (isl && islTop) p.rect(isl.x, isl.z - (islTop - ov), isl.w, islTop, 'pl-top')
  const TECH = new Set(['dishwasher', 'washer', 'fridge', 'oven', 'tall'])
  for (const run of plan.runs) {
    for (const m of run.modules) {
      const r = rectOf(run, m.x, m.w, 0, DEPTH)
      p.rect(r.x, r.y, r.w, r.h, TECH.has(m.kind) ? 'pl-tech' : 'pl-box')
    }
    if (!run.wall) continue
    for (const up of run.uppers.filter((u) => u.kind !== 'none')) {
      const r = rectOf(run, up.x, up.w, 0, UPPER_DEPTH)
      p.rect(r.x, r.y, r.w, r.h, 'pl-upper')
    }
  }

  // длины стен: цепочка с окном и общая
  const aY = -T - fs * 1.6
  const backCuts = [0, W, ...(win?.wall === 'back' ? [round(win.at - win.w / 2), round(win.at + win.w / 2)] : [])]
  p.chainX([...new Set(backCuts)].sort((a, b) => a - b), aY, 'wall')
  if (win?.wall === 'back') p.text(win.at, aY - fs * 1.55, labels.window, 'el-cap', { size: fs * 0.8 })
  const chainZ = (x: number, len: number, id: string, cuts: number[], side: -1 | 1) => {
    const all = [...new Set([0, len, ...cuts])].sort((a, b) => a - b)
    p.line(x, all[0], x, all[all.length - 1], 'el-dim')
    for (const c of all) p.line(x - fs * 0.45, c, x + fs * 0.45, c, 'el-dim')
    for (let i = 0; i < all.length - 1; i++) {
      const s = fmt(all[i + 1] - all[i])
      p.text(x + side * fs * 0.75, (all[i] + all[i + 1]) / 2, s, 'el-num', { rotate: true, data: { chain: 'wall' } })
    }
    // у прямой кухни боковая стена не наша: только привязка окна, без длины стены
    if (id) p.text(x + side * fs * 2.2, len / 2, `${id} · ${fmt(len)} ${labels.cm}`, 'el-num el-num--total', { rotate: true })
  }
  p.text(W / 2, aY - fs * 3.1, `A · ${fmt(W)} ${labels.cm}`, 'el-num el-num--total')
  const runB = plan.runs.find((r) => r.id === 'B')
  const runC = plan.runs.find((r) => r.id === 'C')
  const leftWin = win?.wall === 'left' ? [round(win.at - win.w / 2), round(win.at + win.w / 2)] : []
  if (runB) chainZ(-T - fs * 1.6, runB.length, 'B', leftWin, -1)
  else if (leftWin.length) chainZ(-T - fs * 1.6, leftWin[1], '', leftWin, -1)
  if (leftWin.length) p.text(-T - fs * 4.2, win!.at, labels.window, 'el-cap', { size: fs * 0.8, rotate: true })
  if (runC) chainZ(W + T + fs * 1.6, runC.length, 'C', [], 1)

  // глубина шкафов у конца стены A
  if (!u) {
    const x = W + fs * 1.6
    p.line(x, 0, x, DEPTH, 'el-dim')
    for (const c of [0, DEPTH]) p.line(x - fs * 0.45, c, x + fs * 0.45, c, 'el-dim')
    p.text(x + fs * 0.75, DEPTH / 2, fmt(DEPTH), 'el-num', { rotate: true, data: { dim: 'depth' } })
  }

  // остров: привязка от левой стены, длина, глубина, проход
  if (isl) {
    const y = isl.z + ov + fs * 1.9
    p.chainX([0, round(isl.x), round(isl.x + isl.w)], y, 'island', false)
    p.text(isl.x + isl.w / 2, isl.z - DEPTH / 4, labels.island, 'el-cap', { size: fs * 0.9 })
    if (islTop) {
      const z0 = isl.z - (islTop - ov)
      const z1 = isl.z + ov
      const x = isl.x + isl.w + fs * 1.6
      p.line(x, z0, x, z1, 'el-dim')
      for (const c of [z0, z1]) p.line(x - fs * 0.45, c, x + fs * 0.45, c, 'el-dim')
      p.text(x + fs * 0.75, (z0 + z1) / 2, fmt(islTop), 'el-num', { rotate: true, data: { dim: 'islandDepth' } })
    }
    // проход — между фасадами: шкафы у стены (DEPTH от стены) и шкафы острова
    const px = isl.x + Math.min(isl.w - 10, fs * 3)
    const f0 = DEPTH
    const f1 = isl.z - DEPTH
    p.line(px, f0, px, f1, 'el-dim')
    for (const c of [f0, f1]) p.line(px - fs * 0.45, c, px + fs * 0.45, c, 'el-dim')
    p.text(px + fs * 0.75, (f0 + f1) / 2, `${labels.passage} ${fmt(f1 - f0)}`, 'el-num', { rotate: true, data: { dim: 'passage' } })
  }

  const depths = labels.depths({ low: DEPTH, top: wallTop ?? DEPTH, up: UPPER_DEPTH, island: isl && islTop ? { depth: islTop, overhang: ov } : undefined })
  p.text(-T, p.box.y1 + fs * 1.4, depths, 'el-cap', { anchor: 'start', size: fs * 0.85, data: { cap: 'depths' } })
  return p.svg(opts.scale ? ` data-scale="${opts.scale}"` : '', fs * 0.6)
}

/* ───────── окно, остров, списки для мастера ───────── */

/** Окно на развёртке, см: высоты — `WINDOW` из dims.ts (их же ставит 3D), верх — не ближе `WINDOW_GAP` к потолку, как там. */
export type WindowSizes = { backSill: number; top: number }
export function windowFor(plan: Pick<Plan, 'window'>, runId: string, ceiling: number, sizes: WindowSizes | null): { at: number; w: number; sill: number; top: number } | null {
  const win = plan.window
  if (!win || !sizes || runId !== 'A' || win.wall !== 'back') return null
  return { at: win.at, w: win.w, sill: sizes.backSill, top: Math.min(sizes.top, ceiling - WINDOW_GAP) }
}

/** Свес столешницы острова в сторону стульев: столешница острова минус столешница у стены (обе — из сборки). */
export function islandOverhang(runs: SpecRun[]): number | undefined {
  const isl = runs.find((r) => r.id === 'I')?.tops[0]
  const wall = runs.find((r) => r.id !== 'I' && r.tops.length)?.tops[0]
  return isl && wall ? isl.depth - wall.depth : undefined
}

/** Техника без размеров в каталоге (U11): названия мест. */
export const approxNames = (list: KitchenAppliance[], t: KitchenTexts) => list.filter((a) => !a.sizeKnown).map((a) => t.slots[a.slot])

/** Строки таблицы «Техника» в PDF: у техники без размеров — «размер примерный». */
export function techRows(list: KitchenAppliance[], t: KitchenTexts): string[][] {
  return list.map((a) => [t.slots[a.slot], a.sizeKnown ? a.name : `${a.name} — ${t.approxSize}`, `${fmt(a.w)} × ${fmt(a.h)} × ${fmt(a.d)}`])
}

export type MakerItems = Partial<Record<SlotKind, KitchenAppliance | null>>

/**
 * Текст для мебельщика: по стенам, в том же порядке, что развёртка (слева
 * направо, лицом к стене), с углом соседней стены — сумма сходится с длиной.
 */
export function makerList(plan: Plan, items: MakerItems, t: KitchenTexts, inProject: KitchenAppliance[]): string {
  const lines: string[] = []
  for (const run of plan.runs) {
    const mods = [...run.modules].sort((a, b) => a.x - b.x)
    // угол — тем же правилом, что штриховка на развёртке
    const zones = run.wall ? cornerZones(run.length, mods, run.gaps) : []
    const cornerAt = (end: boolean, w: (z: CornerZone) => number) =>
      zones.filter((z) => (z.x1 > run.length - 0.5) === end && (end || z.x0 < 0.5)).map((z) => `${t.drawing.corner} ${Math.round(w(z))}`)
    const low = (z: CornerZone) => z.x1 - z.x0
    const up = (z: CornerZone) => z.up[1] - z.up[0]
    const empty = (run.gaps ?? []).filter((g) => g.row !== 'upper')
    const lower = [...mods, ...empty].sort((a, b) => a.x - b.x).map((m) => {
      if (!('kind' in m)) return `${t.emptyPlace} ${Math.round(m.w)}`
      let name = t.modules[m.kind]
      if (m.kind === 'hob' && m.oven && items.oven !== null) name = t.ovenUnder
      if (m.stove) name = t.stove.name
      if (m.kind === 'fridge' && items.fridge) name = `${name} (${items.fridge.brand || items.fridge.name})`
      return `${name} ${Math.round(m.w)}`
    })
    lines.push(t.wall(run.id, Math.round(run.length)))
    lines.push(`  ${t.lower}: ${[...cornerAt(false, low), ...lower, ...cornerAt(true, low)].join(' · ')}`)
    const uppers = [...run.uppers].sort((a, b) => a.x - b.x)
    if (uppers.some((u) => u.kind !== 'none')) {
      // пустое место в верхнем ряду: под окном — одно «окно» общей ширины (раскладка режет
      // его по модулям снизу), над колонной — колонна, иначе — «пусто» (над плитой у окна)
      const win = plan.window
      const span = run.id === 'A' && win?.wall === 'back' ? [win.at - win.w / 2, win.at + win.w / 2] : null
      const upper: string[] = []
      let open = 0
      const flush = () => {
        if (open > 0) upper.push(`${t.uppers.none} ${Math.round(open)}`)
        open = 0
      }
      for (const u of uppers) {
        if (u.kind === 'none' && span && u.x >= span[0] - 0.5 && u.x + u.w <= span[1] + 0.5) {
          open += u.w
          continue
        }
        flush()
        const col = mods.find((m) => (m.kind === 'tall' || m.kind === 'pantry' || m.kind === 'fridge') && m.x < u.x + u.w - 0.5 && m.x + m.w > u.x + 0.5)
        const name = u.kind !== 'none' ? t.uppers[u.kind] : col ? t.modules[col.kind] : t.upperEmpty
        upper.push(`${name} ${Math.round(u.w)}`)
      }
      flush()
      lines.push(`  ${t.upper}: ${[...cornerAt(false, up), ...upper, ...cornerAt(true, up)].join(' · ')}`)
    }
    lines.push('')
  }
  const approx = approxNames(inProject, t)
  if (approx.length) lines.push(t.approxList(approx.join(', ')))
  return lines.join('\n').trim()
}

/** Стили чертежа — общие для страницы и для PDF. */
export const DRAWING_CSS = `
.el{display:block;width:100%;height:auto;font-family:Manrope,system-ui,sans-serif}
.el-wall{fill:#f7f8fa;stroke:#c9d1dc;stroke-width:.6}
.el-floor{stroke:#263244;stroke-width:1.6}
.el-window{fill:#e4efff;stroke:#7fa6e6;stroke-width:.8;stroke-dasharray:3 2}
.el-top{fill:#ddd6cb;stroke:#8c8478;stroke-width:.5}
.el-panel{fill:#ebe6de;stroke:#8c8478;stroke-width:.5}
.el-box{fill:#fff;stroke:#263244;stroke-width:.7}
.el-cut{fill:#eef1f5;stroke:#263244;stroke-width:.5}
.el-hatch{stroke:#8a97a9;stroke-width:.35}
.el-front{fill:#fff;stroke:#263244;stroke-width:.45}
.el-front--glass{fill:#eef5ff}
.el-swing{fill:none;stroke:#8a97a9;stroke-width:.4;stroke-dasharray:2.4 1.6}
.el-handle{stroke:#263244;stroke-width:.9;stroke-linecap:round}
.el-tech{fill:#e7effc;stroke:#2563eb;stroke-width:.6}
.el-tech-name{font-size:var(--el-fs);font-weight:700;fill:#1d4ed8}
.el-dim{stroke:#263244;stroke-width:.45}
.el-lead{stroke:#8a97a9;stroke-width:.35}
.el-num{font-size:var(--el-fs);font-weight:700;fill:#263244}
.el-num--total{font-weight:800}
.el-tech-num{fill:#1d4ed8}
.el-cap{font-size:var(--el-fs);font-weight:600;fill:#5b6778}
.pl-wall{fill:#263244}
.pl-win{fill:#7fa6e6}
.pl-top{fill:#ddd6cb;stroke:#8c8478;stroke-width:.6}
.pl-box{fill:#fff;stroke:#263244;stroke-width:.8}
.pl-tech{fill:#e7effc;stroke:#2563eb;stroke-width:.8}
.pl-upper{fill:none;stroke:#8a97a9;stroke-width:.6;stroke-dasharray:3 2}
`
