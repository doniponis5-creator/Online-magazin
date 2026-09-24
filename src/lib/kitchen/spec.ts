import type { RunId } from './layout'
import type { SlotKind } from './types'

/**
 * Спецификация для мебельщика: что именно нарисовано в 3D — корпуса,
 * фасады, столешница, фурнитура. Сырые данные собирает 3D-сборка (там
 * каждая деталь уже стоит на своём месте), а здесь они считаются в штуки,
 * миллиметры и метры, как в заказе на производство.
 *
 * Все размеры в сырых данных — сантиметры, координаты — вдоль ряда
 * (слева направо, если стоять лицом к шкафам) и от пола.
 */

/** Что за предмет — показывается по нажатию и в таблицах. */
export type DimsKind =
  | 'base'
  | 'drawers'
  | 'sinkBase'
  | 'hobBase'
  | 'ovenBase'
  | 'corner'
  | 'bottle'
  | 'filler'
  | 'openBase'
  | 'tall'
  | 'pantry'
  | 'upper'
  | 'vitrine'
  | 'lift'
  | 'antresol'
  | 'overFridge'
  | 'mantel'
  | 'panel'
  | 'shelf'
  | 'top'
  | 'appliance'
  | 'sink'
  | 'island'

export type Dims = { kind: DimsKind; w: number; h: number; d: number; slot?: SlotKind }

export type SpecHinge = 'left' | 'right' | 'top' | 'fold' | 'drawer' | 'none'

export type SpecFront = {
  x: number
  y: number
  w: number
  h: number
  hinge: SpecHinge
  glass: boolean
  framed: boolean
  handle: boolean
  /** свой цвет фасада (id из каталога отделки) — у шкафа над холодильником; нет — как у гарнитура */
  color?: string
}

export type SpecBox = Dims & { x: number; y: number }

export type SpecRow = 'base' | 'upper' | 'tall'

export type SpecCarcass = { row: SpecRow; w: number; h: number; d: number; shelves: number; top: boolean; bottom: boolean; back: boolean }

export type SpecTop = { x0: number; x1: number; depth: number; thick: number; sink: boolean; hob: boolean }

/** модули ряда по раскладке: начало и ширина, см — для цепочки размеров */
export type SpecModule = { x: number; w: number }

export type SpecRun = { id: RunId; length: number; modules: SpecModule[]; boxes: SpecBox[]; fronts: SpecFront[]; tops: SpecTop[] }

export type SpecData = {
  runs: SpecRun[]
  carcasses: SpecCarcass[]
  /** боковины ниши холодильника: высота, глубина, штук */
  panels: { h: number; d: number; count: number }[]
  /** длина цоколя, см */
  plinth: number
  /** профиль Gola (вместо ручек), см */
  gola: number
  /** фартук, м² */
  splash: number
  /** высоты по вертикали, см: для чертежа и для мастера */
  heights: { plinth: number; counter: number; upperBottom: number; upperTop: number; mezzTop: number | null; ceiling: number }
}

/* ───────── корпуса: раскрой ───────── */

/** ЛДСП 16 мм — стандарт для корпусов кухни. */
export const LDSP = 16

export type CutName = 'side' | 'nicheSide' | 'bottom' | 'top' | 'rail' | 'shelf' | 'back'
export type CutRow = { name: CutName; a: number; b: number; count: number; hdf: boolean }

const mm = (cm: number) => Math.round(cm * 10)

/**
 * Раскрой корпусов: боковины, дно, крышка (у нижних — две царги по 100 мм),
 * полки и задняя стенка из ХДФ. Одинаковые детали складываются в одну строку.
 */
export function cutList(carcasses: SpecCarcass[], panels: SpecData['panels'] = []): CutRow[] {
  const rows = new Map<string, CutRow>()
  const add = (name: CutName, a: number, b: number, count: number, hdf = false) => {
    if (a <= 0 || b <= 0 || count <= 0) return
    const [x, y] = a >= b ? [a, b] : [b, a]
    const key = `${name}:${x}:${y}`
    const row = rows.get(key)
    if (row) row.count += count
    else rows.set(key, { name, a: x, b: y, count, hdf })
  }
  for (const c of carcasses) {
    const h = mm(c.h)
    const d = mm(c.d)
    const inner = mm(c.w) - 2 * LDSP
    add('side', h, d, 2)
    if (c.bottom) add('bottom', inner, d, 1)
    if (c.top) add('top', inner, d, 1)
    else if (c.row === 'base' && c.bottom) add('rail', inner, 100, 2)
    add('shelf', inner - 2, d - 20, c.shelves)
    if (c.back) add('back', mm(c.w) - 4, h - 4, 1, true)
  }
  for (const p of panels) add('nicheSide', mm(p.h), mm(p.d), p.count)
  const order: CutName[] = ['side', 'nicheSide', 'bottom', 'top', 'rail', 'shelf', 'back']
  return [...rows.values()].sort((p, q) => order.indexOf(p.name) - order.indexOf(q.name) || q.a - p.a || q.b - p.b)
}

/* ───────── фасады ───────── */

export type FrontType = 'door' | 'glass' | 'framed' | 'drawer' | 'lift' | 'dw' | 'panel'
export type FrontRow = { type: FrontType; w: number; h: number; count: number; color?: string }

export function frontType(f: SpecFront): FrontType {
  if (f.hinge === 'drawer') return 'drawer'
  if (f.hinge === 'top') return f.glass ? 'glass' : 'lift'
  if (f.hinge === 'fold') return 'dw'
  if (f.hinge === 'none') return 'panel'
  if (f.glass) return 'glass'
  return f.framed ? 'framed' : 'door'
}

/** Фасады по размерам: «дверца 396 × 716 — 4 шт». */
export function frontList(runs: SpecRun[]): FrontRow[] {
  const rows = new Map<string, FrontRow>()
  for (const run of runs) {
    for (const f of run.fronts) {
      const type = frontType(f)
      const w = mm(f.w)
      const h = mm(f.h)
      // фасад своего цвета мастер заказывает отдельно — в одну строку с остальными не складываем
      const key = `${type}:${w}:${h}:${f.color ?? ''}`
      const row = rows.get(key)
      if (row) row.count++
      else rows.set(key, { type, w, h, count: 1, ...(f.color ? { color: f.color } : {}) })
    }
  }
  const order: FrontType[] = ['door', 'framed', 'glass', 'drawer', 'lift', 'dw', 'panel']
  return [...rows.values()].sort((p, q) => order.indexOf(p.type) - order.indexOf(q.type) || q.h - p.h || q.w - p.w)
}

/** Сколько петель на дверцу: чем выше дверца, тем больше. */
export function hingesFor(heightCm: number): number {
  if (heightCm <= 90) return 2
  if (heightCm <= 160) return 3
  if (heightCm <= 200) return 4
  return 5
}

export type Hardware = {
  /** толкатели: дверцы без ручек выше столешницы (кухня без ручек) */
  push: number
  hinges: number
  lifts: number
  runners: number
  handles: number
  legs: number
  hangers: number
  /** м */
  gola: number
  plinth: number
}

export function hardware(data: SpecData): Hardware {
  const fronts = data.runs.flatMap((r) => r.fronts)
  const doors = fronts.filter((f) => f.hinge === 'left' || f.hinge === 'right')
  const legsFor = (c: SpecCarcass) => (c.w > 80 ? 6 : 4)
  // Без ручек нижние открываются за профиль Gola, остальные — нажатием.
  const push = data.gola > 0 ? fronts.filter((f) => (f.hinge === 'left' || f.hinge === 'right' || f.hinge === 'top') && !f.handle && f.y + f.h > 90).length : 0
  return {
    push,
    hinges: doors.reduce((s, f) => s + hingesFor(f.h), 0),
    lifts: fronts.filter((f) => f.hinge === 'top').length,
    runners: fronts.filter((f) => f.hinge === 'drawer').length,
    handles: fronts.filter((f) => f.handle).length,
    // ножки — у шкафов с дном; у посудомойки свои
    legs: data.carcasses.filter((c) => c.row !== 'upper' && c.bottom).reduce((s, c) => s + legsFor(c), 0),
    hangers: data.carcasses.filter((c) => c.row === 'upper').length * 2,
    gola: Math.round(data.gola) / 100,
    plinth: Math.round(data.plinth) / 100,
  }
}

/* ───────── столешница ───────── */

export type TopRow = { run: RunId; length: number; depth: number; thick: number; sink: boolean; hob: boolean }

export function topList(runs: SpecRun[]): { rows: TopRow[]; total: number } {
  const rows = runs.flatMap((r) =>
    r.tops.map((t) => ({ run: r.id, length: mm(t.x1 - t.x0), depth: mm(t.depth), thick: mm(t.thick), sink: t.sink, hob: t.hob })),
  )
  return { rows, total: Math.round(rows.reduce((s, r) => s + r.length, 0) / 10) / 100 }
}

/* ───────── модули по стенам ───────── */

const MODULE_KINDS: DimsKind[] = ['base', 'drawers', 'sinkBase', 'hobBase', 'ovenBase', 'corner', 'bottle', 'filler', 'openBase', 'tall', 'pantry', 'appliance']
const UPPER_KINDS: DimsKind[] = ['upper', 'vitrine', 'lift', 'antresol', 'overFridge', 'shelf', 'mantel']

/** Нижний ряд (с колоннами и техникой) и верхний — слева направо. */
export function modulesOf(run: SpecRun): { lower: SpecBox[]; upper: SpecBox[] } {
  const byX = (a: SpecBox, b: SpecBox) => a.x - b.x || a.y - b.y
  // Техника, под которую оставляют место (холодильник, посудомойка,
  // стиральная), — в нижнем ряду. Духовка и микроволновка — внутри своих
  // шкафов, их уже показывает шкаф.
  const floorTech = (b: SpecBox) => b.slot === 'fridge' || b.slot === 'washer' || b.slot === 'dishwasher'
  const lower = run.boxes.filter((b) => MODULE_KINDS.includes(b.kind) && (b.kind !== 'appliance' || floorTech(b)))
  const upper = run.boxes.filter((b) => UPPER_KINDS.includes(b.kind))
  return { lower: lower.sort(byX), upper: upper.sort(byX) }
}
