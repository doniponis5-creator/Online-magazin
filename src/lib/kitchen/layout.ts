import {
  isCabinet,
  ITEM_KEYS,
  type Arrangement,
  type BaseFront,
  type Cabinet,
  type CabinetId,
  type DiningSeats,
  type FixedItem,
  type FreeRoom,
  type HoodKind,
  type ItemKey,
  type KitchenAppliance,
  type Shape,
  type SizedItem,
  type SlotKind,
  type WallId,
} from './types'
import { CARCASS_D, counterTop, DINING, DINING_AISLE, DINING_CHAIR, FRONT_T, hoodBelow, hoodNorm, isTall, UPPER_BOTTOM, UPPER_CARCASS_D, up5 } from './dims'

/**
 * Раскладка кухни по стенам — как её сделал бы мебельщик.
 *
 * Правило рабочего треугольника: холодильник — мойка — плита. Мойка рядом с
 * посудомойкой (одна труба), у плиты с обеих сторон есть столешница, угол
 * закрывает угловой шкаф. Всё, что не поместилось, попадает в `dropped`, и
 * покупатель видит, сколько сантиметров не хватило.
 */

/** Глубина нижнего ряда с фасадом: корпус + фасад (58 + 1,8 → 60). */
export const DEPTH = Math.round(CARCASS_D + FRONT_T)
export const CORNER_W = 100
export const SINK_W = 60
export const HOB_W = 60
export const TALL_W = 60
export const WASHER_W = 60
export const PANTRY_W = 60
/** Глубина верхнего ряда с фасадом: корпус + фасад (33 + 1,8 → 35). */
export const UPPER_DEPTH = Math.round(UPPER_CARCASS_D + FRONT_T)
/** боковины ниши холодильника: две по 1,6 см и зазоры для воздуха */
export const NICHE_EXTRA = 3.2
/**
 * Предмет, поставленный рукой ближе этого (см) к соседу или к краю, встаёт
 * вплотную: щель в 3 см между шкафами никому не нужна.
 */
export const SNAP = 6

/** Ширина, которую покупатель может задать сам, см. */
export const WIDTH_LIMITS: Record<SizedItem | 'cabinet', { min: number; max: number }> = {
  sink: { min: 40, max: 120 },
  hob: { min: HOB_W, max: 120 },
  pantry: { min: 30, max: 90 },
  pantry2: { min: 30, max: 90 },
  // колонна с духовкой: сама духовка 60 см, шире — по бокам панели
  tall: { min: TALL_W, max: 90 },
  cabinet: { min: 15, max: 120 },
}

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
  /** место отдельностоящей плиты: без корпуса и без столешницы, ширина — ровно плита */
  stove?: boolean
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

/**
 * Верхний ряд. `corner` — шкаф над угловым: со стороны угла глухая часть
 * (её закрывают верхние шкафы соседней стены), дверца — только на открытой
 * части. `filler` — доборная панель без корпуса там, где шкаф был бы уже
 * `UPPER_MIN`.
 */
export type UpperKind = 'doors' | 'shelf' | 'hood' | 'fridge' | 'none' | 'corner' | 'filler'
export type Upper = {
  kind: UpperKind
  x: number
  w: number
  /** угловой верхний: ширина глухой части и с какой стороны угол */
  blind?: number
  blindAt?: 'start' | 'end'
}
/** Верхний шкаф уже этого (см) не делают — ставят доборную панель. */
export const UPPER_MIN = 20

/** Не поместилось: что, сколько см не хватило и на какой стене. */
export type Dropped = { item: ItemKey; slot?: SlotKind; need: number; wall: RunId }

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
  /**
   * не поместилось; need — сколько см не хватило на стене wall (slot — если
   * это товар). Вытяжка над панелью под окном — `{ item: 'hob', slot: 'hood' }`.
   */
  dropped: Dropped[]
  /** turn — остров повёрнут на столько градусов (`islandTurn`); x, z, w, d — как до поворота */
  island?: { x: number; z: number; w: number; d: number; turn?: number }
  /** обеденная группа (только для примерки): середина x, z, см; rot 90 — стол вдоль Z */
  dining?: DiningPlace
  /** духовку хотели в пенал или в свой шкаф, а она встала под варочную панель */
  ovenMovedUnderHob?: boolean
  /** техника шире своего места: w — ширина техники, room — ширина места, см */
  tooWide?: { slot: 'oven' | 'hood'; w: number; room: number; wall: RunId }[]
  /** техника под столешницей со своей высотой: стиральная и отдельностоящая посудомойка */
  underCounter?: { slot: 'washer' | 'dishwasher'; h: number; wall: RunId }[]
  /** низ вытяжки над варочной панелью, см (решает раскладка, рисует 3D) */
  hoodHeight?: { over: number; gas: boolean }
  /** отдельностоящая плита встала: её габариты, см, и стена */
  stove?: { w: number; h: number; d: number; wall: RunId }
  /** «Пустая комната»: между модулями — пустое место, шкафов по правилам нет */
  free?: true
  /** пустая комната: выбранная техника, которую не поставили на стену, — не в 3D и не в сумме */
  unplaced?: SlotKind[]
}

/**
 * Низ верхнего ряда от пола, см — одно число для 3D, чертежа, экрана и
 * проверки. Встроенная вытяжка (телескопическая, полностью встраиваемая)
 * стоит в шкафу ряда, и её низ должен быть на норме над панелью
 * (`hoodHeight.over`): тогда поднимается весь верхний ряд на всех стенах —
 * шкафы ровные, угол сходится. Каминная и наклонная висят на стене между
 * шкафами, «камин» стиля — свой короб, над островом — своя вытяжка: ряд
 * прежний, `UPPER_BOTTOM`. Панель — верх столешницы (`look.topCm`) или верх
 * отдельностоящей плиты.
 */
export function upperBottomOf(plan: Plan, hood: { hood?: HoodKind } | null | undefined, look: { topCm: number; mantel?: boolean }): number {
  const below = hood ? hoodBelow(hood.hood) : null
  if (below === null || look.mantel || !plan.hoodHeight) return UPPER_BOTTOM
  if (!plan.runs.some((r) => r.wall && r.uppers.some((u) => u.kind === 'hood'))) return UPPER_BOTTOM
  const cook = plan.stove ? plan.stove.h : counterTop(look.topCm)
  // до миллиметра вверх: вытяжка не опускается ниже нормы из-за округления
  return Math.max(UPPER_BOTTOM, Math.ceil((cook + plan.hoodHeight.over + below) * 10 - 1e-6) / 10)
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
  /** своё место предметов: середина, см от угла */
  at?: Partial<Record<ItemKey, number>>
  /** своя ширина мойки, шкафа под плитой, пеналов */
  widths?: Partial<Record<SizedItem, number>>
  /** габариты выбранной духовки, см: шкаф под ней не уже её */
  oven?: { w: number; h: number; d: number } | null
  /**
   * Выбрана отдельностоящая плита (`hob` — она же), габариты, см: место ровно
   * её ширины, духовка внутри — пенал с духовкой и отдельная духовка не нужны.
   */
  stove?: { w: number; h: number; d: number } | null
  /** ширина выбранной вытяжки, см: её место не уже её */
  hood?: { w: number } | null
  /**
   * Какие предметы со своим местом (`at`) поставлены рукой только что: они
   * встают вплотную к соседу ближе `SNAP`. Нет — так ведут себя все;
   * `[]` — места заморожены и никто не прилипает.
   */
  snap?: ItemKey[]
  /** «Пустая комната» (PRO): раскладка `planFree`, без шкафов по правилам */
  free?: FreeRoom
  /** обеденный стол со стульями (только для примерки) */
  dining?: DiningSeats
  /** остров повёрнут, градусы */
  islandTurn?: number
  /** обеденный стол повёрнут, градусы */
  diningTurn?: number
}

/**
 * Обеденная группа на полу, см: середина x, z; rot — поворот стола, градусы
 * (сам встал 0 или 90 + поворот покупателя `turn`); w×d — стол.
 */
export type DiningPlace = { x: number; z: number; rot: number; turn: number; seats: DiningSeats; w: number; d: number; long: number; ends: number }

type Item =
  | {
      kind: ModuleKind
      w: number
      slot?: SlotKind
      item?: ItemKey
      blind?: number
      blindAt?: 'start' | 'end'
      oven?: boolean
      stove?: boolean
      front?: BaseFront
      /** своё место: начало вдоль ряда, см (в системе координат ряда) */
      at?: number
    }
  | { fill: number; min: number; prefer: 'doors' | 'drawers'; role: 'work' | 'side' }

const isFill = (i: Item): i is Extract<Item, { fill: number }> => 'fill' in i

/** Ширина места под отдельностоящую технику: корпус + зазоры, округлено вверх. */
const slotWidth = (a: KitchenAppliance | null | undefined, fallback: number, extra = 0) =>
  a ? Math.ceil(a.w + 1.5 + extra) : fallback

/** Шкаф под варочной не уже самой панели (округлено до 5 см вверх). */
export const hobMinWidth = (hob: KitchenAppliance | null | undefined) => Math.max(HOB_W, hob ? up5(hob.w) : HOB_W)

/** Своя ширина в пределах, целыми сантиметрами. */
export function sizedWidth(kind: keyof typeof WIDTH_LIMITS, w: number | undefined): number {
  const lim = WIDTH_LIMITS[kind]
  const v = Math.round(Number(w))
  return Number.isFinite(v) ? Math.max(lim.min, Math.min(lim.max, v)) : lim.min
}

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

const sizeOf = (i: Item) => (isFill(i) ? i.min : i.w)

/**
 * Расставляет элементы по ряду длиной `length`. Возвращает модули с
 * координатами или null, если фиксированные элементы не помещаются.
 *
 * Предмет со своим местом (`at`) встаёт туда, куда его поставили, — насколько
 * пускают соседи и края стены. Такие предметы делят ряд на куски, и в каждом
 * куске остаток столешницы делится между шкафами, как раньше: соседние шкафы
 * становятся шире или уже.
 */
export function resolveRun(length: number, start: number, items: Item[], canSnap: (key?: ItemKey) => boolean = () => true): Module[] | null {
  const fixed = items.reduce((s, i) => s + sizeOf(i), 0)
  if (fixed > length - start + 0.01) return null
  const out: Module[] = []
  let from = start
  let seg: Item[] = []
  /** сумма ширин куска до предмета — ближе к началу он встать не может */
  let before = 0
  /** то же без запасов столешницы: где кончается физический сосед */
  let beforeSolid = 0
  /** сумма ширин от текущего элемента до конца ряда */
  let after = fixed
  let afterSolid = items.reduce((s, i) => s + (isFill(i) ? 0 : i.w), 0)
  for (const item of items) {
    if (!isFill(item) && item.at !== undefined) {
      const lo = from + before
      const hi = length - after
      let x = Math.min(hi, Math.max(lo, item.at))
      // Прилипает только поставленное рукой и только к соседу или краю, а не
      // к расчётному запасу у плиты: иначе замороженное место сдвигается.
      if (canSnap(item.item)) {
        if (x - (from + beforeSolid) < SNAP) x = lo
        else if (length - afterSolid - x < SNAP) x = hi
      }
      out.push(...fillSegment(from, x, seg))
      out.push(moduleOf(item, x))
      from = x + item.w
      seg = []
      before = 0
      beforeSolid = 0
      after -= item.w
      afterSolid -= item.w
      continue
    }
    seg.push(item)
    before += sizeOf(item)
    after -= sizeOf(item)
    if (!isFill(item)) {
      beforeSolid += item.w
      afterSolid -= item.w
    }
  }
  out.push(...fillSegment(from, length, seg))
  return out
}

function moduleOf(item: Extract<Item, { kind: ModuleKind }>, x: number): Module {
  return { kind: item.kind, x, w: item.w, blind: item.blind, blindAt: item.blindAt, oven: item.oven, item: item.item, front: item.front, ...(item.stove ? { stove: true } : {}) }
}

/**
 * Кусок ряда от `from` до `to`: предметы — своей ширины, остаток делят шкафы
 * по весам. Заполнитель с весом 0 (щель перед предметом на своём месте)
 * получает место, только если больше некому.
 */
function fillSegment(from: number, to: number, items: Item[]): Module[] {
  let list = items
  const fixedW = list.reduce((s, i) => s + sizeOf(i), 0)
  // Остаток куска должен куда-то уйти: нет заполнителя — ставим в конец.
  if (!list.some(isFill) && to - from - fixedW > 0.5) list = [...list, { fill: 1, min: 0, prefer: 'doors', role: 'side' }]
  const fills = list.filter(isFill)
  const weights = fills.reduce((s, i) => s + i.fill, 0)
  const weighted = fills.filter((i) => i.fill > 0)
  const lastFill = weighted[weighted.length - 1] ?? fills[fills.length - 1]
  const total = Math.max(0, to - from - fixedW)
  let extra = total
  const out: Module[] = []
  let lastPiece = -1
  let x = from
  for (const item of list) {
    if (!isFill(item)) {
      out.push(moduleOf(item, x))
      x += item.w
      continue
    }
    let w = item.min + (weights > 0 ? Math.floor((total * item.fill) / weights) : 0)
    if (item === lastFill) w = item.min + extra
    extra -= w - item.min
    for (const m of splitFill(w, item.prefer, item.role)) {
      out.push({ ...m, x })
      lastPiece = out.length - 1
      x += m.w
    }
  }
  // Шкафы режутся по целым сантиметрам — дробный остаток отдаём последнему,
  // чтобы кусок кончался ровно там, где стоит следующий предмет.
  const drift = x - to
  if (lastPiece >= 0 && Math.abs(drift) > 0.001 && out[lastPiece].w - drift > 0.5) {
    out[lastPiece].w -= drift
    for (let k = lastPiece + 1; k < out.length; k++) out[k].x -= drift
  }
  return out
}

type Sequence = { items: Item[] }

/**
 * Ставит ряд, убирая необязательное по очереди, пока всё не влезет.
 * Порядок уступок: пеналы для хранения, стиральная, посудомойка, пенал с
 * духовкой, холодильник.
 */
/**
 * Убрали предмет — два куска столешницы по его бокам становятся одним.
 * Иначе остаток делится на лишние узкие шкафы, а при заморозке мест (C16)
 * округление делит его уже по-другому.
 */
function mergeFills(items: Item[]): Item[] {
  const out: Item[] = []
  for (const i of items) {
    const last = out[out.length - 1]
    if (last && isFill(last) && isFill(i)) {
      out[out.length - 1] = {
        fill: last.fill + i.fill,
        min: Math.max(last.min, i.min),
        prefer: last.min >= i.min ? last.prefer : i.prefer,
        role: last.role === 'side' || i.role === 'side' ? 'side' : 'work',
      }
      continue
    }
    out.push(i)
  }
  return out
}

type Placing = {
  wall: RunId
  /** до какой ширины можно сузить мойку и шкаф плиты, см */
  narrowest: { sink: number; hob: number }
  canSnap: (key?: ItemKey) => boolean
}

function place(length: number, start: number, seq: Sequence, dropped: Dropped[], how: Placing): { modules: Module[]; items: Item[] } {
  let items = seq.items
  const order: FixedItem[] = ['pantry2', 'pantry', 'washer', 'dishwasher', 'oven', 'tall', 'fridge']
  const room = length - start
  /** measured — по какому списку считать нехватку (для мойки и плиты — по суженному) */
  const drop = (victim: ItemKey, measured: Item[] = items) => {
    const fixed = measured.reduce((s, i) => s + sizeOf(i), 0)
    const victimItem = items.find((i) => !isFill(i) && i.item === victim) as Extract<Item, { kind: ModuleKind }>
    dropped.push({ item: victim, slot: victimItem.slot, need: Math.max(1, Math.ceil(fixed - room)), wall: how.wall })
    items = mergeFills(items.filter((i) => i !== victimItem))
  }
  for (;;) {
    const modules = resolveRun(length, start, items, how.canSnap)
    if (modules) return { modules, items }
    // первыми уступают свои шкафы покупателя (с конца), потом техника по списку
    const cabs = items.filter((i) => !isFill(i) && i.item && isCabinet(i.item))
    const lastCab = cabs[cabs.length - 1] as Extract<Item, { kind: ModuleKind }> | undefined
    const victim = lastCab?.item ?? order.find((key) => items.some((i) => !isFill(i) && i.item === key))
    if (victim) {
      drop(victim)
      continue
    }
    // Мойка и плита уходят последними. Только для этой попытки: запас
    // столешницы в ноль, мойку и шкаф плиты сужаем до минимума (середина на месте).
    const tight = items.map((i) => (isFill(i) ? { ...i, min: 0 } : i))
    let over = tight.reduce((s, i) => s + sizeOf(i), 0) - room
    const squeezed = tight.map((i) => {
      if (isFill(i) || over <= 0.01 || (i.kind !== 'sink' && i.kind !== 'hob')) return i
      const cut = Math.min(Math.ceil(over), i.w - how.narrowest[i.kind])
      if (cut <= 0) return i
      over -= cut
      return { ...i, w: i.w - cut, at: i.at === undefined ? undefined : i.at + cut / 2 }
    })
    const fitted = resolveRun(length, start, squeezed, how.canSnap)
    if (fitted) return { modules: fitted, items: squeezed }
    // Не помогло — честно пишем в «не поместилось»: сначала плиту, потом мойку.
    // Следующая попытка — снова со своими ширинами и запасами.
    const essential = (['hob', 'sink'] as const).find((key) => items.some((i) => !isFill(i) && i.item === key))
    if (essential) {
      drop(essential, squeezed)
      continue
    }
    // Не влезают даже угловые шкафы (стена короче minA).
    const onlyFill: Item[] = [{ fill: 1, min: 0, prefer: 'doors', role: 'side' }]
    return { modules: resolveRun(length, start, onlyFill) ?? [], items: onlyFill }
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
    // Кусок у окна: шкаф остаётся шкафом (угловой — только со стороны угла),
    // над плитой вытяжку не повесить — там обычный шкаф; над высоким — пусто.
    const piece = (x: number, w: number, cornerSide: boolean): Upper => {
      if (u.kind === 'doors' || u.kind === 'shelf') return { kind: u.kind, x, w }
      if (u.kind === 'corner') return cornerSide ? { ...u, x, w } : { kind: 'doors', x, w }
      // над плитой навесного шкафа не бывает: за окном — пусто
      if (u.kind === 'hood') return { kind: 'none', x, w }
      return { kind: 'none', x, w }
    }
    if (left > 0.01) out.push(piece(m.x, left, u.blindAt === 'start'))
    out.push({ kind: 'none', x: Math.max(m.x, windowSpan.from), w: Math.min(m.x + m.w, windowSpan.to) - Math.max(m.x, windowSpan.from) })
    if (right > 0.01) out.push(piece(windowSpan.to, right, u.blindAt === 'end'))
  }
  return out
}

/** Шкафы, которые можно сузить ради вытяжки. */
const SHRINKABLE: UpperKind[] = ['doors', 'shelf', 'filler']

/**
 * Место вытяжки не уже самой вытяжки: раздвигаем его поровну в обе стороны
 * от середины плиты, соседние шкафы сужаются. Упёрлись в окно, высокий шкаф,
 * угол или край стены — насколько вышло. Возвращает ширину места.
 */
function widenHood(ups: Upper[], hob: Module, want: number): number {
  const h = ups.findIndex((u) => u.kind === 'hood')
  if (h < 0) return 0
  const hood = ups[h]
  const need = (want - hood.w) / 2
  if (need <= 0.001) return hood.w
  const room = (step: 1 | -1) => {
    let sum = 0
    for (let j = h + step; j >= 0 && j < ups.length && SHRINKABLE.includes(ups[j].kind); j += step) sum += ups[j].w
    return sum
  }
  const ext = Math.min(need, room(-1), room(1))
  if (ext <= 0.001) return hood.w
  for (const step of [-1, 1] as const) {
    let left = ext
    for (let j = h + step; left > 0.001 && j >= 0 && j < ups.length; j += step) {
      const take = Math.min(left, ups[j].w)
      ups[j].w -= take
      if (step === 1) ups[j].x += take
      left -= take
    }
  }
  hood.x = hob.x + hob.w / 2 - (hood.w + 2 * ext) / 2
  hood.w += 2 * ext
  for (let j = ups.length - 1; j >= 0; j--) if (ups[j].w <= 0.001) ups.splice(j, 1)
  return hood.w
}

/** Верх уже `UPPER_MIN` — доборная панель без корпуса; у углового — если на дверцу не осталось места. */
function narrowToFiller(ups: Upper[]) {
  for (const u of ups) {
    const open = u.kind === 'corner' ? u.w - (u.blind ?? 0) : u.w
    if ((u.kind === 'doors' || u.kind === 'shelf' || u.kind === 'corner') && open < UPPER_MIN - 0.001) {
      u.kind = 'filler'
      delete u.blind
      delete u.blindAt
    }
  }
}

type UpperOpts = { shelves: boolean; fridgeOpen: boolean }

function upperFor(m: Module, opts: UpperOpts): Upper {
  if (m.kind === 'hob') return { kind: 'hood', x: m.x, w: m.w }
  // Над угловым: со стороны угла глухо — там верх соседней стены (C05).
  if (m.kind === 'corner') return { kind: 'corner', x: m.x, w: m.w, blind: UPPER_DEPTH, blindAt: m.blindAt }
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
  const gap = (left: Neighbour, right: Neighbour, placed = false) => {
    // Перед предметом на своём месте щель нужна всегда — иначе его не
    // отодвинуть от соседа. Вес 0: она растёт, только если больше некому.
    const forced = () => placed && out.push({ fill: 0, min: 0, prefer, role: 'work' })
    // высокие шкафы и свои шкафы покупателя встают прямо к стене, без доборов
    const atEnd = (a: Neighbour, b: Neighbour) => a === null && b !== null && b !== 'corner' && (TALL_ITEMS.includes(b) || isCabinet(b))
    if (atEnd(left, right) || atEnd(right, left)) return forced()
    if (left && right && left !== 'corner' && right !== 'corner' && glued(left, right)) return forced()
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
    gap(prev, k, !isFill(item) && item.at !== undefined)
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

/**
 * Раскладка. Остров повёрнут — ряд `I` поворачивается целиком (`turnIsland`);
 * обеденная группа встаёт в свободную часть комнаты (`placeDining`) — обе
 * поверх готовой раскладки: места шкафов от них не меняются.
 */
export function planKitchen(input: PlanInput, options: { shelves: boolean }): Plan {
  let plan = planLayout(input, options)
  if (input.islandTurn) plan = turnIsland(plan, input.islandTurn)
  if (input.dining) plan = placeDining(plan, input.dining, input.diningTurn)
  return plan
}

/** Градусы поворота острова: целое 0…359 (360 → 0, −1 → 359). */
export function islandTurnOf(deg: number | undefined): number {
  const d = Math.round(Number(deg) || 0) % 360
  return d < 0 ? d + 360 : d
}

/** Середина острова со свесом, см (вокруг неё он и поворачивается). */
export function islandCenter(isl: NonNullable<Plan['island']>): [number, number] {
  return [isl.x + isl.w / 2, isl.z - DEPTH + isl.d / 2]
}

/**
 * Остров, повёрнутый покупателем: ряд `I` поворачивается вокруг своей
 * середины. 3D, план сверху, проверки и перетаскивание считают по `ox`/`oz`/`rot`
 * ряда — поворот понимают сами; места модулей вдоль ряда те же.
 */
function turnIsland(plan: Plan, deg: number): Plan {
  const turn = islandTurnOf(deg)
  const isl = plan.island
  if (!turn || !isl) return plan
  const phi = (turn * Math.PI) / 180
  const [cx, cz] = islandCenter(isl)
  const cos = Math.cos(phi)
  const sin = Math.sin(phi)
  const runs = plan.runs.map((r) => {
    if (r.wall) return r
    const dx = r.ox - cx
    const dz = r.oz - cz
    return { ...r, ox: cx + dx * cos + dz * sin, oz: cz - dx * sin + dz * cos, rot: r.rot + phi }
  })
  return { ...plan, runs, island: { ...isl, turn } }
}

/** Как далеко от стены A по полу заняты шкафы ряда, см (по углам шкафов на полу: ряд B идёт от своего конца к углу). */
const reachOf = (plan: Plan, id: RunId): number => {
  const run = plan.runs.find((r) => r.id === id)
  if (!run?.modules.length) return 0
  const cos = Math.cos(run.rot)
  const sin = Math.sin(run.rot)
  const z = (x: number, d: number) => run.oz - x * sin + d * cos
  return Math.max(...run.modules.flatMap((m) => [z(m.x, 0), z(m.x + m.w, 0), z(m.x, DEPTH), z(m.x + m.w, DEPTH)]))
}

/**
 * Обеденная группа: перед кухней (за островом с его стульями), в проходе
 * `DINING_AISLE`; не лезет к шкафам стен B и C. Сам стол встаёт поперёк
 * комнаты, не влез — вдоль (90°), поворот покупателя (`turn`) — поверх.
 * Повёрнутая группа (по её габариту на полу) рядом с рядами B/C не влезла —
 * встаёт за их концом. Комната становится глубже, если группа в неё не входит.
 */
function placeDining(plan: Plan, seats: DiningSeats, turnDeg?: number): Plan {
  const t = DINING[seats]
  const turn = islandTurnOf(turnDeg)
  const setW = t.w + 2 * t.ends * DINING_CHAIR
  const setD = t.d + 2 * DINING_CHAIR
  // габарит группы на полу при повороте deg: вдоль X, вдоль Z
  const box = (deg: number): [number, number] => {
    const a = (deg * Math.PI) / 180
    const cos = Math.abs(Math.cos(a))
    const sin = Math.abs(Math.sin(a))
    return [setW * cos + setD * sin, setW * sin + setD * cos]
  }
  const W = plan.room.w
  const b = reachOf(plan, 'B')
  const c = reachOf(plan, 'C')
  let front = reachOf(plan, 'A') ? DEPTH : 0
  const iRun = plan.runs.find((r) => r.id === 'I')
  if (iRun && reachOf(plan, 'I')) {
    // шкафы, свес и стулья острова — стулья до 70 см за спинкой (в координатах ряда z < 0); остров мог быть повёрнут
    const cos = Math.cos(iRun.rot)
    const sin = Math.sin(iRun.rot)
    const L = plan.island?.w ?? iRun.length
    front = Math.max(front, ...[[0, -70], [L, -70], [0, DEPTH], [L, DEPTH]].map(([x, z]) => iRun.oz - x * sin + z * cos))
  }
  let z0 = front + DINING_AISLE
  const sides = (z: number): [number, number] => [b > z ? DEPTH + DINING_AISLE : 20, c > z ? W - DEPTH - DINING_AISLE : W - 20]
  let [xl, xr] = sides(z0)
  const base = box(0)[0] <= xr - xl ? 0 : box(90)[0] <= xr - xl ? 90 : box(0)[0] <= W - 40 ? 0 : 90
  const [wx, dz] = box(base + turn)
  if (wx > xr - xl) {
    // рядом с рядами B/C не встаёт — за их концом
    z0 = Math.max(z0, b + 30, c + 30)
    ;[xl, xr] = [20, W - 20]
  }
  const x = xr - xl >= wx ? Math.max(xl + wx / 2, Math.min(xr - wx / 2, W / 2)) : W / 2
  const room = { ...plan.room, d: Math.max(plan.room.d, Math.ceil(z0 + dz + 30)) }
  return { ...plan, room, dining: { x, z: z0 + dz / 2, rot: base + turn, turn, seats, w: t.w, d: t.d, long: t.long, ends: t.ends } }
}

function planLayout(input: PlanInput, options: { shelves: boolean }): Plan {
  if (input.free) return planFree(input)
  const { shape } = input
  const dropped: Dropped[] = []
  // Плита: духовка в ней — пенал с духовкой и отдельная духовка не строятся.
  const stove = input.stove ?? null
  const apart = !stove && Boolean(input.ovenApart) && !input.noOven
  const hasTall = Boolean(input.microwave?.builtIn) || (!stove && Boolean(input.tallOven) && !apart)
  const pantries = Math.max(0, Math.min(2, Math.round(input.pantries ?? 0)))
  // В нише у холодильника боковины: место шире на их толщину.
  const fridgeW = slotWidth(input.fridge, 0, input.fridgeOpen ? 0 : NICHE_EXTRA)
  const upperOpts: UpperOpts = { shelves: options.shelves, fridgeOpen: Boolean(input.fridgeOpen) }
  // Шкаф под духовкой (и колонна с ней) не уже самой духовки, кратно 5 см.
  const ovenW = input.oven ? Math.max(HOB_W, up5(input.oven.w)) : HOB_W
  const ovenUnderHob = !stove && !hasTall && !apart
  // Плита стоит на полу без шкафа: место ровно её ширины, не шире и не уже.
  const hobFloor = stove ? stove.w : Math.max(hobMinWidth(input.hob), ovenUnderHob ? ovenW : 0)
  const hobW = stove ? stove.w : Math.max(hobFloor, sizedWidth('hob', input.widths?.hob))
  const dwW = input.dishwasher ? (input.dishwasher.w <= 46 ? 45 : 60) : 0
  const sinkW = sizedWidth('sink', input.widths?.sink ?? SINK_W)
  const snapSet = input.snap ? new Set<ItemKey>(input.snap) : null
  const canSnap = (key?: ItemKey) => !snapSet || (key !== undefined && snapSet.has(key))
  const how = (wall: RunId): Placing => ({ wall, canSnap, narrowest: { sink: Math.min(sinkW, WIDTH_LIMITS.sink.min), hob: Math.min(hobW, hobFloor) } })

  const kindOf = (k: ItemKey): Extract<Item, { kind: ModuleKind }> | null => {
    switch (k) {
      case 'fridge':
        return input.fridge ? { kind: 'fridge', w: fridgeW, slot: 'fridge', item: k } : null
      case 'tall': {
        const w = Math.max(sizedWidth('tall', input.widths?.tall ?? TALL_W), apart || stove ? 0 : ovenW)
        return hasTall ? { kind: 'tall', w, slot: input.microwave?.builtIn ? 'microwave' : 'oven', item: k } : null
      }
      case 'sink':
        return { kind: 'sink', w: sinkW, item: k }
      case 'dishwasher':
        return input.dishwasher ? { kind: 'dishwasher', w: dwW, slot: 'dishwasher', item: k } : null
      case 'washer':
        return input.washer ? { kind: 'washer', w: slotWidth(input.washer, WASHER_W), slot: 'washer', item: k } : null
      case 'hob':
        return stove ? { kind: 'hob', w: hobW, slot: 'hob', oven: false, stove: true, item: k } : { kind: 'hob', w: hobW, slot: 'hob', oven: !hasTall, item: k }
      case 'pantry':
        return pantries >= 1 ? { kind: 'pantry', w: sizedWidth('pantry', input.widths?.pantry ?? PANTRY_W), item: k } : null
      case 'pantry2':
        return pantries >= 2 ? { kind: 'pantry', w: sizedWidth('pantry2', input.widths?.pantry2 ?? PANTRY_W), item: k } : null
      case 'oven':
        return apart ? { kind: 'oven', w: ovenW, slot: 'oven', item: k } : null
    }
    const cab = input.cabinets?.[k]
    if (!cab) return null
    const w = sizedWidth('cabinet', cab.w)
    return { kind: cab.front === 'doors' || cab.front === 'open' ? 'doors' : 'drawers', w, item: k, front: cab.front }
  }
  // Предмет на своём месте: середина → начало вдоль ряда.
  const make = (k: ItemKey): Item | null => {
    const item = kindOf(k)
    const center = input.at?.[k]
    return item && center !== undefined && Number.isFinite(center) ? { ...item, at: center - item.w / 2 } : item
  }
  const order = resolveArrangement(shape, input.arrangement, input.cabinets)

  const runs: Run[] = []
  const placed: Plan['placed'] = {}
  let window: Plan['window']
  let room: Plan['room']
  let island: Plan['island']

  const pushRun = (run: Omit<Run, 'modules' | 'uppers'>, start: number, items: Item[], reversed = false) => {
    const { modules, items: kept } = place(run.length, start, { items }, dropped, how(run.id))
    const laid = reversed ? modules.map((m) => ({ ...m, x: run.length - m.x - m.w, blindAt: flip(m.blindAt) })).reverse() : modules
    const uppers = uppersFor(laid, upperOpts)
    if (start === DEPTH) reachCorner(uppers, reversed ? run.length - DEPTH : DEPTH, reversed)
    const full: Run = { ...run, modules: laid, uppers }
    runs.push(full)
    Object.assign(placed, indexOfSlot(full, kept, laid))
    return full
  }
  /**
   * Окно над мойкой, если мойка у задней стены; иначе — посередине стены.
   * Над холодильником, пеналом и колонной окна не бывает: оно сдвигается или
   * сужается (не уже 60 см). Не вышло — остаётся, и проверка это покажет.
   */
  const backWindow = (a: Run, width: number, fallback: number): Plan['window'] => {
    if (input.noWindow) return null
    const want = clampWindow(input.windowW ?? width, a.length)
    const sinkModule = a.modules.find((m) => m.kind === 'sink')
    const mid = sinkModule ? sinkModule.x + sinkModule.w / 2 : fallback
    const { at, w } = windowSpot(a.length, want, mid, a.modules.filter((m) => isTall(m.kind)))
    a.uppers = uppersFor(a.modules, upperOpts, { from: at - w / 2, to: at + w / 2 })
    return { wall: 'back', at, w }
  }

  if (shape === 'straight' || shape === 'island') {
    const a = input.a
    pushRun({ id: 'A', ox: 0, oz: 0, rot: 0, length: a, wall: true }, 0, wallItems(order.A, make, { start: false, end: false }))
    room = { w: a, d: shape === 'island' ? 400 : 270 }
    // Левое окно — за глубиной ряда: иначе его закроет боковина крайнего шкафа.
    const w = Math.min(clampWindow(input.windowW ?? 110, room.d), room.d - 10 - DEPTH)
    const at = Math.max(DEPTH + w / 2, Math.min(room.d - w / 2 - 10, shape === 'island' ? 200 : 180))
    window = input.noWindow ? null : { wall: 'left', at, w }
    if (shape === 'island') {
      // Остров не длиннее стены A.
      const w = Math.round(Math.min(input.island, a))
      const x = Math.round(Math.max(0, (a - w) / 2))
      // Проход между кухней и островом — 110 см, как в хороших проектах.
      island = { x, z: DEPTH + 110 + DEPTH, w, d: 90 }
      // Шкафы острова смотрят на кухню, с другой стороны — барная стойка.
      // На остров можно поставить мойку, плиту, посудомойку и свои шкафы.
      const { modules, items: kept } = place(w, 0, { items: wallItems(order.I, make, { start: false, end: false }, 'drawers') }, dropped, how('I'))
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
  const inTall = !stove && tallPlaced && !ovenPlaced
  for (const r of runs)
    for (const m of r.modules) {
      if (m.kind === 'hob') m.oven = !stove && !inTall && !ovenPlaced
      if (m.kind === 'tall') m.oven = inTall
    }
  // Пенал или свой шкаф духовки не встал, а шкаф плиты есть — духовка под
  // плитой: она в проекте, а не «не поместилась» (C03).
  // То же, если свой шкаф не встал, а духовка ушла в колонну.
  const hobHasOven = runs.some((r) => r.modules.some((m) => m.kind === 'hob' && m.oven))
  const ovenHome = runs.some((r) => r.modules.some((m) => m.oven && (m.kind === 'hob' || m.kind === 'tall')))
  const ovenMovedUnderHob = !input.noOven && !ovenUnderHob && hobHasOven
  if (!input.noOven && ovenHome) for (let i = dropped.length - 1; i >= 0; i--) if (dropped[i].slot === 'oven') dropped.splice(i, 1)

  const tooWide: NonNullable<Plan['tooWide']> = []
  const underCounter: NonNullable<Plan['underCounter']> = []
  let hoodHeight: Plan['hoodHeight']
  for (const r of runs) {
    for (const m of r.modules) {
      const holdsOven = m.kind === 'oven' || (m.oven && (m.kind === 'hob' || m.kind === 'tall'))
      if (input.oven && !input.noOven && holdsOven && m.w < input.oven.w - 0.01) tooWide.push({ slot: 'oven', w: input.oven.w, room: m.w, wall: r.id })
      if (m.kind === 'washer' && input.washer) underCounter.push({ slot: 'washer', h: input.washer.h, wall: r.id })
      if (m.kind === 'dishwasher' && input.dishwasher && !input.dishwasher.builtIn) underCounter.push({ slot: 'dishwasher', h: input.dishwasher.h, wall: r.id })
    }
    const hobM = r.modules.find((m) => m.kind === 'hob')
    if (r.wall && hobM && input.hood) {
      if (r.uppers.some((u) => u.kind === 'hood')) {
        const w = widenHood(r.uppers, hobM, up5(input.hood.w))
        if (w < input.hood.w - 0.01) tooWide.push({ slot: 'hood', w: input.hood.w, room: w, wall: r.id })
      } else {
        // Плита под окном: вытяжку не повесить (C18).
        const win = window && window.wall === 'back' && r.id === 'A' ? window : null
        const overlap = win ? Math.min(hobM.x + hobM.w, win.at + win.w / 2) - Math.max(hobM.x, win.at - win.w / 2) : 1
        dropped.push({ item: 'hob', slot: 'hood', need: Math.max(1, Math.ceil(overlap)), wall: r.id })
      }
    }
    narrowToFiller(r.uppers)
  }
  const hoodHangs = Boolean(input.hood) && runs.some((r) => r.modules.some((m) => m.kind === 'hob')) && !dropped.some((d) => d.slot === 'hood')
  if (hoodHangs) {
    const gas = input.hob?.hob === 'gas'
    hoodHeight = { over: hoodNorm(gas), gas }
  }

  const plan: Plan = { shape, runs, room, window, placed, dropped, island }
  if (ovenMovedUnderHob) plan.ovenMovedUnderHob = true
  if (tooWide.length) plan.tooWide = tooWide
  if (underCounter.length) plan.underCounter = underCounter
  if (hoodHeight) plan.hoodHeight = hoodHeight
  const stoveRun = stove && runs.find((r) => r.modules.some((m) => m.kind === 'hob' && m.stove))
  if (stove && stoveRun) plan.stove = { w: stove.w, h: stove.h, d: stove.d, wall: stoveRun.id }
  return plan
}

/* ───────────── пустая комната ───────────── */

/** Свой верхний шкаф пустой комнаты: ширина, см. */
export const FREE_UPPER = { min: 15, max: 120 }
/** Пустая комната: ближе этого (см) к соседу или краю поставленное встаёт вплотную — меньше шага кнопок (5 см). */
export const FREE_SNAP = 3
/** Угловой шкаф пустой комнаты: ширина, см (глухая часть 60 + дверца). */
export const FREE_CORNER = { min: 90, max: 130 }

/** Ширина углового шкафа пустой комнаты у конца стены A, см. */
export function freeCornerW(free: FreeRoom | undefined, end: 'start' | 'end'): number {
  const w = Math.round(Number(free?.cornerW?.[end]))
  return Number.isFinite(w) ? Math.max(FREE_CORNER.min, Math.min(FREE_CORNER.max, w)) : CORNER_W
}

/**
 * Где на стене пустой комнаты можно ставить низ, см от угла (как `at`).
 * Угловой шкаф стены A занимает свой конец; ряды B и C начинаются за
 * глубиной ряда A — угол принадлежит стене A, как у правил.
 */
export function freeRange(input: Pick<PlanInput, 'shape' | 'a' | 'b' | 'c' | 'island' | 'free'>, wall: WallId): [number, number] {
  const corners = freeCorners(input.shape, input.free)
  if (wall === 'A') return [corners.includes('start') ? freeCornerW(input.free, 'start') : 0, input.a - (corners.includes('end') ? freeCornerW(input.free, 'end') : 0)]
  if (wall === 'B') return [DEPTH, input.b]
  if (wall === 'C') return [DEPTH, input.c]
  return [0, Math.round(Math.min(input.island, input.a))]
}

/** Где на стене пустой комнаты можно вешать свой верх, см от угла: у B и C — от верха стены A. */
export function freeUpperRange(input: Pick<PlanInput, 'a' | 'b' | 'c'>, wall: 'A' | 'B' | 'C'): [number, number] {
  if (wall === 'A') return [0, input.a]
  return [UPPER_DEPTH, wall === 'B' ? input.b : input.c]
}

/** Угловые шкафы, которые бывают у формы: start — угловая и П, end — только П. */
export function freeCorners(shape: Shape, free: FreeRoom | undefined): ('start' | 'end')[] {
  return (['start', 'end'] as const).filter((e) => (free?.corners ?? []).includes(e) && (e === 'start' ? shape === 'corner' || shape === 'u' : shape === 'u'))
}

/** Свободные промежутки [от, до] между занятыми отрезками внутри [lo, hi]. */
export function freeGaps(taken: [number, number][], lo: number, hi: number): [number, number][] {
  const out: [number, number][] = []
  let at = lo
  for (const [s, e] of [...taken].sort((p, q) => p[0] - q[0])) {
    if (s - at > 0.01) out.push([at, Math.min(s, hi)])
    at = Math.max(at, e)
  }
  if (hi - at > 0.01) out.push([at, hi])
  return out.filter(([s, e]) => e - s > 0.01)
}

/**
 * Место шириной w в промежутках: ближе всего к want (начало, см); first —
 * первое свободное от начала стены. Нет промежутка шире w — null.
 */
function freeSpot(taken: [number, number][], lo: number, hi: number, w: number, want: number | null): number | null {
  let best: { s: number; d: number } | null = null
  for (const [g0, g1] of freeGaps(taken, lo, hi)) {
    if (g1 - g0 < w - 0.01) continue
    if (want === null) return g0
    const s = Math.min(g1 - w, Math.max(g0, want))
    const d = Math.abs(s - want)
    if (!best || d < best.d - 0.001) best = { s, d }
  }
  return best ? best.s : null
}

/**
 * «Пустая комната» (PRO): стоит только то, что поставили сами, — по стенам
 * в `arrangement`, на своих местах `at` (середина от угла). Промежутки — пустое
 * место: ни шкафов, ни столешницы. Места не пересекаются: предмет встаёт в
 * ближайший свободный промежуток; двигаемые сейчас (`snap`) уступают стоящим.
 * Не поместилось — `dropped`; выбранная техника без места на стене — `unplaced`.
 * Комната, окно, духовка и вытяжка — по тем же правилам, что у обычной кухни.
 */
function planFree(input: PlanInput): Plan {
  const { shape } = input
  const dropped: Dropped[] = []
  const stove = input.stove ?? null
  const noOven = Boolean(input.noOven)
  const walls = wallsOf(shape)
  const known = (k: ItemKey) => (isCabinet(k) ? Boolean(input.cabinets?.[k]) : ITEM_KEYS.includes(k))
  const used = new Set<ItemKey>()
  const keysOn: Record<WallId, ItemKey[]> = { A: [], B: [], C: [], I: [] }
  for (const w of walls) {
    for (const k of input.arrangement?.[w] ?? []) {
      if (!known(k) || used.has(k) || !allowedOn(w, k)) continue
      keysOn[w].push(k)
      used.add(k)
    }
  }
  // Духовка: в своём шкафу, иначе в колонне, иначе под варочной панелью.
  const ovenOwn = !stove && !noOven && used.has('oven')
  const ovenInTall = !stove && !noOven && !ovenOwn && used.has('tall')
  const ovenUnderHob = !stove && !noOven && !ovenOwn && !ovenInTall
  const fridgeW = slotWidth(input.fridge, 0, input.fridgeOpen ? 0 : NICHE_EXTRA)
  const ovenW = input.oven ? Math.max(HOB_W, up5(input.oven.w)) : HOB_W
  const hobFloor = stove ? stove.w : Math.max(hobMinWidth(input.hob), ovenUnderHob ? ovenW : 0)
  const hobW = stove ? stove.w : Math.max(hobFloor, sizedWidth('hob', input.widths?.hob))
  const dwW = input.dishwasher ? (input.dishwasher.w <= 46 ? 45 : 60) : 0
  const sinkW = sizedWidth('sink', input.widths?.sink ?? SINK_W)
  const snapSet = input.snap ? new Set<ItemKey>(input.snap) : null
  const canSnap = (key: ItemKey) => !snapSet || snapSet.has(key)

  type Placeable = Extract<Item, { kind: ModuleKind }>
  const kindOf = (k: ItemKey): Placeable | null => {
    switch (k) {
      case 'fridge':
        return input.fridge ? { kind: 'fridge', w: fridgeW, slot: 'fridge', item: k } : null
      case 'tall': {
        const w = Math.max(sizedWidth('tall', input.widths?.tall ?? TALL_W), ovenInTall ? ovenW : 0)
        const slot: SlotKind | undefined = input.microwave?.builtIn ? 'microwave' : ovenInTall ? 'oven' : undefined
        return { kind: 'tall', w, ...(slot ? { slot } : {}), item: k }
      }
      case 'sink':
        return { kind: 'sink', w: sinkW, item: k }
      case 'dishwasher':
        return input.dishwasher ? { kind: 'dishwasher', w: dwW, slot: 'dishwasher', item: k } : null
      case 'washer':
        return input.washer ? { kind: 'washer', w: slotWidth(input.washer, WASHER_W), slot: 'washer', item: k } : null
      case 'hob':
        return stove ? { kind: 'hob', w: hobW, slot: 'hob', oven: false, stove: true, item: k } : { kind: 'hob', w: hobW, slot: 'hob', oven: ovenUnderHob, item: k }
      case 'pantry':
        return { kind: 'pantry', w: sizedWidth('pantry', input.widths?.pantry ?? PANTRY_W), item: k }
      case 'pantry2':
        return { kind: 'pantry', w: sizedWidth('pantry2', input.widths?.pantry2 ?? PANTRY_W), item: k }
      case 'oven':
        return ovenOwn ? { kind: 'oven', w: ovenW, slot: 'oven', item: k } : null
    }
    const cab = input.cabinets?.[k]
    if (!cab) return null
    const w = sizedWidth('cabinet', cab.w)
    return { kind: cab.front === 'doors' || cab.front === 'open' ? 'doors' : 'drawers', w, item: k, front: cab.front }
  }

  /** Места на стене (см от угла): сначала то, что стоит, потом двигаемое сейчас, потом без места. */
  const placeWall = (wall: WallId): { item: Placeable; s: number }[] => {
    const [lo, hi] = freeRange(input, wall)
    const wants = keysOn[wall].flatMap((key) => {
      const item = kindOf(key)
      if (!item) return []
      const c = input.at?.[key]
      return [{ item, c: c !== undefined && Number.isFinite(c) ? c : undefined }]
    })
    const moving = (k?: ItemKey) => Boolean(k && snapSet?.has(k))
    const queue = [
      ...wants.filter((x) => x.c !== undefined && !moving(x.item.item)),
      ...wants.filter((x) => x.c !== undefined && moving(x.item.item)),
      ...wants.filter((x) => x.c === undefined),
    ]
    const taken: [number, number][] = []
    const out: { item: Placeable; s: number }[] = []
    for (const { item, c } of queue) {
      const w = item.w
      let s = freeSpot(taken, lo, hi, w, c === undefined ? null : c - w / 2)
      if (s === null) {
        const widest = freeGaps(taken, lo, hi).reduce((m, [g0, g1]) => Math.max(m, g1 - g0), 0)
        dropped.push({ item: item.item!, ...(item.slot ? { slot: item.slot } : {}), need: Math.max(1, Math.ceil(w - widest)), wall })
        continue
      }
      // Поставленное рукой ближе FREE_SNAP к соседу или краю встаёт вплотную
      // (меньше шага «левее / правее» — иначе сдвиг на 5 см прилипал бы обратно).
      if (item.item && canSnap(item.item)) {
        const left = Math.max(lo, ...taken.filter(([, e]) => e <= s! + 0.01).map(([, e]) => e))
        const right = Math.min(hi, ...taken.filter(([b]) => b >= s! + w - 0.01).map(([b]) => b))
        if (s - left < FREE_SNAP) s = left
        else if (right - (s + w) < FREE_SNAP) s = right - w
      }
      taken.push([s, s + w])
      out.push({ item, s })
    }
    return out
  }

  const runs: Run[] = []
  const placed: Plan['placed'] = {}
  const addRun = (run: Omit<Run, 'modules' | 'uppers'>, wall: WallId, reversed: boolean) => {
    const modules: Module[] = placeWall(wall).map(({ item, s }) => moduleOf(item, reversed ? run.length - s - item.w : s))
    if (wall === 'A') {
      for (const end of freeCorners(shape, input.free)) {
        const w = freeCornerW(input.free, end)
        modules.push({ kind: 'corner', x: end === 'start' ? 0 : run.length - w, w, blind: DEPTH, blindAt: end })
      }
    }
    modules.sort((p, q) => p.x - q.x)
    const full: Run = { ...run, modules, uppers: [] }
    runs.push(full)
    return full
  }

  let window: Plan['window'] = null
  let room: Plan['room']
  let island: Plan['island']
  if (shape === 'straight' || shape === 'island') {
    const a = input.a
    addRun({ id: 'A', ox: 0, oz: 0, rot: 0, length: a, wall: true }, 'A', false)
    room = { w: a, d: shape === 'island' ? 400 : 270 }
    const w = Math.min(clampWindow(input.windowW ?? 110, room.d), room.d - 10 - DEPTH)
    const at = Math.max(DEPTH + w / 2, Math.min(room.d - w / 2 - 10, shape === 'island' ? 200 : 180))
    window = input.noWindow ? null : { wall: 'left', at, w }
    if (shape === 'island') {
      const [, len] = freeRange(input, 'I')
      const x = Math.round(Math.max(0, (a - len) / 2))
      island = { x, z: DEPTH + 110 + DEPTH, w: len, d: 90 }
      addRun({ id: 'I', ox: x + len, oz: island.z, rot: Math.PI, length: len, wall: false }, 'I', false)
    }
  } else {
    const a = addRun({ id: 'A', ox: 0, oz: 0, rot: 0, length: input.a, wall: true }, 'A', false)
    if (!input.noWindow) {
      // окно — над мойкой, если она у задней стены; не над высокими модулями
      const want = clampWindow(input.windowW ?? (shape === 'u' ? 110 : 100), a.length)
      const sink = a.modules.find((m) => m.kind === 'sink')
      const mid = sink ? sink.x + sink.w / 2 : shape === 'u' ? input.a / 2 : CORNER_W + 45
      const { at, w } = windowSpot(a.length, want, mid, a.modules.filter((m) => isTall(m.kind)))
      window = { wall: 'back', at, w }
    }
    addRun({ id: 'B', ox: 0, oz: input.b, rot: Math.PI / 2, length: input.b, wall: true }, 'B', true)
    if (shape === 'u') addRun({ id: 'C', ox: input.a, oz: 0, rot: -Math.PI / 2, length: input.c, wall: true }, 'C', false)
    room = shape === 'corner' ? { w: input.a, d: Math.max(input.b + 40, 270) } : { w: input.a, d: Math.max(input.b, input.c) + 40 }
  }

  // Где встала духовка: свой шкаф → колонна → под варочной; некуда — не в кухне.
  const kinds = new Set(runs.flatMap((r) => r.modules.map((m) => m.kind)))
  const inTall = !stove && !noOven && !kinds.has('oven') && kinds.has('tall')
  const underHob = !stove && !noOven && !kinds.has('oven') && !inTall && runs.some((r) => r.modules.some((m) => m.kind === 'hob' && !m.stove))
  for (const r of runs) {
    for (const m of r.modules) {
      if (m.kind === 'hob') m.oven = underHob && !m.stove
      if (m.kind === 'tall') m.oven = inTall
    }
    r.modules.forEach((m, index) => {
      if (m.kind === 'oven' || (m.kind === 'tall' && m.oven)) placed.oven = { run: r.id, index }
      if (m.kind === 'hob') {
        placed.hob = { run: r.id, index }
        if (m.oven) placed.oven = { run: r.id, index }
      }
      if (m.kind === 'tall' && input.microwave?.builtIn) placed.microwave = { run: r.id, index }
      if (m.kind === 'fridge' || m.kind === 'dishwasher' || m.kind === 'washer') placed[m.kind] = { run: r.id, index }
    })
  }

  // Верх: над варочной — вытяжка, над угловым — угловой, над холодильником — антресоль,
  // у колонн — ничего; свои верхние шкафы — там, где их повесили, в обход занятого и окна.
  const tooWide: NonNullable<Plan['tooWide']> = []
  for (const r of runs) {
    if (!r.wall) continue
    const wall = r.id as 'A' | 'B' | 'C'
    const reversed = wall === 'B'
    const toRun = (from: number, to: number): [number, number] => (reversed ? [r.length - to, r.length - from] : [from, to])
    const [u0, u1] = toRun(...freeUpperRange(input, wall))
    const win = wall === 'A' && window?.wall === 'back' ? ([window.at - window.w / 2, window.at + window.w / 2] as [number, number]) : null
    const ups: Upper[] = []
    // Окно режет верх над угловым и холодильником, как у правил (uppersFor): у углового
    // шкафом остаётся кусок со стороны угла, по другую сторону окна — обычный шкаф.
    const pushCut = (u: Upper) => {
      if (!win || u.x >= win[1] || u.x + u.w <= win[0]) return ups.push(u)
      const left = win[0] - u.x
      const right = u.x + u.w - win[1]
      const piece = (x: number, w: number, cornerSide: boolean): Upper =>
        u.kind === 'corner' ? (cornerSide ? { ...u, x, w } : { kind: 'doors', x, w }) : { kind: 'none', x, w }
      if (left > 0.01) ups.push(piece(u.x, left, u.blindAt === 'start'))
      if (right > 0.01) ups.push(piece(win[1], right, u.blindAt === 'end'))
    }
    for (const m of r.modules) {
      if (m.kind === 'corner') pushCut({ kind: 'corner', x: m.x, w: m.w, blind: UPPER_DEPTH, blindAt: m.blindAt })
      else if (m.kind === 'tall' || m.kind === 'pantry') ups.push({ kind: 'none', x: m.x, w: m.w })
      else if (m.kind === 'fridge') pushCut({ kind: input.fridgeOpen ? 'none' : 'fridge', x: m.x, w: m.w })
    }
    const taken: [number, number][] = ups.map((u) => [u.x, u.x + u.w])
    const hobM = r.modules.find((m) => m.kind === 'hob')
    if (hobM && input.hood) {
      // вытяжка — над серединой варочной, не уже самой вытяжки; соседние колонны, угол и края стены её не пускают
      const want = Math.max(hobM.w, up5(input.hood.w))
      const mid = hobM.x + hobM.w / 2
      const overlap = win ? Math.min(mid + want / 2, win[1]) - Math.max(mid - want / 2, win[0]) : 0
      const span = freeGaps(taken, Math.max(u0, mid - want / 2), Math.min(u1, mid + want / 2)).find(([g0, g1]) => g0 <= mid + 0.01 && g1 >= mid - 0.01)
      if (overlap > 0.01 || !span) {
        // Плита под окном (или над ней уже колонна): вытяжку не повесить — как у правил (C18).
        dropped.push({ item: 'hob', slot: 'hood', need: Math.max(1, Math.ceil(overlap > 0.01 ? overlap : want)), wall: r.id })
      } else {
        ups.push({ kind: 'hood', x: span[0], w: span[1] - span[0] })
        taken.push(span)
        if (span[1] - span[0] < input.hood.w - 0.01) tooWide.push({ slot: 'hood', w: input.hood.w, room: span[1] - span[0], wall: r.id })
      }
    }
    if (win) taken.push(win)
    for (const fu of input.free?.uppers?.[wall] ?? []) {
      if (!Number.isFinite(fu.c) || !Number.isFinite(fu.w)) continue
      const w = Math.max(FREE_UPPER.min, Math.min(FREE_UPPER.max, fu.w))
      const [s0, s1] = toRun(fu.c - w / 2, fu.c + w / 2)
      // свой верх режется занятым, окном и краями стены — остаются куски
      for (const [g0, g1] of freeGaps(taken, Math.max(u0, s0), Math.min(u1, s1))) {
        if (g1 - g0 < 1) continue
        ups.push({ kind: 'doors', x: g0, w: g1 - g0 })
        taken.push([g0, g1])
      }
    }
    ups.sort((p, q) => p.x - q.x)
    narrowToFiller(ups)
    r.uppers = ups
  }

  const underCounter: NonNullable<Plan['underCounter']> = []
  for (const r of runs) {
    for (const m of r.modules) {
      const holdsOven = m.kind === 'oven' || (m.oven && (m.kind === 'hob' || m.kind === 'tall'))
      if (input.oven && !noOven && holdsOven && m.w < input.oven.w - 0.01) tooWide.push({ slot: 'oven', w: input.oven.w, room: m.w, wall: r.id })
      if (m.kind === 'washer' && input.washer) underCounter.push({ slot: 'washer', h: input.washer.h, wall: r.id })
      if (m.kind === 'dishwasher' && input.dishwasher && !input.dishwasher.builtIn) underCounter.push({ slot: 'dishwasher', h: input.dishwasher.h, wall: r.id })
    }
  }

  // Выбранная техника без места на стене: не в 3D и не в сумме.
  const hasKind = (k: ModuleKind) => runs.some((r) => r.modules.some((m) => m.kind === k))
  const unplaced: SlotKind[] = []
  if (input.fridge && !hasKind('fridge')) unplaced.push('fridge')
  if (input.dishwasher && !hasKind('dishwasher')) unplaced.push('dishwasher')
  if (input.washer && !hasKind('washer')) unplaced.push('washer')
  if (!hasKind('hob')) unplaced.push('hob', 'hood')
  if (!stove && !noOven && !placed.oven) unplaced.push('oven')
  if (input.microwave?.builtIn && !hasKind('tall')) unplaced.push('microwave')
  // что не поместилось, «не на стене» не дублирует
  const lost = new Set(dropped.map((d) => d.slot))
  const notOnWall = unplaced.filter((s) => !lost.has(s))

  const plan: Plan = { shape, runs, room, window, placed, dropped, island, free: true }
  if (tooWide.length) plan.tooWide = tooWide
  if (underCounter.length) plan.underCounter = underCounter
  const hoodHangs = Boolean(input.hood) && runs.some((r) => r.uppers.some((u) => u.kind === 'hood') || (!r.wall && r.modules.some((m) => m.kind === 'hob'))) && !dropped.some((d) => d.slot === 'hood')
  if (hoodHangs) {
    const gas = input.hob?.hob === 'gas'
    plan.hoodHeight = { over: hoodNorm(gas), gas }
  }
  const stoveRun = stove && runs.find((r) => r.modules.some((m) => m.kind === 'hob' && m.stove))
  if (stove && stoveRun) plan.stove = { w: stove.w, h: stove.h, d: stove.d, wall: stoveRun.id }
  if (notOnWall.length) plan.unplaced = notOnWall
  return plan
}

/** Нехватка по каждой стене: сколько см добавить именно этой стене. Вытяжку под окном удлинением не поправить — её тут нет. */
export function needByWall(plan: Pick<Plan, 'dropped'>): Partial<Record<RunId, number>> {
  const out: Partial<Record<RunId, number>> = {}
  for (const d of plan.dropped) if (d.slot !== 'hood') out[d.wall] = Math.max(out[d.wall] ?? 0, d.need)
  return out
}

/**
 * Где встать окну шириной `want` у задней стены длиной `length`: не ближе 10 см
 * к углу и не над высокими модулями `blocks`. Сначала — полной ширины ближе
 * всего к `mid`; не влезает — у́же, в самом широком свободном месте (не уже
 * 60 см); и так нельзя — как раньше, у `mid`.
 */
function windowSpot(length: number, want: number, mid: number, blocks: Module[]): { at: number; w: number } {
  const lo = 10
  const hi = length - 10
  const free: [number, number][] = []
  let from = lo
  for (const b of [...blocks].sort((p, q) => p.x - q.x)) {
    if (b.x > from) free.push([from, Math.min(b.x, hi)])
    from = Math.max(from, b.x + b.w)
  }
  if (from < hi) free.push([from, hi])
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
  let best: { at: number; w: number; d: number } | null = null
  for (const [s, e] of free) {
    if (e - s < want - 0.01) continue
    const at = clamp(mid, s + want / 2, e - want / 2)
    if (!best || Math.abs(at - mid) < best.d) best = { at, w: want, d: Math.abs(at - mid) }
  }
  if (best) return { at: best.at, w: best.w }
  const widest = free.reduce<[number, number] | null>((b, f) => (!b || f[1] - f[0] > b[1] - b[0] ? f : b), null)
  if (widest && widest[1] - widest[0] >= WINDOW_LIMITS.min) {
    const w = Math.floor(widest[1] - widest[0])
    return { at: clamp(mid, widest[0] + w / 2, widest[1] - w / 2), w }
  }
  return { at: clamp(mid, lo + want / 2, hi - want / 2), w: want }
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

/**
 * Кто стоит вплотную к предмету по правилам (мойка — посудомойка, плита —
 * духовка, холодильник — пенал): их двигают вместе с ним. Свои шкафы
 * покупателя сюда не входят — каждый двигается сам по себе.
 */
export function companions(plan: Plan, key: ItemKey): ItemKey[] {
  // в пустой комнате каждый предмет двигается сам по себе
  if (plan.free) return []
  for (const run of plan.runs) {
    const i = run.modules.findIndex((m) => m.item === key)
    if (i < 0) continue
    const out: ItemKey[] = []
    for (const step of [-1, 1]) {
      let prev: ItemKey = key
      for (let j = i + step; j >= 0 && j < run.modules.length; j += step) {
        const k = run.modules[j].item
        if (!k || isCabinet(k) || isCabinet(prev) || !glued(prev, k)) break
        out.push(k)
        prev = k
      }
    }
    return out
  }
  return []
}

/**
 * Свободная столешница по обе стороны предмета — обычные шкафы до ближайшего
 * предмета или угла. Середина и ширина, см от угла: пока предмет тащат, эти
 * числа видны прямо в 3D.
 */
export function itemGaps(plan: Plan, key: ItemKey): { center: number; w: number }[] {
  for (const run of plan.runs) {
    const i = run.modules.findIndex((m) => m.item === key)
    if (i < 0) continue
    if (plan.free) {
      // пустая комната: пустое место до соседа или до края, где ставить можно
      const m = run.modules[i]
      const [lo, hi] = freeRunRange(run)
      const left = Math.max(lo, ...run.modules.filter((o) => o !== m && o.x + o.w <= m.x + 0.01).map((o) => o.x + o.w))
      const right = Math.min(hi, ...run.modules.filter((o) => o !== m && o.x >= m.x + m.w - 0.01).map((o) => o.x))
      return [
        [left, m.x],
        [m.x + m.w, right],
      ]
        .filter(([a, b]) => b - a >= 1)
        .map(([a, b]) => ({ center: moduleCenter(run, { x: a, w: b - a }), w: Math.round((b - a) * 10) / 10 }))
    }
    const free = (m: Module) => !m.item && m.kind !== 'corner'
    const span = (from: number, step: 1 | -1) => {
      let x0 = Infinity
      let x1 = -Infinity
      for (let j = from; j >= 0 && j < run.modules.length && free(run.modules[j]); j += step) {
        x0 = Math.min(x0, run.modules[j].x)
        x1 = Math.max(x1, run.modules[j].x + run.modules[j].w)
      }
      return x1 - x0 >= 1 ? { center: moduleCenter(run, { x: x0, w: x1 - x0 }), w: Math.round((x1 - x0) * 10) / 10 } : null
    }
    return [span(i - 1, -1), span(i + 1, 1)].filter((g): g is { center: number; w: number } => g !== null)
  }
  return []
}

/**
 * Пустая комната: концы ряда B или C, где в углу стоит шкаф стены A (у B угол —
 * в конце ряда, у C — в начале). У обычной кухни — undefined: там угол — пустой конец ряда.
 */
export function neighbourCorners(plan: Pick<Plan, 'free' | 'runs'>, run: Pick<Run, 'id'>): ('start' | 'end')[] | undefined {
  if (!plan.free) return undefined
  const a = plan.runs.find((r) => r.id === 'A')
  if (!a || (run.id !== 'B' && run.id !== 'C')) return []
  const [x0, x1] = run.id === 'B' ? [0, DEPTH] : [a.length - DEPTH, a.length]
  const covered = a.modules.some((m) => m.x < x1 - 0.5 && m.x + m.w > x0 + 0.5)
  return covered ? [run.id === 'B' ? 'end' : 'start'] : []
}

/** Где в ряду пустой комнаты можно ставить низ — в координатах ряда (у B ряд перевёрнут). */
export function freeRunRange(run: Pick<Run, 'id' | 'length'>): [number, number] {
  if (run.id === 'B') return [0, run.length - DEPTH]
  if (run.id === 'C') return [DEPTH, run.length]
  return [0, run.length]
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

/** Своя высота пенала: не ниже этого, см (колонне с духовкой нужно больше — `tallMin` в dims.ts). */
export const COLUMN_HEIGHT = { min: 120 }

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
export function minA(shape: Shape, widths?: Partial<Record<SizedItem, number>>): number {
  const sink = widths?.sink === undefined ? SINK_W : sizedWidth('sink', widths.sink)
  const hob = widths?.hob === undefined ? HOB_W : sizedWidth('hob', widths.hob)
  if (shape === 'u') return 2 * CORNER_W + sink + 20
  if (shape === 'corner') return CORNER_W + sink + 40
  // прямая и остров: мойка и плита на одной стене
  return Math.max(LIMITS.a.min, up5(sink + hob))
}
