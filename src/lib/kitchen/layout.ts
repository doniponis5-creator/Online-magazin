import {
  isCabinet,
  ITEM_KEYS,
  type Arrangement,
  type BaseFront,
  type Cabinet,
  type CabinetId,
  type FixedItem,
  type ItemKey,
  type KitchenAppliance,
  type Shape,
  type SlotKind,
  type WallId,
} from './types'

/**
 * Раскладка кухни по стенам — как её сделал бы мебельщик.
 *
 * Правило рабочего треугольника: холодильник — мойка — плита. Мойка рядом с
 * посудомойкой (одна труба), у плиты с обеих сторон есть столешница, угол
 * закрывает угловой шкаф. Всё, что не поместилось, попадает в `dropped`, и
 * покупатель видит, сколько сантиметров не хватило.
 */

export const DEPTH = 60
export const CORNER_W = 100
export const SINK_W = 60
export const HOB_W = 60
export const TALL_W = 60
export const WASHER_W = 60
export const PANTRY_W = 60
export const UPPER_DEPTH = 35
/** боковины ниши холодильника: две по 1,6 см и зазоры для воздуха */
export const NICHE_EXTRA = 3.2

export type ModuleKind =
  | 'doors'
  | 'drawers'
  | 'sink'
  | 'hob'
  | 'dishwasher'
  | 'washer'
  | 'fridge'
  | 'tall'
  | 'pantry'
  | 'oven'
  | 'corner'
  | 'bottle'
  | 'filler'

export type Module = {
  kind: ModuleKind
  /** начало вдоль стены, см (в системе координат ряда) */
  x: number
  w: number
  /** под варочной — духовка */
  oven?: boolean
  /** угловой: глухая часть (закрыта соседним рядом) и где она */
  blind?: number
  blindAt?: 'start' | 'end'
  /** роль заполнителя: над рабочей зоной можно поставить открытые полки */
  role?: 'work' | 'side'
  /** какой переставляемый предмет стоит в этом модуле */
  item?: ItemKey
  /** фасады своего шкафа покупателя */
  front?: BaseFront
}

export type UpperKind = 'doors' | 'shelf' | 'hood' | 'fridge' | 'none'
export type Upper = { kind: UpperKind; x: number; w: number }

export type RunId = 'A' | 'B' | 'C' | 'I'

export type Run = {
  id: RunId
  /** точка начала ряда на плане и поворот ряда вокруг вертикали */
  ox: number
  oz: number
  rot: number
  length: number
  modules: Module[]
  uppers: Upper[]
  /** ряд стоит у стены (у острова стены нет) */
  wall: boolean
}

export type Plan = {
  shape: Shape
  runs: Run[]
  /** пол комнаты: ширина по X, глубина по Z */
  room: { w: number; d: number }
  /** окна может не быть */
  window: { wall: 'back' | 'left'; at: number; w: number } | null
  /** где стоит каждая техника: ряд и модуль */
  placed: Partial<Record<SlotKind, { run: RunId; index: number }>>
  /** не поместилось; need — сколько см не хватило (slot — если это товар) */
  dropped: { item: ItemKey; slot?: SlotKind; need: number; wall?: RunId }[]
  island?: { x: number; z: number; w: number; d: number }
}

export type PlanInput = {
  shape: Shape
  a: number
  b: number
  c: number
  island: number
  fridge?: KitchenAppliance | null
  dishwasher?: KitchenAppliance | null
  washer?: KitchenAppliance | null
  microwave?: KitchenAppliance | null
  hob?: KitchenAppliance | null
  /** свой порядок техники по стенам */
  arrangement?: Arrangement
  /** духовка в пенале на уровне глаз */
  tallOven?: boolean
  /** сколько пеналов для хранения (0–2) */
  pantries?: number
  /** окна нет */
  noWindow?: boolean
  /** ширина окна, см */
  windowW?: number
  /** холодильник отдельно: без боковин и антресоли */
  fridgeOpen?: boolean
  /** духовка в своём шкафу, отдельно от плиты */
  ovenApart?: boolean
  /** духовки нет вовсе */
  noOven?: boolean
  /** свои шкафы покупателя */
  cabinets?: Partial<Record<CabinetId, Cabinet>>
}

type Item =
  | { kind: ModuleKind; w: number; slot?: SlotKind; item?: ItemKey; blind?: number; blindAt?: 'start' | 'end'; oven?: boolean; front?: BaseFront }
  | { fill: number; min: number; prefer: 'doors' | 'drawers'; role: 'work' | 'side' }

const isFill = (i: Item): i is Extract<Item, { fill: number }> => 'fill' in i

/** Ширина места под отдельностоящую технику: корпус + зазоры, округлено вверх. */
const slotWidth = (a: KitchenAppliance | null | undefined, fallback: number, extra = 0) =>
  a ? Math.ceil(a.w + 1.5 + extra) : fallback

/** Кусок столешницы шириной W — на шкафы, как их режет мебельщик. */
export function splitFill(width: number, prefer: 'doors' | 'drawers', role: 'work' | 'side'): Omit<Module, 'x'>[] {
  const w = Math.round(width)
  if (w < 1) return []
  if (w < 15) return [{ kind: 'filler', w }]
  if (w < 30) return [{ kind: 'bottle', w }]
  if (w <= 90) return [{ kind: w <= 45 && prefer === 'drawers' ? 'drawers' : prefer, w, role }]
  const n = Math.ceil(w / 80)
  const base = Math.floor(w / n)
  return Array.from({ length: n }, (_, i) => ({
    kind: i === 0 ? prefer : 'doors',
    w: base + (i === 0 ? w - base * n : 0),
    role,
  }))
}

/**
 * Расставляет элементы по ряду длиной `length`. Возвращает модули с
 * координатами или null, если фиксированные элементы не помещаются.
 */
export function resolveRun(length: number, start: number, items: Item[]): Module[] | null {
  const available = length - start
  const fixed = items.reduce((s, i) => s + (isFill(i) ? i.min : i.w), 0)
  if (fixed > available + 0.01) return null
  const weights = items.reduce((s, i) => s + (isFill(i) ? i.fill : 0), 0)
  let extra = available - fixed
  const out: Module[] = []
  let x = start
  const fills = items.filter(isFill)
  const lastFill = fills[fills.length - 1]
  for (const item of items) {
    if (!isFill(item)) {
      out.push({ kind: item.kind, x, w: item.w, blind: item.blind, blindAt: item.blindAt, oven: item.oven, item: item.item, front: item.front })
      x += item.w
      continue
    }
    let w = item.min + (weights > 0 ? Math.round(((available - fixed) * item.fill) / weights) : 0)
    if (item === lastFill) w = item.min + extra
    extra -= w - item.min
    for (const m of splitFill(w, item.prefer, item.role)) {
      out.push({ ...m, x })
      x += m.w
    }
  }
  return out
}

type Sequence = { items: Item[] }

/**
 * Ставит ряд, убирая необязательное по очереди, пока всё не влезет.
 * Порядок уступок: пеналы для хранения, стиральная, посудомойка, пенал с
 * духовкой, холодильник.
 */
function place(length: number, start: number, seq: Sequence, dropped: Plan['dropped']): { modules: Module[]; items: Item[] } {
  let items = seq.items
  const order: FixedItem[] = ['pantry2', 'pantry', 'washer', 'dishwasher', 'oven', 'tall', 'fridge']
  for (;;) {
    const modules = resolveRun(length, start, items)
    if (modules) return { modules, items }
    const fixed = items.reduce((s, i) => s + (isFill(i) ? i.min : i.w), 0)
    // первыми уступают свои шкафы покупателя (с конца), потом техника по списку
    const cabs = items.filter((i) => !isFill(i) && i.item && isCabinet(i.item))
    const lastCab = cabs[cabs.length - 1] as Extract<Item, { kind: ModuleKind }> | undefined
    const victim = lastCab?.item ?? order.find((key) => items.some((i) => !isFill(i) && i.item === key))
    if (!victim) {
      // Плита и мойка остаются всегда: сначала жертвуем запасом столешницы.
      const tight = items.map((i) => (isFill(i) ? { ...i, min: 0 } : i))
      const squeezed = resolveRun(length, start, tight)
      if (squeezed) return { modules: squeezed, items: tight }
      const onlyFill: Item[] = [{ fill: 1, min: 0, prefer: 'doors', role: 'side' }]
      return { modules: resolveRun(length, start, onlyFill) ?? [], items: onlyFill }
    }
    const victimItem = items.find((i) => !isFill(i) && i.item === victim) as Extract<Item, { kind: ModuleKind }>
    dropped.push({ item: victim, slot: victimItem.slot, need: Math.max(1, Math.ceil(fixed - (length - start))) })
    items = items.filter((i) => i !== victimItem)
  }
}

function indexOfSlot(run: Run, items: Item[], modules: Module[]) {
  const found: Partial<Record<SlotKind, { run: RunId; index: number }>> = {}
  for (const item of items) {
    if (isFill(item) || !item.slot) continue
    const index = modules.findIndex((m) => m.kind === item.kind)
    if (index >= 0) found[item.slot] = { run: run.id, index }
  }
  return found
}

/**
 * Верхний ряд над нижними модулями. Окно вырезается из ряда: шкаф, который
 * задевает окно краем, становится уже, а не пропадает целиком.
 */
function uppersFor(modules: Module[], opts: UpperOpts, windowSpan?: { from: number; to: number }): Upper[] {
  const out: Upper[] = []
  for (const m of modules) {
    const u = upperFor(m, opts)
    if (!windowSpan || m.x >= windowSpan.to || m.x + m.w <= windowSpan.from) {
      out.push(u)
      continue
    }
    const left = windowSpan.from - m.x
    const right = m.x + m.w - windowSpan.to
    const fits = (w: number) => w >= 20 && (u.kind === 'doors' || u.kind === 'shelf')
    if (fits(left)) out.push({ ...u, w: left })
    out.push({ kind: 'none', x: Math.max(m.x, windowSpan.from), w: Math.min(m.x + m.w, windowSpan.to) - Math.max(m.x, windowSpan.from) })
    if (fits(right)) out.push({ ...u, x: windowSpan.to, w: right })
  }
  return out
}

type UpperOpts = { shelves: boolean; fridgeOpen: boolean }

function upperFor(m: Module, opts: UpperOpts): Upper {
  if (m.kind === 'hob') return { kind: 'hood', x: m.x, w: m.w }
  if (m.kind === 'tall' || m.kind === 'pantry') return { kind: 'none', x: m.x, w: m.w }
  if (m.kind === 'fridge') return { kind: opts.fridgeOpen ? 'none' : 'fridge', x: m.x, w: m.w }
  if (opts.shelves && m.role === 'work') return { kind: 'shelf', x: m.x, w: m.w }
  return { kind: 'doors', x: m.x, w: m.w }
}

/* ───────────── порядок предметов ───────────── */

export function wallsOf(shape: Shape): WallId[] {
  if (shape === 'u') return ['A', 'B', 'C']
  if (shape === 'corner') return ['A', 'B']
  if (shape === 'island') return ['A', 'I']
  return ['A']
}

/** Раскладка по правилам: холодильник — мойка — плита. */
const DEFAULT_ORDER: Record<Shape, Arrangement> = {
  straight: { A: ['pantry2', 'pantry', 'fridge', 'tall', 'sink', 'dishwasher', 'washer', 'hob', 'oven'] },
  island: { A: ['pantry2', 'pantry', 'fridge', 'tall', 'sink', 'dishwasher', 'washer', 'hob', 'oven'], I: [] },
  corner: { A: ['sink', 'dishwasher', 'washer', 'tall', 'pantry', 'pantry2', 'fridge'], B: ['hob', 'oven'] },
  u: { A: ['sink', 'dishwasher'], B: ['hob', 'oven'], C: ['washer', 'tall', 'pantry', 'pantry2', 'fridge'] },
}

/** На остров высокое не ставят: пеналы и холодильник — только у стены. */
const TALL_KEYS: ItemKey[] = ['fridge', 'tall', 'pantry', 'pantry2']
const allowedOn = (wall: WallId, key: ItemKey) => wall !== 'I' || !TALL_KEYS.includes(key)

/**
 * Порядок предметов для формы кухни. Свой порядок покупателя берётся как
 * есть; чего в нём нет или что стоит на несуществующей стене — встаёт туда,
 * где стоит по правилам. Свои шкафы — только те, что есть в `cabinets`.
 */
export function resolveArrangement(shape: Shape, custom?: Arrangement, cabinets?: Partial<Record<CabinetId, Cabinet>>): Record<WallId, ItemKey[]> {
  const walls = wallsOf(shape)
  const base = DEFAULT_ORDER[shape]
  const out: Record<WallId, ItemKey[]> = { A: [], B: [], C: [], I: [] }
  const used = new Set<ItemKey>()
  const known = (k: ItemKey) => (isCabinet(k) ? Boolean(cabinets?.[k]) : ITEM_KEYS.includes(k))
  if (custom) {
    for (const w of walls) {
      for (const k of custom[w] ?? []) {
        if (!known(k) || used.has(k) || !allowedOn(w, k)) continue
        out[w].push(k)
        used.add(k)
      }
    }
  }
  for (const w of walls) {
    ;(base[w] ?? []).forEach((k, i) => {
      if (used.has(k)) return
      out[w].splice(Math.min(i, out[w].length), 0, k)
      used.add(k)
    })
  }
  return out
}

/** Эти пары ставят вплотную: одна труба у мойки, холодильник рядом с пеналом. */
const GLUED = new Set([
  'hob|oven',
  'sink|dishwasher',
  'dishwasher|washer',
  'sink|washer',
  'fridge|tall',
  'fridge|pantry',
  'tall|pantry',
  'pantry|pantry2',
  'fridge|pantry2',
  'tall|pantry2',
])
const TALL_ITEMS: ItemKey[] = TALL_KEYS
// Свои шкафы покупателя стоят вплотную друг к другу — так собирают ряд шкафов.
const glued = (a: ItemKey, b: ItemKey) => GLUED.has(`${a}|${b}`) || GLUED.has(`${b}|${a}`) || (isCabinet(a) && isCabinet(b))

type Neighbour = ItemKey | 'corner' | null

/**
 * Ряд стены: предметы в заданном порядке, между ними — столешница со
 * шкафами. У плиты с обеих сторон не меньше 30 см столешницы.
 */
function wallItems(
  keys: ItemKey[],
  make: (k: ItemKey) => Item | null,
  corner: { start: boolean; end: boolean },
  prefer: 'doors' | 'drawers' = 'doors',
): Item[] {
  const out: Item[] = []
  const gap = (left: Neighbour, right: Neighbour) => {
    // высокие шкафы и свои шкафы покупателя встают прямо к стене, без доборов
    const atEnd = (a: Neighbour, b: Neighbour) => a === null && b !== null && b !== 'corner' && (TALL_ITEMS.includes(b) || isCabinet(b))
    if (atEnd(left, right) || atEnd(right, left)) return
    if (left && right && left !== 'corner' && right !== 'corner' && glued(left, right)) return
    const nearHob = left === 'hob' || right === 'hob'
    const end = left === null || right === null
    const nearCorner = left === 'corner' || right === 'corner'
    out.push({
      fill: end ? 0.35 : nearCorner ? 0.5 : 1,
      min: nearHob ? 30 : 0,
      prefer: nearHob ? 'drawers' : prefer,
      role: end || nearCorner ? 'side' : 'work',
    })
  }
  let prev: Neighbour = null
  if (corner.start) {
    out.push({ kind: 'corner', w: CORNER_W, blind: DEPTH, blindAt: 'start' })
    prev = 'corner'
  }
  for (const k of keys) {
    const item = make(k)
    if (!item) continue
    gap(prev, k)
    out.push(item)
    prev = k
  }
  if (corner.end) {
    gap(prev, 'corner')
    out.push({ kind: 'corner', w: CORNER_W, blind: DEPTH, blindAt: 'end' })
  } else gap(prev, null)
  // Куда-то должен уйти остаток стены: если всё стоит вплотную — в конец.
  if (!out.some(isFill)) {
    const at = corner.end ? out.length - 1 : out.length
    out.splice(at, 0, { fill: 1, min: 0, prefer, role: 'side' })
  }
  return out
}

export function planKitchen(input: PlanInput, options: { shelves: boolean }): Plan {
  const { shape } = input
  const dropped: Plan['dropped'] = []
  const apart = Boolean(input.ovenApart) && !input.noOven
  const hasTall = Boolean(input.microwave?.builtIn) || (Boolean(input.tallOven) && !apart)
  const pantries = Math.max(0, Math.min(2, Math.round(input.pantries ?? 0)))
  // В нише у холодильника боковины: место шире на их толщину.
  const fridgeW = slotWidth(input.fridge, 0, input.fridgeOpen ? 0 : NICHE_EXTRA)
  const upperOpts: UpperOpts = { shelves: options.shelves, fridgeOpen: Boolean(input.fridgeOpen) }
  const hobW = Math.max(HOB_W, input.hob ? Math.ceil(input.hob.w / 5) * 5 : HOB_W)
  const dwW = input.dishwasher ? (input.dishwasher.w <= 46 ? 45 : 60) : 0

  const make = (k: ItemKey): Item | null => {
    switch (k) {
      case 'fridge':
        return input.fridge ? { kind: 'fridge', w: fridgeW, slot: 'fridge', item: k } : null
      case 'tall':
        return hasTall ? { kind: 'tall', w: TALL_W, slot: input.microwave?.builtIn ? 'microwave' : 'oven', item: k } : null
      case 'sink':
        return { kind: 'sink', w: SINK_W, item: k }
      case 'dishwasher':
        return input.dishwasher ? { kind: 'dishwasher', w: dwW, slot: 'dishwasher', item: k } : null
      case 'washer':
        return input.washer ? { kind: 'washer', w: slotWidth(input.washer, WASHER_W), slot: 'washer', item: k } : null
      case 'hob':
        return { kind: 'hob', w: hobW, slot: 'hob', oven: !hasTall, item: k }
      case 'pantry':
        return pantries >= 1 ? { kind: 'pantry', w: PANTRY_W, item: k } : null
      case 'pantry2':
        return pantries >= 2 ? { kind: 'pantry', w: PANTRY_W, item: k } : null
      case 'oven':
        return apart ? { kind: 'oven', w: 60, slot: 'oven', item: k } : null
    }
    const cab = input.cabinets?.[k]
    if (!cab) return null
    const w = Math.max(15, Math.min(120, Math.round(cab.w)))
    return { kind: cab.front === 'doors' || cab.front === 'open' ? 'doors' : 'drawers', w, item: k, front: cab.front }
  }
  const order = resolveArrangement(shape, input.arrangement, input.cabinets)

  const runs: Run[] = []
  const placed: Plan['placed'] = {}
  let window: Plan['window']
  let room: Plan['room']
  let island: Plan['island']

  const pushRun = (run: Omit<Run, 'modules' | 'uppers'>, start: number, items: Item[], reversed = false) => {
    const before = dropped.length
    const { modules, items: kept } = place(run.length, start, { items }, dropped)
    for (let i = before; i < dropped.length; i++) dropped[i].wall = run.id
    const laid = reversed ? modules.map((m) => ({ ...m, x: run.length - m.x - m.w, blindAt: flip(m.blindAt) })).reverse() : modules
    const uppers = uppersFor(laid, upperOpts)
    if (start === DEPTH) reachCorner(uppers, reversed ? run.length - DEPTH : DEPTH, reversed)
    const full: Run = { ...run, modules: laid, uppers }
    runs.push(full)
    Object.assign(placed, indexOfSlot(full, kept, laid))
    return full
  }
  /** Окно над мойкой, если мойка у задней стены; иначе — посередине стены. */
  const backWindow = (a: Run, width: number, fallback: number): Plan['window'] => {
    if (input.noWindow) return null
    const w = clampWindow(input.windowW ?? width, a.length)
    const sinkModule = a.modules.find((m) => m.kind === 'sink')
    const mid = sinkModule ? sinkModule.x + sinkModule.w / 2 : fallback
    // окно не залезает в угол: от края стены не меньше 10 см
    const at = Math.min(a.length - w / 2 - 10, Math.max(w / 2 + 10, mid))
    a.uppers = uppersFor(a.modules, upperOpts, { from: at - w / 2, to: at + w / 2 })
    return { wall: 'back', at, w }
  }

  if (shape === 'straight' || shape === 'island') {
    const a = input.a
    pushRun({ id: 'A', ox: 0, oz: 0, rot: 0, length: a, wall: true }, 0, wallItems(order.A, make, { start: false, end: false }))
    room = { w: a, d: shape === 'island' ? 400 : 270 }
    const w = clampWindow(input.windowW ?? 110, room.d)
    window = input.noWindow ? null : { wall: 'left', at: Math.min(room.d - w / 2 - 10, shape === 'island' ? 200 : 180), w }
    if (shape === 'island') {
      const w = Math.round(input.island)
      const x = Math.round(Math.max(0, (a - w) / 2))
      // Проход между кухней и островом — 110 см, как в хороших проектах.
      island = { x, z: DEPTH + 110 + DEPTH, w, d: 90 }
      // Шкафы острова смотрят на кухню, с другой стороны — барная стойка.
      // На остров можно поставить мойку, плиту, посудомойку и свои шкафы.
      const before = dropped.length
      const { modules, items: kept } = place(w, 0, { items: wallItems(order.I, make, { start: false, end: false }, 'drawers') }, dropped)
      for (let i = before; i < dropped.length; i++) dropped[i].wall = 'I'
      const run: Run = { id: 'I', ox: x + w, oz: island.z, rot: Math.PI, length: w, modules, uppers: [], wall: false }
      runs.push(run)
      Object.assign(placed, indexOfSlot(run, kept, modules))
    }
  } else if (shape === 'corner') {
    const a = pushRun({ id: 'A', ox: 0, oz: 0, rot: 0, length: input.a, wall: true }, 0, wallItems(order.A, make, { start: true, end: false }))
    window = backWindow(a, 100, CORNER_W + 45)
    // Левая стена: ряд идёт от зрителя к углу, угол закрыт рядом A.
    pushRun({ id: 'B', ox: 0, oz: input.b, rot: Math.PI / 2, length: input.b, wall: true }, DEPTH, wallItems(order.B, make, { start: false, end: false }), true)
    room = { w: input.a, d: Math.max(input.b + 40, 270) }
  } else {
    const a = pushRun({ id: 'A', ox: 0, oz: 0, rot: 0, length: input.a, wall: true }, 0, wallItems(order.A, make, { start: true, end: true }))
    window = backWindow(a, 110, input.a / 2)
    pushRun({ id: 'B', ox: 0, oz: input.b, rot: Math.PI / 2, length: input.b, wall: true }, DEPTH, wallItems(order.B, make, { start: false, end: false }), true)
    pushRun({ id: 'C', ox: input.a, oz: 0, rot: -Math.PI / 2, length: input.c, wall: true }, DEPTH, wallItems(order.C, make, { start: false, end: false }))
    room = { w: input.a, d: Math.max(input.b, input.c) + 40 }
  }

  // Духовка: в своём шкафу, если он встал; иначе в пенале; иначе под плитой.
  const ovenPlaced = runs.some((r) => r.modules.some((m) => m.kind === 'oven'))
  const tallPlaced = runs.some((r) => r.modules.some((m) => m.kind === 'tall'))
  const inTall = tallPlaced && !ovenPlaced
  for (const r of runs)
    for (const m of r.modules) {
      if (m.kind === 'hob') m.oven = !inTall && !ovenPlaced
      if (m.kind === 'tall') m.oven = inTall
    }

  return { shape, runs, room, window, placed, dropped, island }
}

/* ───────────── перестановка ───────────── */

export type ItemPlace = { wall: WallId; center: number; w: number }

/** Где сейчас стоит каждый предмет: стена и середина вдоль неё (см, от угла). */
export function itemPositions(plan: Plan): Partial<Record<ItemKey, ItemPlace>> {
  const out: Partial<Record<ItemKey, ItemPlace>> = {}
  for (const run of plan.runs) {
    for (const m of run.modules) {
      const key = m.item
      if (!key) continue
      const mid = m.x + m.w / 2
      out[key] = { wall: run.id, center: run.id === 'B' ? run.length - mid : mid, w: m.w }
    }
  }
  return out
}

const ALL_WALLS: WallId[] = ['A', 'B', 'C', 'I']
const copy = (o: Record<WallId, ItemKey[]>) => ({ A: [...o.A], B: [...o.B], C: [...o.C], I: [...o.I] })

/** Перенести предмет на стену `wall` в точку `pos` (см вдоль стены, от угла). */
export function moveItem(order: Record<WallId, ItemKey[]>, key: ItemKey, wall: WallId, pos: number, positions: Partial<Record<ItemKey, ItemPlace>>) {
  if (!allowedOn(wall, key)) return order
  const out = copy(order)
  for (const w of ALL_WALLS) out[w] = out[w].filter((k) => k !== key)
  const list = out[wall]
  let at = list.length
  for (let i = 0; i < list.length; i++) {
    const p = positions[list[i]]
    if (p && p.wall === wall && p.center > pos) {
      at = i
      break
    }
  }
  list.splice(at, 0, key)
  return out
}

/** Поменять местами с соседом по стене (пропуская то, чего в кухне нет). */
export function stepItem(order: Record<WallId, ItemKey[]>, key: ItemKey, delta: 1 | -1, present: Set<ItemKey>) {
  const wall = ALL_WALLS.find((w) => order[w].includes(key))
  if (!wall) return order
  const list = [...order[wall]]
  const i = list.indexOf(key)
  let j = i + delta
  while (j >= 0 && j < list.length && !present.has(list[j])) j += delta
  if (j < 0 || j >= list.length) return order
  ;[list[i], list[j]] = [list[j], list[i]]
  return { ...copy(order), [wall]: list }
}

/** Перенести на следующую стену (A → B → C → A), в середину ряда. */
export function nextWall(order: Record<WallId, ItemKey[]>, key: ItemKey, shape: Shape) {
  const walls = wallsOf(shape).filter((w) => allowedOn(w, key))
  const from = walls.find((w) => order[w].includes(key))
  if (!from || walls.length < 2) return order
  const to = walls[(walls.indexOf(from) + 1) % walls.length]
  const out = copy(order)
  out[from] = out[from].filter((k) => k !== key)
  out[to].splice(Math.ceil(out[to].length / 2), 0, key)
  return out
}

/** Где предмет стоит в порядке (для кнопок «влево/вправо»). */
export function wallOf(order: Record<WallId, ItemKey[]>, key: ItemKey): WallId | null {
  return ALL_WALLS.find((w) => order[w].includes(key)) ?? null
}

/** Можно ли поставить предмет на другую стену (или на остров). */
export function canChangeWall(shape: Shape, key: ItemKey): boolean {
  return wallsOf(shape).filter((w) => allowedOn(w, key)).length > 1
}

/**
 * Автоматический шкаф становится своим шкафом покупателя: его можно
 * двигать и менять ширину. Встаёт в порядок на своё же место.
 */
export function pinCabinet(
  order: Record<WallId, ItemKey[]>,
  cabinets: Partial<Record<CabinetId, Cabinet>>,
  cab: Cabinet,
  wall: WallId,
  center: number,
  positions: Partial<Record<ItemKey, ItemPlace>>,
): { id: CabinetId; order: Record<WallId, ItemKey[]>; cabinets: Partial<Record<CabinetId, Cabinet>> } {
  let n = 1
  while (cabinets[`k${n}`]) n++
  const id: CabinetId = `k${n}`
  return { id, cabinets: { ...cabinets, [id]: cab }, order: moveItem(order, id, wall, center, positions) }
}

/** Где на стене стоит модуль (центр, см от угла) — как у itemPositions. */
export function moduleCenter(run: Pick<Run, 'id' | 'length'>, m: Pick<Module, 'x' | 'w'>): number {
  const mid = m.x + m.w / 2
  return run.id === 'B' ? run.length - mid : mid
}

/**
 * Верхние шкафы бокового ряда доходят до верхних шкафов задней стены: они
 * мельче нижних, и без этого в углу осталась бы щель.
 */
function reachCorner(uppers: Upper[], edge: number, reversed: boolean) {
  const gap = DEPTH - UPPER_DEPTH
  const i = reversed ? uppers.length - 1 : 0
  const next = uppers[i]
  if (next && (next.kind === 'doors' || next.kind === 'shelf')) {
    next.w += gap
    if (!reversed) next.x -= gap
    return
  }
  const x = reversed ? edge : edge - gap
  if (reversed) uppers.push({ kind: 'doors', x, w: gap })
  else uppers.unshift({ kind: 'doors', x, w: gap })
}

function flip(at: Module['blindAt']): Module['blindAt'] {
  if (at === 'start') return 'end'
  if (at === 'end') return 'start'
  return undefined
}

/** Окно: от 60 до 240 см и не шире стены. */
export const WINDOW_LIMITS = { min: 60, max: 240 }
const clampWindow = (w: number, wall: number) => Math.max(WINDOW_LIMITS.min, Math.min(WINDOW_LIMITS.max, wall - 40, Math.round(w)))

/** Высота потолка, см. */
export const CEILING = { min: 240, max: 320, base: 270 }

/** Ограничения размеров для полей ввода. */
export const LIMITS: Record<'a' | 'b' | 'c' | 'island', { min: number; max: number }> = {
  a: { min: 180, max: 600 },
  b: { min: 180, max: 450 },
  c: { min: 150, max: 450 },
  island: { min: 120, max: 280 },
}

/** Минимальная длина задней стены для формы (угловые шкафы должны влезть). */
export function minA(shape: Shape): number {
  if (shape === 'u') return 2 * CORNER_W + SINK_W + 20
  if (shape === 'corner') return CORNER_W + SINK_W + 40
  return LIMITS.a.min
}
