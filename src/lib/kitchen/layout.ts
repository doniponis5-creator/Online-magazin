import {
  isCabinet,
  isGap,
  isUpperCab,
  ITEM_KEYS,
  SIZED_ITEMS,
  type Arrangement,
  type BaseFront,
  type Cabinet,
  type CabinetId,
  type FixedItem,
  type Gap,
  type GapId,
  type HoodKind,
  type ItemKey,
  type KitchenAppliance,
  type KitchenState,
  type Shape,
  type SizedItem,
  type SlotKind,
  type UpperCab,
  type UpperId,
  type WallId,
} from './types'
import { baseKey } from './fronts'
import { CARCASS_D, counterTop, FRONT_T, hoodBelow, hoodNorm, isTall, UPPER_BOTTOM, UPPER_CARCASS_D, up5 } from './dims'

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
/** Уже этого (см) — планка-добор: в раскладке не шкаф, в 3D и на плане не берётся пальцем. */
export const NARROW_W = 15
/** С этой ширины кусок столешницы — шкаф (дверцы/ящики); уже — бутылочница (`splitFill`). Остаток уступившего соседа — по тому же правилу (P3). */
export const CAB_MIN = 30

/** Ширина, которую покупатель может задать сам, см. */
export const WIDTH_LIMITS: Record<SizedItem | 'cabinet', { min: number; max: number }> = {
  sink: { min: 40, max: 120 },
  hob: { min: HOB_W, max: 120 },
  pantry: { min: 30, max: 90 },
  pantry2: { min: 30, max: 90 },
  // колонна с духовкой: сама духовка 60 см, шире — по бокам панели
  tall: { min: TALL_W, max: 90 },
  cabinet: { min: NARROW_W, max: 120 },
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
 * Модуль, как его выдаёт раскладчик: шкаф, техника — или пустое место
 * (`kind: 'gap'`). В `Run.modules` пустые места не попадают (там их никто не
 * ждёт: 3D, чертёж, спецификация), они уходят в `Run.gaps`.
 */
export type LaidModule = Omit<Module, 'kind'> & { kind: ModuleKind | 'gap'; up?: UpperKind }

/**
 * Пустое место в ряду: начало и ширина в координатах ряда (как у модулей),
 * ключ `gN` и ряд — нижний или верхний. В спецификации, чертеже, раскрое и
 * PDF его нет; 3D рисует только контур, план — пунктир с «+».
 */
export type RunGap = { x: number; w: number; item: GapId; row: 'base' | 'upper' }

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
  /** шкаф ручного верхнего ряда (u1, u2…): его можно двигать */
  item?: UpperId
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
  /** пустые места нижнего и верхнего ряда (нет — старый план без них) */
  gaps?: RunGap[]
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
  island?: { x: number; z: number; w: number; d: number }
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
  /** пустые места (ключи стоят в arrangement или в manualUppers) */
  gaps?: Partial<Record<GapId, Gap>>
  /** ручной верхний ряд по стенам: ключи uN и gN; стены нет — верх из низа */
  manualUppers?: Partial<Record<WallId, ItemKey[]>>
  /** верхние шкафы ручного ряда */
  upperCabs?: Partial<Record<UpperId, UpperCab>>
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
}

type Item =
  | {
      kind: ModuleKind | 'gap'
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
      /** элемент верхнего ряда (ручной верх раскладывается тем же раскладчиком) */
      up?: UpperKind
    }
  | { fill: number; min: number; prefer: 'doors' | 'drawers'; role: 'work' | 'side' }

type Solid = Extract<Item, { kind: ModuleKind | 'gap' }>

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
  if (w < NARROW_W) return [{ kind: 'filler', w }]
  if (w < CAB_MIN) return [{ kind: 'bottle', w }]
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
export function resolveRun(length: number, start: number, items: Item[], canSnap: (key?: ItemKey) => boolean = () => true): LaidModule[] | null {
  const fixed = items.reduce((s, i) => s + sizeOf(i), 0)
  if (fixed > length - start + 0.01) return null
  const out: LaidModule[] = []
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

function moduleOf(item: Solid, x: number): LaidModule {
  return { kind: item.kind, x, w: item.w, blind: item.blind, blindAt: item.blindAt, oven: item.oven, item: item.item, front: item.front, ...(item.stove ? { stove: true } : {}), ...(item.up ? { up: item.up } : {}) }
}

/**
 * Кусок ряда от `from` до `to`: предметы — своей ширины, остаток делят шкафы
 * по весам. Заполнитель с весом 0 (щель перед предметом на своём месте)
 * получает место, только если больше некому.
 */
function fillSegment(from: number, to: number, items: Item[]): LaidModule[] {
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
  const out: LaidModule[] = []
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

function place(length: number, start: number, seq: Sequence, dropped: Dropped[], how: Placing): { modules: LaidModule[]; items: Item[] } {
  let items = seq.items
  const order: FixedItem[] = ['pantry2', 'pantry', 'washer', 'dishwasher', 'oven', 'tall', 'fridge']
  const room = length - start
  /** measured — по какому списку считать нехватку (для мойки и плиты — по суженному) */
  const drop = (victim: ItemKey, measured: Item[] = items) => {
    const fixed = measured.reduce((s, i) => s + sizeOf(i), 0)
    const victimItem = items.find((i) => !isFill(i) && i.item === victim) as Solid
    // пустое место тоже записывается: иначе оно выпадало молча, и постановка «съедала» его без предупреждения (ревью 15)
    dropped.push({ item: victim, slot: victimItem.slot, need: Math.max(1, Math.ceil(fixed - room)), wall: how.wall })
    items = mergeFills(items.filter((i) => i !== victimItem))
  }
  for (;;) {
    const modules = resolveRun(length, start, items, how.canSnap)
    if (modules) return { modules, items }
    // первыми уступают пустые места (с конца), потом свои шкафы покупателя (с конца), потом техника по списку
    const gaps = items.filter((i) => !isFill(i) && i.item && isGap(i.item))
    const cabs = items.filter((i) => !isFill(i) && i.item && isCabinet(i.item))
    const lastCab = (gaps[gaps.length - 1] ?? cabs[cabs.length - 1]) as Solid | undefined
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

function indexOfSlot(run: Run, items: Item[], modules: LaidModule[]) {
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
  const ups = modules.map((m) => upperFor(m, opts))
  return windowSpan ? cutWindow(ups, windowSpan, autoPiece) : ups
}

/**
 * Кусок у окна в авто-ряду: шкаф остаётся шкафом (угловой — только со стороны
 * угла, иначе дверцы); над плитой навесного шкафа не бывает, над высоким — пусто.
 */
const autoPiece: WindowPiece = (u, x, w, side) => {
  if (u.kind === 'doors' || u.kind === 'shelf') return { kind: u.kind, x, w }
  if (u.kind === 'corner') return u.blindAt === side ? { ...u, x, w } : { kind: 'doors', x, w }
  return { kind: 'none', x, w }
}

/** Кусок у окна в ручном ряду: вид тот же (вытяжка → пусто), ключ `uN` — у большего куска. */
const manualPiece: WindowPiece = (u, x, w, _side, larger) => ({ kind: u.kind === 'hood' ? 'none' : u.kind, x, w, ...(larger && u.item ? { item: u.item } : {}) })

/** Шкафы, которые можно сузить ради вытяжки. */
const SHRINKABLE: UpperKind[] = ['doors', 'shelf', 'filler']

/** Пустое место: любой ширины от 1 см, целыми сантиметрами. */
export const gapWidth = (w: number) => Math.max(1, Math.min(600, Math.round(Number(w)) || 1))

/** Раскладчик выдал ряд — шкафы и техника идут в `modules`, пустые места в `gaps`. */
function splitLaid(laid: LaidModule[], row: 'base' | 'upper'): { modules: Module[]; gaps: RunGap[] } {
  const modules: Module[] = []
  const gaps: RunGap[] = []
  for (const m of laid) {
    if (m.kind === 'gap') {
      if (m.item && isGap(m.item)) gaps.push({ x: m.x, w: m.w, item: m.item, row })
      continue
    }
    const { up: _up, ...rest } = m
    modules.push(rest as Module)
  }
  return { modules, gaps }
}

/** Верх, который стоит на месте и в ручном ряду: над углом, над холодильником, вытяжка, пусто над пеналами и под окном. */
const FIXED_UPPER: UpperKind[] = ['corner', 'fridge', 'hood', 'none']

type UpperRowInput = { keys: ItemKey[]; cabs: Partial<Record<UpperId, UpperCab>>; gaps: Partial<Record<GapId, Gap>>; at: Partial<Record<ItemKey, number>> }

/**
 * Ручной верхний ряд: фиксированное берётся из автоматического ряда (оно
 * выводится из низа), свои шкафы uN и пустые gN встают по своим `at`, остаток
 * заполняется шкафами тем же раскладчиком, что и низ. Не влезает — уступают
 * свои шкафы с конца.
 */
function manualUppersFor(
  run: Pick<Run, 'id' | 'length'>,
  auto: Upper[],
  row: UpperRowInput,
  hoodW: number | null,
  canSnap: (key?: ItemKey) => boolean,
  windowSpan?: { from: number; to: number },
): { uppers: Upper[]; gaps: RunGap[] } {
  const L = run.length
  const fixed: Solid[] = []
  for (const u of auto) {
    if (!FIXED_UPPER.includes(u.kind)) continue
    let { x, w } = u
    // место вытяжки не уже её: от середины плиты, в пределах ряда
    if (u.kind === 'hood' && hoodW && hoodW > w) {
      const mid = x + w / 2
      w = Math.min(hoodW, L)
      x = Math.min(L - w, Math.max(0, mid - w / 2))
    }
    fixed.push({ kind: 'filler', w, at: x, up: u.kind, blind: u.blind, blindAt: u.blindAt })
  }
  let movable: Solid[] = []
  for (const k of row.keys) {
    const cab = isUpperCab(k) ? row.cabs[k] : undefined
    const w = isGap(k) ? row.gaps[k]?.w : cab?.w
    if (w === undefined) continue
    const c = row.at[k]
    // середина в см от угла → начало в координатах ряда (у B ряд идёт от зрителя к углу)
    const at = c === undefined ? undefined : run.id === 'B' ? L - c - w / 2 : c - w / 2
    // ширина шкафа — как задана (адрес хранит мм): округление до см сдвигало ряд на 0,5 после detachUppers (концерн 22)
    movable.push({ kind: isGap(k) ? 'gap' : 'filler', w: isGap(k) ? gapWidth(w) : Math.max(1, Math.min(600, w)), item: k, at, up: cab?.kind })
  }
  // прилипает только то, что поставили рукой: фиксированное стоит, где стоит
  const snapOwn = (key?: ItemKey) => key !== undefined && canSnap(key)
  const lay = (): LaidModule[] | null => {
    const items = [...fixed, ...movable].sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity))
    let cursor = 0
    for (const it of items) {
      if (it.at === undefined) it.at = cursor
      cursor = it.at + it.w
    }
    const seq: Item[] = [{ fill: 1, min: 0, prefer: 'doors', role: 'side' }]
    for (const it of items) seq.push(it, { fill: 1, min: 0, prefer: 'doors', role: 'side' })
    return resolveRun(L, 0, seq, snapOwn)
  }
  let laid = lay()
  while (!laid && movable.length) {
    movable = movable.slice(0, -1)
    laid = lay()
  }
  if (!laid) return { uppers: windowSpan ? cutWindow(auto, windowSpan, manualPiece) : auto, gaps: [] }
  const uppers: Upper[] = []
  const gaps: RunGap[] = []
  for (const m of laid) {
    if (m.kind === 'gap') {
      if (m.item && isGap(m.item)) gaps.push({ x: m.x, w: m.w, item: m.item, row: 'upper' })
      continue
    }
    if (m.up) {
      uppers.push({ kind: m.up, x: m.x, w: m.w, ...(m.blind !== undefined ? { blind: m.blind, blindAt: m.blindAt } : {}), ...(m.item && isUpperCab(m.item) ? { item: m.item } : {}) })
      continue
    }
    // автозаполнение остатка: шкаф с дверцами, уже UPPER_MIN — добор
    uppers.push({ kind: m.w < UPPER_MIN - 0.001 ? 'filler' : 'doors', x: m.x, w: m.w })
  }
  return { uppers: windowSpan ? cutWindow(uppers, windowSpan, manualPiece) : uppers, gaps }
}

/** Кусок шкафа по краю окна: шкаф, его x и ширина, с какой стороны ряда кусок, больше ли он другого куска. */
type WindowPiece = (u: Upper, x: number, w: number, side: 'start' | 'end', larger: boolean) => Upper

/**
 * Окно вырезается из ряда — одно правило для авто-ряда и ручного: под окном
 * пусто, шкаф, задевший окно краем, становится уже, а не пропадает; каким
 * остаётся кусок — решает `piece` (`autoPiece` / `manualPiece`).
 */
function cutWindow(ups: Upper[], span: { from: number; to: number }, piece: WindowPiece): Upper[] {
  const out: Upper[] = []
  for (const u of ups) {
    if (u.x >= span.to - 0.01 || u.x + u.w <= span.from + 0.01) {
      out.push(u)
      continue
    }
    const left = span.from - u.x
    const right = u.x + u.w - span.to
    if (left > 0.01) out.push(piece(u, u.x, left, 'start', left >= right))
    out.push({ kind: 'none', x: Math.max(u.x, span.from), w: Math.min(u.x + u.w, span.to) - Math.max(u.x, span.from) })
    if (right > 0.01) out.push(piece(u, span.to, right, 'end', right > left))
  }
  return out
}

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
/** Верхних шкафов у острова нет — uN туда не ставят. */
export const allowedOn = (wall: WallId, key: ItemKey) => wall !== 'I' || (!TALL_KEYS.includes(key) && !isUpperCab(key))

/**
 * Порядок предметов для формы кухни. Свой порядок покупателя берётся как
 * есть; чего в нём нет или что стоит на несуществующей стене — встаёт туда,
 * где стоит по правилам. Свои шкафы — только те, что есть в `cabinets`.
 */
export function resolveArrangement(shape: Shape, custom?: Arrangement, cabinets?: Partial<Record<CabinetId, Cabinet>>, gaps?: Partial<Record<GapId, Gap>>): Record<WallId, ItemKey[]> {
  const walls = wallsOf(shape)
  const base = DEFAULT_ORDER[shape]
  const out: Record<WallId, ItemKey[]> = { A: [], B: [], C: [], I: [] }
  const used = new Set<ItemKey>()
  const known = (k: ItemKey) => (isCabinet(k) ? Boolean(cabinets?.[k]) : isGap(k) ? Boolean(gaps?.[k]) : isUpperCab(k) ? false : ITEM_KEYS.includes(k as FixedItem))
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
 * шкафами. У плиты с обеих сторон не меньше `HOB_SIDE` см столешницы.
 */
function wallItems(
  keys: ItemKey[],
  make: (k: ItemKey) => Item | null,
  corner: { start: boolean; end: boolean },
  prefer: 'doors' | 'drawers' = 'doors',
): Item[] {
  const out: Item[] = []
  // свой шкаф не уже HOB_SIDE — сам столешница у варочной: запас между ними не нужен (P3, обмен у варочной)
  const top = new Set<ItemKey>()
  const gap = (left: Neighbour, right: Neighbour, placed = false) => {
    // Перед предметом на своём месте щель нужна всегда — иначе его не
    // отодвинуть от соседа. Вес 0: она растёт, только если больше некому.
    const forced = () => placed && out.push({ fill: 0, min: 0, prefer, role: 'work' })
    // высокие шкафы и свои шкафы покупателя встают прямо к стене, без доборов
    const atEnd = (a: Neighbour, b: Neighbour) => a === null && b !== null && b !== 'corner' && (TALL_ITEMS.includes(b) || isCabinet(b) || isGap(b))
    if (atEnd(left, right) || atEnd(right, left)) return forced()
    if (left && right && left !== 'corner' && right !== 'corner' && glued(left, right)) return forced()
    const onTop = (k: Neighbour) => k !== null && k !== 'corner' && top.has(k)
    const nearHob = (left === 'hob' && !onTop(right)) || (right === 'hob' && !onTop(left))
    if ((left === 'hob' || right === 'hob') && !nearHob) return forced()
    const end = left === null || right === null
    const nearCorner = left === 'corner' || right === 'corner'
    out.push({
      fill: end ? 0.35 : nearCorner ? 0.5 : 1,
      min: nearHob ? HOB_SIDE : 0,
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
    if (isCabinet(k) && !isFill(item) && item.w >= HOB_SIDE) top.add(k)
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

export function planKitchen(input: PlanInput, options: { shelves: boolean }): Plan {
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

  const kindOf = (k: ItemKey): Solid | null => {
    if (isGap(k)) {
      const g = input.gaps?.[k]
      return g ? { kind: 'gap', w: gapWidth(g.w), item: k } : null
    }
    if (isUpperCab(k)) return null
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
  const order = resolveArrangement(shape, input.arrangement, input.cabinets, input.gaps)

  const runs: Run[] = []
  const placed: Plan['placed'] = {}
  let window: Plan['window']
  let room: Plan['room']
  let island: Plan['island']

  /** Верх стены: из низа, как раньше, или ручной ряд из uN/gN (окно и вытяжка — фиксированные). */
  const rowUppers = (id: RunId, length: number, modules: Module[], windowSpan?: { from: number; to: number }): { uppers: Upper[]; gaps: RunGap[] } => {
    const auto = uppersFor(modules, upperOpts, windowSpan)
    const manual = input.manualUppers?.[id]
    if (!manual) return { uppers: auto, gaps: [] }
    const row: UpperRowInput = { keys: manual, cabs: input.upperCabs ?? {}, gaps: input.gaps ?? {}, at: input.at ?? {} }
    return manualUppersFor({ id, length }, auto, row, input.hood ? up5(input.hood.w) : null, canSnap, windowSpan)
  }
  const withGaps = (run: Run, gaps: RunGap[]): Run => (gaps.length ? { ...run, gaps } : run)
  const pushRun = (run: Omit<Run, 'modules' | 'uppers'>, start: number, items: Item[], reversed = false) => {
    const { modules: placedAll, items: kept } = place(run.length, start, { items }, dropped, how(run.id))
    const laid = reversed ? placedAll.map((m) => ({ ...m, x: run.length - m.x - m.w, blindAt: flip(m.blindAt) })).reverse() : placedAll
    const { modules, gaps } = splitLaid(laid, 'base')
    const up = rowUppers(run.id, run.length, modules)
    // ручной ряд уже хранит шкаф у угла с его доходом до задней стены (снят с автоматического ряда)
    if (start === DEPTH && !input.manualUppers?.[run.id]) reachCorner(up.uppers, reversed ? run.length - DEPTH : DEPTH, reversed)
    const full = withGaps({ ...run, modules, uppers: up.uppers }, [...gaps, ...up.gaps])
    runs.push(full)
    Object.assign(placed, indexOfSlot(full, kept, modules))
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
    const up = rowUppers(a.id, a.length, a.modules, { from: at - w / 2, to: at + w / 2 })
    a.uppers = up.uppers
    const gaps = [...(a.gaps ?? []).filter((g) => g.row === 'base'), ...up.gaps]
    if (gaps.length) a.gaps = gaps
    else delete a.gaps
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
      const laidI = place(w, 0, { items: wallItems(order.I, make, { start: false, end: false }, 'drawers') }, dropped, how('I'))
      const kept = laidI.items
      const { modules, gaps } = splitLaid(laidI.modules, 'base')
      const run = withGaps({ id: 'I', ox: x + w, oz: island.z, rot: Math.PI, length: w, modules, uppers: [], wall: false }, gaps)
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

/** Нехватка по каждой стене: сколько см добавить именно этой стене. Вытяжку под окном удлинением не поправить — её тут нет. */
export function needByWall(plan: Pick<Plan, 'dropped'>): Partial<Record<RunId, number>> {
  const out: Partial<Record<RunId, number>> = {}
  // вытяжку стеной не вылечить, пустое место ужимаемо — «удлините стену» не про них
  for (const d of plan.dropped) if (d.slot !== 'hood' && !isGap(d.item)) out[d.wall] = Math.max(out[d.wall] ?? 0, d.need)
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

/** row — верхний ряд (uN и пустые места верха); нет — нижний. */
export type ItemPlace = { wall: WallId; center: number; w: number; row?: 'upper' }

/** Где сейчас стоит каждый предмет: стена и середина вдоль неё (см, от угла). Пустые места и верхние шкафы ручного ряда — тоже. */
export function itemPositions(plan: Plan): Partial<Record<ItemKey, ItemPlace>> {
  const out: Partial<Record<ItemKey, ItemPlace>> = {}
  for (const run of plan.runs) {
    for (const m of run.modules) {
      const key = m.item
      if (!key) continue
      const mid = m.x + m.w / 2
      out[key] = { wall: run.id, center: runCm(run, mid), w: m.w }
    }
    for (const u of run.uppers) if (u.item) out[u.item] = { wall: run.id, center: moduleCenter(run, u), w: u.w, row: 'upper' }
    for (const g of run.gaps ?? []) out[g.item] = { wall: run.id, center: moduleCenter(run, g), w: g.w, ...(g.row === 'upper' ? { row: 'upper' } : {}) }
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

/** Где на стене стоит модуль (центр, см от угла) — как у itemPositions. */
export function moduleCenter(run: Pick<Run, 'id' | 'length'>, m: Pick<Module, 'x' | 'w'>): number {
  return runCm(run, m.x + m.w / 2)
}

/** Точка ряда → мир (см). Одна формула для плана, чертежа, проверок и движка (метры = см/100). */
export function runWorld(run: Pick<Run, 'ox' | 'oz' | 'rot'>, x: number, z: number): { x: number; z: number } {
  const cos = Math.cos(run.rot)
  const sin = Math.sin(run.rot)
  return { x: run.ox + x * cos + z * sin, z: run.oz - x * sin + z * cos }
}

/** Мир → точка ряда (см): x — вдоль стены от начала ряда, z — от стены к лицу. */
export function runLocal(run: Pick<Run, 'ox' | 'oz' | 'rot'>, wx: number, wz: number): { x: number; z: number } {
  const cos = Math.cos(run.rot)
  const sin = Math.sin(run.rot)
  const dx = wx - run.ox
  const dz = wz - run.oz
  return { x: dx * cos - dz * sin, z: dx * sin + dz * cos }
}

/**
 * Одна формула «см от угла» для модели, движка и плана: ряд B идёт от дальнего
 * конца к углу, поэтому его позиция вдоль ряда `x` — это `length − x` от угла.
 * `runX` — обратно: см от угла → позиция вдоль ряда.
 */
export function runCm(run: { id: string; length: number }, x: number): number {
  return run.id === 'B' ? run.length - x : x
}
export function runX(run: { id: string; length: number }, cm: number): number {
  return run.id === 'B' ? run.length - cm : cm
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

/* ───────────── постановка: placeAt, addAt, detachUppers, narrowFor, resizeWalls ───────────── */

export type SnapKind = 'wall' | 'neighbour' | 'opposite' | null
/** Кого сузить и на сколько см, чтобы модуль встал. */
export type Narrow = { neighbour: ItemKey; by: number }
/**
 * Вердикт постановки: встал (`ok`) — середина после снапа и упора в соседей;
 * не встал — сколько см не хватило и кого можно сузить. `free` — свободный
 * кусок стены между соседями, `neighbours` — кто эти соседи (null — край
 * стены, угол или фиксированный верх).
 */
export type Fit = {
  ok: boolean
  center: number
  w: number
  wall: WallId
  row: 'base' | 'upper'
  snap: SnapKind
  need: number
  narrow: Narrow | null
  free: { from: number; to: number }
  neighbours: { left: ItemKey | null; right: ItemKey | null }
  /** мягкие соседи (закреплённые автошкафы), которые уступят место постановке — ужмутся или уйдут (P1) */
  yields?: ItemKey[]
  /** встал обменом местами с этим соседом (P3): тянули на соседа по той же стене, а места не было; null — с автошкафом */
  swap?: ItemKey | null
}
export type FitOptions = {
  /** ширина, если предмета ещё нет в плане (новый шкаф, пенал) */
  w?: number
  row?: 'base' | 'upper'
  /** в плане сверху — ещё прилипать к краям противоположного ряда (A ↔ остров, B ↔ C) */
  opposite?: boolean
  /**
   * Мягкие соседи (P1): автошкафы, закреплённые на время жеста (`pinWalls` → `pinnedIds`).
   * Модуль помещается — они не меняются (магнит к их краю тоже); не помещается под пальцем —
   * уступают ровно на нехватку (`Fit.yields`). Свои шкафы покупателя сюда не входят — им «Сузить».
   */
  soft?: ItemKey[]
}

const rowOf = (key: ItemKey, cur?: ItemPlace): 'base' | 'upper' => (isUpperCab(key) || cur?.row === 'upper' ? 'upper' : 'base')
/** У плиты с обеих сторон не меньше этого столешницы (см) — так ставит wallItems; постановка это учитывает. */
export const HOB_SIDE = 30

/** До какой ширины можно сузить предмет; техника и корпусная мебель с фиксированной шириной — нельзя (null). */
export function minWidthOf(key: ItemKey): number | null {
  if (isCabinet(key)) return WIDTH_LIMITS.cabinet.min
  if (isUpperCab(key)) return UPPER_MIN
  if (isGap(key)) return 1
  return (SIZED_ITEMS as string[]).includes(key) ? WIDTH_LIMITS[key as SizedItem].min : null
}

/** Кого из соседей сузить: сначала пустое место, потом свой шкаф, верхний, потом мойка/плита/пенал. */
function narrowAmong(keys: (ItemKey | null)[], need: number, pos: Partial<Record<ItemKey, ItemPlace>>): Narrow | null {
  const rank = (k: ItemKey) => (isGap(k) ? 0 : isCabinet(k) ? 1 : isUpperCab(k) ? 2 : 3)
  const list = keys.filter((k): k is ItemKey => k !== null).sort((a, b) => rank(a) - rank(b))
  for (const k of list) {
    const min = minWidthOf(k)
    const p = pos[k]
    if (min !== null && p && p.w - min >= need - 0.01) return { neighbour: k, by: need }
  }
  return null
}

/** Края предметов противоположного ряда в координатах стены `wall`: A ↔ остров (смотрят друг на друга), B ↔ C (одна координата от угла). */
function oppositeEdges(plan: Plan, wall: WallId): number[] {
  const other: WallId = wall === 'A' ? 'I' : wall === 'I' ? 'A' : wall === 'B' ? 'C' : 'B'
  const run = plan.runs.find((r) => r.id === other)
  if (!run) return []
  const shift = plan.island ? plan.island.x + plan.island.w : 0
  const map = (c: number) => (wall === 'A' || wall === 'I' ? shift - c : c)
  const out: number[] = []
  for (const m of run.modules) {
    if (!m.item && m.kind !== 'corner') continue
    const c = moduleCenter(run, m)
    out.push(map(c - m.w / 2), map(c + m.w / 2))
  }
  return out
}

/**
 * Куда встанет модуль `key` шириной его самого (или `opts.w`), если его
 * середину поставить в `center` см от угла стены `wall`. Соседи — предметы со
 * своим ключом, угловой шкаф, у боковых стен — первые DEPTH см (ряд задней
 * стены), в верхнем ряду — вытяжка, угловой, шкаф над холодильником, пусто
 * над пеналами и под окном. Автоматические шкафы — не соседи: они подстроятся.
 * Снап `SNAP` см к краям стены и соседей. Возвращает null, если ширины нет
 * (предмета нет в плане и `opts.w` не дали) или такой стены нет.
 */
export function fitOn(plan: Plan, key: ItemKey, wall: WallId, center: number, opts: FitOptions = {}): Fit | null {
  const hard = fitCore(plan, key, wall, center, opts, [])
  const soft = opts.soft?.filter((k) => k !== key) ?? []
  if (!hard || !soft.length) return hard
  // встал сам или прилип к краю мягкого соседа (≤ SNAP от пальца) — соседи прежние
  if (hard.ok && Math.abs(hard.center - center) <= SNAP + 0.01) return hard
  const loose = fitCore(plan, key, wall, center, opts, soft)
  if (!loose?.ok) return hard
  if (hard.ok && Math.abs(hard.center - loose.center) < 0.01) return hard
  const run = plan.runs.find((r) => r.id === wall)!
  const pad = loose.row === 'base' && key === 'hob' ? HOB_SIDE : 0
  // уступают — левый край на целом сантиметре: остатки соседей и пустые места целые (пустое место хранится в целых см)
  const half = loose.w / 2 + pad
  const left = Math.round(loose.center - loose.w / 2)
  const c = [left, left + 1, left - 1].map((x) => x + loose.w / 2).find((x) => x - half >= loose.free.from - 0.01 && x + half <= loose.free.to + 0.01) ?? loose.center
  if (c !== loose.center) loose.center = c
  const s = loose.center - loose.w / 2 - pad
  const e = loose.center + loose.w / 2 + pad
  const mods = loose.row === 'base' ? run.modules : run.uppers
  const yields = mods.filter((m) => m.item && soft.includes(m.item) && Math.min(e, m.x + m.w) - Math.max(s, m.x) > 0.01).map((m) => m.item as ItemKey)
  return yields.length ? { ...loose, yields } : loose
}

/** Свой шкаф не уже HOB_SIDE — сам столешница у варочной (как `top` в wallItems). */
const selfTop = (k: ItemKey, w: number) => isCabinet(k) && w >= HOB_SIDE

/** `fitOn` без мягких соседей: `ignore` — ключи, которых для постановки нет (уступят). */
function fitCore(plan: Plan, key: ItemKey, wall: WallId, center: number, opts: FitOptions, ignore: ItemKey[]): Fit | null {
  const run = plan.runs.find((r) => r.id === wall)
  const pos = itemPositions(plan)
  const cur = pos[key]
  const w = opts.w ?? cur?.w
  if (!run || w === undefined) return null
  const L = run.length
  const row = opts.row ?? rowOf(key, cur)
  // плите нужна столешница по бокам: она сама «шире» на HOB_SIDE с каждой стороны, и к соседней плите ближе не встать
  const pad = row === 'base' && key === 'hob' ? HOB_SIDE : 0
  const half = w / 2 + pad
  const spanOf = (m: { x: number; w: number }, margin = 0) => {
    const c = moduleCenter(run, m)
    return { s: Math.max(0, c - m.w / 2 - margin), e: Math.min(L, c + m.w / 2 + margin) }
  }
  const obstacles: { s: number; e: number; key: ItemKey | null }[] = []
  if (row === 'base') {
    for (const m of run.modules) {
      if (m.kind === 'corner') obstacles.push({ ...spanOf(m), key: null })
      else if (m.item && m.item !== key && !ignore.includes(m.item)) {
        // одно правило с раскладкой (wallItems): свой шкаф ≥ HOB_SIDE сам столешница у варочной — запас между ними не нужен
        if (m.kind === 'hob') obstacles.push({ ...spanOf(m, selfTop(key, w) ? 0 : HOB_SIDE), key: m.item })
        else if (pad && selfTop(m.item, m.w)) {
          const o = spanOf(m)
          obstacles.push({ s: o.s + pad, e: o.e - pad, key: m.item })
        } else obstacles.push({ ...spanOf(m), key: m.item })
      }
    }
  } else {
    for (const u of run.uppers) {
      if (u.item && u.item !== key) obstacles.push({ ...spanOf(u), key: u.item })
      else if (!u.item && FIXED_UPPER.includes(u.kind)) obstacles.push({ ...spanOf(u), key: null })
    }
  }
  if (run.wall && run.id !== 'A') obstacles.push({ s: 0, e: row === 'base' ? DEPTH : UPPER_DEPTH, key: null })
  obstacles.sort((a, b) => a.s - b.s)
  let c = Math.min(L - half, Math.max(half, center))
  const base: Fit = { ok: false, center: c, w, wall, row, snap: null, need: 0, narrow: null, free: { from: 0, to: L }, neighbours: { left: null, right: null } }
  if (!allowedOn(wall, key) || (row === 'upper' && !run.wall)) return base
  // попали внутрь соседа — считаем от ближнего его края
  const inside = obstacles.find((o) => c > o.s + 0.01 && c < o.e - 0.01)
  const pivot = inside ? (c - inside.s < inside.e - c ? inside.s - 0.001 : inside.e + 0.001) : c
  let left = 0
  let right = L
  let leftKey: ItemKey | null = null
  let rightKey: ItemKey | null = null
  for (const o of obstacles) {
    if (o.e <= pivot + 0.01 && o.e > left) {
      left = o.e
      leftKey = o.key
    }
    if (o.s >= pivot - 0.01 && o.s < right) {
      right = o.s
      rightKey = o.key
    }
  }
  const free = { from: left, to: right }
  const neighbours = { left: leftKey, right: rightKey }
  const room = right - left
  if (room < 2 * half - 0.01) {
    const need = Math.ceil(2 * half - room - 0.001)
    return { ...base, center: Math.round(left + right) / 2, need, narrow: narrowAmong([leftKey, rightKey], need, pos), free, neighbours }
  }
  c = Math.min(right - half, Math.max(left + half, c))
  let snap: SnapKind = null
  const dl = c - half - left
  const dr = right - (c + half)
  if (dl < SNAP && dl <= dr) {
    c = left + half
    snap = left > 0.01 ? 'neighbour' : 'wall'
  } else if (dr < SNAP) {
    c = right - half
    snap = right < L - 0.01 ? 'neighbour' : 'wall'
  } else if (opts.opposite) {
    let best: { c: number; d: number } | null = null
    for (const e of oppositeEdges(plan, wall))
      for (const cand of [e + half, e - half]) {
        const d = Math.abs(cand - c)
        if (d < SNAP && cand >= left + half - 0.01 && cand <= right - half + 0.01 && (!best || d < best.d)) best = { c: cand, d }
      }
    if (best) {
      c = best.c
      snap = 'opposite'
    }
  }
  c = Math.round(c * 2) / 2
  return { ...base, ok: true, center: c, snap, free, neighbours }
}

/** Раскладка из состояния (экран знает технику и стиль): snap — кто прилипает в resolveRun; `[]` — никто. */
export type Planner = (s: KitchenState, snap?: ItemKey[]) => Plan
export type Placed = { state: KitchenState; fit: Fit | null }

type Rows = { base: Record<WallId, ItemKey[]>; upper: Partial<Record<WallId, ItemKey[]>> }
const ROW_LISTS: WallId[] = ALL_WALLS

function nextId<P extends 'g' | 'u' | 'k'>(prefix: P, used: Partial<Record<string, unknown>> | undefined): `${P}${number}` {
  let n = 1
  while (used?.[`${prefix}${n}`]) n++
  return `${prefix}${n}`
}

/** Списки ключей по стенам: низ — полный порядок, верх — только ручные стены. */
function rowsOf(state: KitchenState): Rows {
  const base = resolveArrangement(state.shape, state.arrangement, state.cabinets, state.gaps)
  const upper: Rows['upper'] = {}
  for (const w of wallsOf(state.shape)) if (state.manualUppers?.[w]) upper[w] = [...state.manualUppers[w]!]
  return { base, upper }
}
const listOf = (rows: Rows, row: 'base' | 'upper', wall: WallId): ItemKey[] => (row === 'base' ? rows.base[wall] : (rows.upper[wall] ??= []))
function removeKey(rows: Rows, key: ItemKey) {
  for (const w of ROW_LISTS) {
    rows.base[w] = rows.base[w].filter((k) => k !== key)
    if (rows.upper[w]) rows.upper[w] = rows.upper[w]!.filter((k) => k !== key)
  }
}
/** Вставить по середине: перед первым, кто стоит правее (у кого есть `at`). */
function insertByCenter(list: ItemKey[], key: ItemKey, center: number, at: Partial<Record<ItemKey, number>>) {
  let i = list.findIndex((k) => at[k] !== undefined && at[k]! > center)
  if (i < 0) i = list.length
  list.splice(i, 0, key)
}
const compact = <T extends object>(o: T | undefined): T | undefined => (o && Object.keys(o).length ? o : undefined)
function stateWith(state: KitchenState, rows: Rows, gaps: KitchenState['gaps'], at: KitchenState['at'], extra: Partial<KitchenState> = {}): KitchenState {
  const arrangement: Arrangement = {}
  for (const w of wallsOf(state.shape)) arrangement[w] = rows.base[w]
  const { gaps: _g, at: _a, manualUppers: _m, ...rest } = { ...state, ...extra }
  const upper = compact(rows.upper)
  return {
    ...rest,
    arrangement,
    ...(compact(gaps) ? { gaps } : {}),
    ...(compact(at) ? { at } : {}),
    ...(upper ? { manualUppers: upper } : {}),
  }
}

/**
 * Поставить модуль `key` серединой в `cm − grab` см от угла стены `wall`
 * (`cm` — палец, `grab` — смещение середины от точки захвата). Чистая функция:
 * новое состояние и вердикт. Встал — все остальные остаются на своих местах
 * (`at` замораживается, как делает экран), на прежнем месте остаётся пустое
 * `gN` той же ширины, пустые места под новым положением уходят или ужимаются.
 * Не встал (`fit.ok=false`) — состояние прежнее, в `fit` — сколько не хватило и
 * кого сузить. Верхний шкаф на стену с автоматическим верхом — та стена
 * сначала становится ручной. Проверяется пробной раскладкой: ничего нового
 * не должно выпасть.
 */
export function placeAt(state: KitchenState, key: ItemKey, wall: WallId, cm: number, planner: Planner, grab = 0, opts: { w?: number; soft?: ItemKey[] } = {}): Placed {
  const p0 = planner(state, [])
  const placed = placeWith(state, p0, key, wall, cm - grab, planner, opts)
  if (placed.fit?.ok || opts.w !== undefined) return placed
  return swapWith(state, p0, key, wall, cm - grab, planner) ?? placed
}

/** Обмен местами: где встанут модуль `key` и сосед `with`, если середину `key` отпустили в `center` над соседом. */
export type Swap = { with: ItemKey | null; center: number; other: number; w: number; row: 'base' | 'upper' }

/**
 * Обмен местами (P3): модуль тянут на соседа по той же стене и ряду — они
 * меняются местами, если оба помещаются на местах друг друга: ширины равны
 * (меняются середины) или стоят вплотную (общий отрезок тот же, порядок
 * обратный). Автошкаф (дверцы/ящики без ключа) — тоже сосед: модуль встаёт
 * на его место, а освободившееся заполнит раскладка. Угловой и пустое место —
 * не соседи для обмена.
 * Только геометрия; `placeAt` проверяет ещё пробной раскладкой.
 */
export function swapFit(plan: Plan, key: ItemKey, wall: WallId, center: number): Swap | null {
  const pos = itemPositions(plan)
  const cur = pos[key]
  const run = plan.runs.find((r) => r.id === wall)
  if (!cur || !run || cur.wall !== wall) return null
  const row = rowOf(key, cur)
  const mods: { x: number; w: number; item?: ItemKey; kind: string }[] = row === 'base' ? run.modules : run.uppers
  const hit = mods.find((m) => {
    if (m.item ? m.item === key || isGap(m.item) : row !== 'base' || (m.kind !== 'doors' && m.kind !== 'drawers')) return false
    const c = moduleCenter(run, m)
    return center > c - m.w / 2 + 0.01 && center < c + m.w / 2 - 0.01
  })
  if (!hit) return null
  const other = hit.item ? pos[hit.item] : { wall, center: moduleCenter(run, hit), w: hit.w }
  if (!other || other.wall !== wall || (hit.item && rowOf(hit.item, other) !== row)) return null
  const [as, ae] = [cur.center - cur.w / 2, cur.center + cur.w / 2]
  const [bs, be] = [other.center - other.w / 2, other.center + other.w / 2]
  const r2 = (v: number) => Math.round(v * 2) / 2
  const out = (a: number, b: number): Swap => ({ with: hit.item ?? null, center: r2(a), other: r2(b), w: cur.w, row })
  if (Math.abs(cur.w - other.w) < 0.5) return out(other.center, cur.center)
  if (Math.abs(ae - bs) <= 1) return out(as + other.w + cur.w / 2, as + other.w / 2)
  if (Math.abs(be - as) <= 1) return out(bs + cur.w / 2, bs + cur.w + other.w / 2)
  return null
}

/** Постановка обменом: порядок стены меняется местами, середины — как у `swapFit`; не сходится пробная раскладка — null. */
function swapWith(state: KitchenState, p0: Plan, key: ItemKey, wall: WallId, center: number, planner: Planner): Placed | null {
  const sw = swapFit(p0, key, wall, center)
  if (!sw) return null
  const rows = rowsOf(state)
  const list = listOf(rows, sw.row, wall)
  const at: NonNullable<KitchenState['at']> = { ...state.at }
  for (const [k, p] of Object.entries(itemPositions(p0)) as [ItemKey, ItemPlace][]) at[k] = p.center
  at[key] = sw.center
  if (sw.with) {
    const i = list.indexOf(key)
    const j = list.indexOf(sw.with)
    if (i < 0 || j < 0) return null
    list[i] = sw.with
    list[j] = key
    at[sw.with] = sw.other
  } else {
    // автошкаф: модуль встаёт на его место, освободившееся заполнит раскладка
    list.splice(list.indexOf(key), 1)
    insertByCenter(list, key, sw.center, at)
  }
  const next = stateWith(state, rows, state.gaps, at)
  const p1 = planner(next, [])
  const now = itemPositions(p1)
  const off = (k: ItemKey, c: number) => Math.abs((now[k]?.center ?? -1e3) - c) > 0.6
  if (p1.dropped.length > p0.dropped.length || off(key, sw.center) || (sw.with && off(sw.with, sw.other))) return null
  const fit = fitOn(p0, key, wall, center)!
  return { state: next, fit: { ...fit, ok: true, center: now[key]!.center, snap: null, need: 0, narrow: null, swap: sw.with } }
}

/** То же, но геометрия и заморозка — по готовому плану `p0` (он может быть от состояния без нового предмета: пенал, новый шкаф). */
function placeWith(state: KitchenState, p0: Plan, key: ItemKey, wall: WallId, center: number, planner: Planner, opts: { w?: number; fresh?: boolean; soft?: ItemKey[] } = {}): Placed {
  const pos = itemPositions(p0)
  const cur = pos[key]
  const fit = fitOn(p0, key, wall, center, { w: opts.w, soft: opts.soft })
  if (!fit || !fit.ok) return { state, fit }
  const row = fit.row
  let base = row === 'upper' && !state.manualUppers?.[wall] ? detachUppers(state, wall, p0) : state
  // варочная уходит со стены — шкафы её бывшей зоны столешницы закрепляются, а не перестраиваются молча (P1)
  if (key === 'hob' && row === 'base' && cur && cur.wall !== wall) base = pinWalls(base, p0, [cur.wall], { hobZone: true })
  const rows = rowsOf(base)
  const gaps: NonNullable<KitchenState['gaps']> = { ...base.gaps }
  const at: NonNullable<KitchenState['at']> = {}
  for (const [k, p] of Object.entries(pos) as [ItemKey, ItemPlace][]) if (k !== key) at[k] = p.center
  for (const [k, v] of Object.entries(base.at ?? {}) as [ItemKey, number][]) if (at[k] === undefined && k !== key) at[k] = v
  removeKey(rows, key)
  const half = fit.w / 2
  // у варочной столешница HOB_SIDE с каждой стороны — пустое место туда не заходит (иначе раскладка его выбросит)
  const pad = row === 'base' && key === 'hob' ? HOB_SIDE : 0
  const s = fit.center - half - pad
  const e = fit.center + half + pad
  const curRow = cur?.row ?? 'base'
  if (cur && !opts.fresh && !isGap(key)) {
    // освобождённое — пустое место: часть прежнего места, не занятая новым (P1: не новый автошкаф)
    const cs = cur.center - cur.w / 2
    const ce = cur.center + cur.w / 2
    const same = cur.wall === wall && curRow === row
    const pieces: [number, number][] = same ? [[cs, Math.min(ce, s)], [Math.max(cs, e), ce]] : [[cs, ce]]
    for (const [a, b] of pieces) {
      if (b - a < 1) continue
      const g = nextId('g', gaps)
      gaps[g] = { w: Math.round(b - a) }
      at[g] = (a + b) / 2
      insertByCenter(listOf(rows, curRow, cur.wall), g, (a + b) / 2, at)
    }
  }
  const run = p0.runs.find((r) => r.id === wall)!
  // мягкие соседи уступают ровно на нехватку: остаётся бо́льшая часть, если она ещё шкаф (≥ CAB_MIN);
  // остаток уже CAB_MIN — не свой шкаф, а автозаполнение (splitFill: планка или бутылочница, верх — по UPPER_MIN) (P3);
  // прочие куски не уже CAB_MIN — пустое место
  const cabinets: NonNullable<KitchenState['cabinets']> = { ...base.cabinets }
  for (const k of fit.yields ?? []) {
    const m = (row === 'base' ? run.modules : run.uppers).find((mm) => mm.item === k)
    const cab = cabinets[k as keyof typeof cabinets]
    if (!m || !cab) continue
    const c0 = moduleCenter(run, m)
    const a = c0 - m.w / 2
    const b = c0 + m.w / 2
    const pieces = ([[a, Math.min(b, s)], [Math.max(a, e), b]] as [number, number][]).filter(([x, y]) => y - x >= 1).sort((p, q) => q[1] - q[0] - (p[1] - p[0]))
    const keep = pieces[0] && pieces[0][1] - pieces[0][0] >= CAB_MIN ? pieces.shift()! : null
    if (keep) {
      cabinets[k as keyof typeof cabinets] = { ...cab, w: Math.round((keep[1] - keep[0]) * 10) / 10 }
      at[k] = (keep[0] + keep[1]) / 2
    } else {
      delete cabinets[k as keyof typeof cabinets]
      delete at[k]
      removeKey(rows, k)
    }
    for (const [x, y] of pieces) {
      if (y - x < CAB_MIN) continue
      const g = nextId('g', gaps)
      gaps[g] = { w: Math.round(y - x) }
      at[g] = (x + y) / 2
      insertByCenter(listOf(rows, row, wall), g, (x + y) / 2, at)
    }
  }
  const list = listOf(rows, row, wall)
  carveGaps(run, row, list, gaps, at, key, s, e)
  at[key] = fit.center
  insertByCenter(list, key, fit.center, at)
  const next = stateWith(fit.yields?.length ? { ...base, cabinets } : base, rows, gaps, at)
  const p1 = planner(next, [])
  const now = itemPositions(p1)[key]
  if (p1.dropped.length > p0.dropped.length || !now) {
    const fresh = p1.dropped.filter((d) => !p0.dropped.some((o) => o.item === d.item && o.wall === d.wall))
    const need = Math.max(1, ...fresh.map((d) => d.need))
    return { state, fit: { ...fit, ok: false, need, narrow: narrowAmong([fit.neighbours.left, fit.neighbours.right], need, pos) } }
  }
  return { state: next, fit: { ...fit, center: now.center } }
}

/**
 * Пустые места ряда, задетые отрезком `s…e` предмета `key`, ужимаются до
 * остатка (или уходят; планка сохраняется) — одно правило для постановки
 * (`placeWith`) и правки ширины (`squeezeGaps`). Меняет `list`, `gaps`, `at`.
 */
function carveGaps(run: Run, row: 'base' | 'upper', list: ItemKey[], gaps: NonNullable<KitchenState['gaps']>, at: NonNullable<KitchenState['at']>, key: ItemKey, s: number, e: number) {
  for (const g of run.gaps ?? []) {
    if (g.item === key || g.row !== row) continue
    const gc = moduleCenter(run, g)
    const gs = gc - g.w / 2
    const ge = gc + g.w / 2
    if (Math.min(e, ge) - Math.max(s, gs) <= 0.01) continue
    const strip = Boolean(gaps[g.item]?.strip)
    const idx = list.indexOf(g.item)
    if (idx >= 0) list.splice(idx, 1)
    delete gaps[g.item]
    delete at[g.item]
    let id: GapId = g.item
    for (const [a, b] of [[gs, Math.min(s, ge)], [Math.max(e, gs), ge]]) {
      if (b - a < 1) continue
      gaps[id] = { w: Math.round(b - a), ...(strip ? { strip: true } : {}) }
      at[id] = (a + b) / 2
      insertByCenter(list, id, (a + b) / 2, at)
      id = nextId('g', gaps)
    }
  }
}

/**
 * Ширину `key` меняют на `w` (кнопки ±): соседнее пустое место ужимается,
 * а не выпадает. Растём в сторону пустого места (край с другой стороны на
 * месте); пустые места с обеих сторон или ни с одной — от своей середины.
 * Все остальные места замораживаются по плану. Соседей-пустых мест нет — `state` как есть.
 */
export function squeezeGaps(state: KitchenState, plan: Plan, key: ItemKey, w: number): KitchenState {
  const pos = itemPositions(plan)
  const cur = pos[key]
  const run = cur && plan.runs.find((r) => r.id === cur.wall)
  if (!cur || !run) return state
  const row = cur.row ?? 'base'
  const s0 = cur.center - cur.w / 2
  const e0 = cur.center + cur.w / 2
  const gapsHere = (run.gaps ?? []).filter((g) => g.row === row && g.item !== key)
  const left = gapsHere.some((g) => Math.abs(moduleCenter(run, g) + g.w / 2 - s0) < 0.6)
  const right = gapsHere.some((g) => Math.abs(moduleCenter(run, g) - g.w / 2 - e0) < 0.6)
  if (!left && !right) return state
  const s = left && !right ? e0 - w : right && !left ? s0 : cur.center - w / 2
  const e = s + w
  const rows = rowsOf(state)
  const gaps: NonNullable<KitchenState['gaps']> = { ...state.gaps }
  const at: NonNullable<KitchenState['at']> = {}
  for (const [k, p] of Object.entries(pos) as [ItemKey, ItemPlace][]) at[k] = p.center
  for (const [k, v] of Object.entries(state.at ?? {}) as [ItemKey, number][]) if (at[k] === undefined) at[k] = v
  carveGaps(run, row, listOf(rows, row, cur.wall), gaps, at, key, s, e)
  at[key] = (s + e) / 2
  return stateWith(state, rows, gaps, at)
}

/**
 * Перед перемещением (P1): автошкафы низа (дверцы/ящики без своего ключа) на
 * стенах `walls` становятся своими `kN` той же ширины и вида на тех же
 * местах, все места замораживаются по `plan`. Картинка та же, но соседи
 * больше не перестраиваются от постановки: пересечение — снап или «не
 * помещается», освобождённое — пустое `gN`. Вариант фасада автошкафа
 * (`fronts[A120]`) переезжает в `Cabinet.front`. Бутылочница и добор остаются
 * автоматическими: вида «бутылочница» у своего шкафа нет; шкафы у варочной —
 * тоже: там столешница HOB_SIDE, свой шкаф вплотную раскладка не пустит.
 */
export function pinWalls(state: KitchenState, plan: Plan, walls: WallId[], opts: { hobZone?: boolean } = {}): KitchenState {
  const runs = plan.runs.filter((r) => walls.includes(r.id as WallId) && r.modules.some((m) => !m.item && (m.kind === 'doors' || m.kind === 'drawers')))
  if (!runs.length) return state
  const pos = itemPositions(plan)
  const rows = rowsOf(state)
  const cabinets: NonNullable<KitchenState['cabinets']> = { ...state.cabinets }
  const fronts: NonNullable<KitchenState['fronts']> = { ...state.fronts }
  const at: NonNullable<KitchenState['at']> = {}
  for (const [k, p] of Object.entries(pos) as [ItemKey, ItemPlace][]) at[k] = p.center
  for (const [k, v] of Object.entries(state.at ?? {}) as [ItemKey, number][]) if (at[k] === undefined) at[k] = v
  for (const run of runs) {
    // у варочной столешница остаётся автоматической (HOB_SIDE): свой шкаф вплотную раскладка не пустит
    const hobs = run.modules.filter((m) => m.item === 'hob').map((m) => ({ s: m.x - HOB_SIDE, e: m.x + m.w + HOB_SIDE }))
    for (const m of run.modules) {
      if (m.item || (m.kind !== 'doors' && m.kind !== 'drawers')) continue
      if (!opts.hobZone && hobs.some((h) => Math.min(h.e, m.x + m.w) - Math.max(h.s, m.x) > 0.01)) continue
      const sk = baseKey(run.id, m.x)
      const front = (fronts[sk] as BaseFront | undefined) ?? (m.kind === 'drawers' ? 'drawers3' : 'doors')
      delete fronts[sk]
      const id = nextId('k', cabinets)
      cabinets[id] = { w: Math.round(m.w * 10) / 10, front }
      const c = moduleCenter(run, m)
      at[id] = c
      insertByCenter(rows.base[run.id as WallId], id, c, at)
    }
  }
  return stateWith(state, rows, state.gaps, at, { cabinets, fronts: compact(fronts) })
}

/** Кого закрепил `pinWalls` (новые `kN`): мягкие соседи жеста — `FitOptions.soft`. Свои шкафы покупателя сюда не попадают. */
export function pinnedIds(before: KitchenState, after: KitchenState): ItemKey[] {
  return Object.keys(after.cabinets ?? {}).filter((k) => !before.cabinets?.[k as keyof NonNullable<KitchenState['cabinets']>]) as ItemKey[]
}

/** Следующая стена для «На другую стену» (A → B → C → A, куда предмету можно); null — некуда. */
export function nextWallId(shape: Shape, from: WallId, key: ItemKey): WallId | null {
  const walls = wallsOf(shape).filter((w) => allowedOn(w, key))
  if (walls.length < 2) return null
  return walls[(walls.indexOf(from) + 1) % walls.length]
}

/**
 * «На другую стену» — то же правило, что перетаскивание (P1): автошкафы обеих
 * стен закрепляются (`pinWalls`), место на стене `wall` ищется через постановку
 * (`placeWith`, как `placeAt`): сначала пустые места, потом ряд с шагом 5 см
 * от середины к краям. Соседи молча не сужаются: не встало — состояние
 * прежнее, `fit` (`ok=false`, `need`, `narrow`) — попытка с наименьшей нехваткой.
 */
export function moveToWall(state: KitchenState, key: ItemKey, wall: WallId, planner: Planner): Placed {
  const p0 = planner(state, [])
  const cur = itemPositions(p0)[key]
  const run = p0.runs.find((r) => r.id === wall)
  if (!cur || !run) return { state, fit: null }
  const pinned = pinWalls(state, p0, [cur.wall, wall])
  const soft = pinnedIds(state, pinned)
  const p1 = pinned === state ? p0 : planner(pinned, [])
  const row = cur.row ?? 'base'
  const mid = run.length / 2
  const scan: number[] = []
  for (let c = cur.w / 2; c <= run.length - cur.w / 2 + 0.01; c += 5) scan.push(c)
  scan.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))
  const gaps = (run.gaps ?? []).filter((g) => g.row === row).map((g) => moduleCenter(run, g))
  let best: Fit | null = null
  // лучшая неудача — та, где есть кого сузить, и с наименьшей нехваткой
  const rank = (f: Fit) => (f.narrow ? 0 : 10000) + f.need
  const worse = (f: Fit | null): f is Fit => Boolean(f && !f.ok && (!best || rank(f) < rank(best)))
  // сначала свободные места (соседи прежние), потом — где уступят мягкие соседи (P1)
  for (const pass of [[], soft]) {
    const tried = new Set<number>()
    for (const c of [...gaps, ...scan]) {
      const f = fitOn(p1, key, wall, c, { row, soft: pass })
      if (!f) continue
      if (!f.ok) {
        if (worse(f)) best = f
        continue
      }
      if (tried.has(f.center)) continue
      tried.add(f.center)
      const r = placeWith(pinned, p1, key, wall, f.center, planner, { soft: pass })
      if (r.fit?.ok) return r
      if (worse(r.fit)) best = r.fit
    }
  }
  return { state, fit: best ?? fitOn(p1, key, wall, mid, { row }) }
}

/** Кого сузить и на сколько, чтобы `key` встал в `cm` на стене `wall`; null — встаёт и так или сузить некого. */
/**
 * «Сузить» (P3): сосед `k` становится уже на `by` см и прижат к дальнему от
 * `toward` (середина ставимого) краю — иначе сужение вокруг середины освободит
 * только by/2. Свой шкаф, которому остаётся уже `CAB_MIN`, шкафом не остаётся:
 * его место заполнит раскладка по правилам авто-заполнения (`splitFill` —
 * бутылочница или планка), без «Шкаф 22 см» с ящиками. Не сузить — `s` прежний.
 */
export function narrowNeighbour(s: KitchenState, k: ItemKey, by: number, plan: Plan, toward: number): KitchenState {
  const at0 = s.at?.[k]
  const t: KitchenState = at0 === undefined ? s : { ...s, at: { ...s.at, [k]: at0 + (at0 > toward ? by / 2 : -by / 2) } }
  const cab = isCabinet(k) ? t.cabinets?.[k] : undefined
  if (cab && cab.w - by < CAB_MIN) {
    const cabinets = { ...t.cabinets }
    delete cabinets[k as CabinetId]
    const at = { ...t.at }
    delete at[k]
    const arrangement: Arrangement = {}
    for (const [w, list] of Object.entries(t.arrangement ?? {}) as [WallId, ItemKey[]][]) arrangement[w] = list.filter((x) => x !== k)
    return { ...t, cabinets, at, arrangement }
  }
  if (cab) return { ...t, cabinets: { ...t.cabinets, [k]: { ...cab, w: cab.w - by } } }
  if (isUpperCab(k) && t.upperCabs?.[k]) return { ...t, upperCabs: { ...t.upperCabs, [k]: { ...t.upperCabs[k]!, w: t.upperCabs[k]!.w - by } } }
  if (isGap(k) && t.gaps?.[k]) return { ...t, gaps: { ...t.gaps, [k]: { ...t.gaps[k]!, w: t.gaps[k]!.w - by } } }
  const w = itemPositions(plan)[k]?.w
  if (w !== undefined && (SIZED_ITEMS as readonly string[]).includes(k)) return { ...t, widths: { ...t.widths, [k as SizedItem]: w - by } }
  return s
}

export function narrowFor(plan: Plan, key: ItemKey, wall: WallId, cm: number, opts: FitOptions = {}): Narrow | null {
  const fit = fitOn(plan, key, wall, cm, opts)
  return fit && !fit.ok ? fit.narrow : null
}

/**
 * Верх стены становится ручным: шкафы, полки и доборы автоматического ряда —
 * явные `uN` со своими `at`; вытяжка, угловой, шкаф над холодильником и пусто
 * над пеналами остаются производными от низа. Уже ручной — без изменений.
 */
export function detachUppers(state: KitchenState, wall: WallId, plan: Plan): KitchenState {
  if (state.manualUppers?.[wall]) return state
  const run = plan.runs.find((r) => r.id === wall)
  if (!run || !run.wall) return state
  const cabs: NonNullable<KitchenState['upperCabs']> = { ...state.upperCabs }
  const gaps: NonNullable<KitchenState['gaps']> = { ...state.gaps }
  const at: NonNullable<KitchenState['at']> = { ...state.at }
  const keys: { key: ItemKey; c: number }[] = []
  for (const u of run.uppers) {
    // добор (панель уже UPPER_MIN) шкафом не становится: остаток ряда снова заполнится добором той же ширины
    if (u.kind !== 'doors' && u.kind !== 'shelf') continue
    const id = nextId('u', cabs)
    cabs[id] = { w: Math.round(u.w * 10) / 10, kind: u.kind === 'shelf' ? 'shelf' : 'doors' }
    const c = moduleCenter(run, u)
    at[id] = c
    keys.push({ key: id, c })
  }
  // дыры автоматического ряда (над пустым местом низа) — пустые места верха: картинка от перевода не меняется
  const sorted = [...run.uppers].sort((a, b) => a.x - b.x)
  let x = 0
  for (const u of [...sorted, { x: run.length, w: 0 }]) {
    if (u.x - x >= 1) {
      const id = nextId('g', gaps)
      gaps[id] = { w: Math.round(u.x - x) }
      const c = moduleCenter(run, { x, w: u.x - x })
      at[id] = c
      keys.push({ key: id, c })
    }
    x = Math.max(x, u.x + u.w)
  }
  keys.sort((a, b) => a.c - b.c)
  return { ...state, upperCabs: cabs, ...(Object.keys(gaps).length ? { gaps } : {}), at, manualUppers: { ...state.manualUppers, [wall]: keys.map((k) => k.key) } }
}

/** Что ставят на «+»: шкаф с дверцами, ящики, пенал, планка на пустое место, «заполнить автоматически», или существующая техника/мойка сюда. */
export type AddKind = 'doors' | 'drawers' | 'pantry' | 'strip' | 'fill' | FixedItem

/**
 * «+» в точке `cm` стены `wall`. Попали в пустое место — новое встаёт в него
 * его шириной (или своей, если место уже); `fill` убирает пустое место, и его
 * закрывает автозаполнение; `strip` закрывает его декоративной планкой.
 * Возвращает новое состояние и ключ поставленного (null — не встало).
 */
/** Не встало — `fit` (`ok=false`, `need`, `narrow`) для «сузить соседей»; для `fill`/`strip` без пустого места `fit` нет. */
export function addAt(state: KitchenState, wall: WallId, cm: number, kind: AddKind, planner: Planner): { state: KitchenState; key: ItemKey | null; fit?: Fit | null } {
  const p0 = planner(state, [])
  const run = p0.runs.find((r) => r.id === wall)
  if (!run) return { state, key: null }
  const hit = (run.gaps ?? []).find((g) => g.row === 'base' && Math.abs(moduleCenter(run, g) - cm) <= g.w / 2)
  const target = hit ? moduleCenter(run, hit) : cm
  if (kind === 'fill') {
    if (!hit) return { state, key: null }
    const rows = rowsOf(state)
    removeKey(rows, hit.item)
    const gaps = { ...state.gaps }
    delete gaps[hit.item]
    const at = { ...state.at }
    delete at[hit.item]
    return { state: stateWith(state, rows, gaps, at), key: null }
  }
  if (kind === 'strip') {
    if (!hit) return { state, key: null }
    return { state: { ...state, gaps: { ...state.gaps, [hit.item]: { w: hit.w, strip: true } } }, key: hit.item }
  }
  if (kind === 'doors' || kind === 'drawers') {
    const id = nextId('k', state.cabinets)
    const cab: Cabinet = { w: sizedWidth('cabinet', hit ? hit.w : 60), front: kind === 'doors' ? 'doors' : 'drawers3' }
    const placed = placeWith({ ...state, cabinets: { ...state.cabinets, [id]: cab } }, p0, id, wall, target, planner, { w: cab.w, fresh: true })
    return placed.fit?.ok ? { state: placed.state, key: id } : { state, key: null, fit: placed.fit }
  }
  if (kind === 'pantry') {
    const pos = itemPositions(p0)
    const key: FixedItem = pos.pantry ? 'pantry2' : 'pantry'
    if (pos[key]) return { state, key: null }
    const w = sizedWidth(key, state.widths?.[key] ?? PANTRY_W)
    const placed = placeWith({ ...state, pantries: key === 'pantry' ? 1 : 2 }, p0, key, wall, target, planner, { w, fresh: true })
    return placed.fit?.ok ? { state: placed.state, key } : { state, key: null, fit: placed.fit }
  }
  const placed = placeAt(state, kind, wall, target, planner)
  return placed.fit?.ok ? { state: placed.state, key: kind } : { state, key: null, fit: placed.fit }
}

/**
 * Меню «+» (P1): ширина, которая встанет от `addAt` в этой точке, см — по готовому плану
 * (`fitOn`, без постановки); `null` — не встанет или ширины у пункта нет (`fill`).
 */
export function addWidth(state: KitchenState, plan: Plan, wall: WallId, cm: number, kind: AddKind): number | null {
  const run = plan.runs.find((r) => r.id === wall)
  if (!run || kind === 'fill') return null
  const hit = (run.gaps ?? []).find((g) => g.row === 'base' && Math.abs(moduleCenter(run, g) - cm) <= g.w / 2)
  if (kind === 'strip') return hit ? hit.w : null
  const pos = itemPositions(plan)
  let key: ItemKey
  let w: number | undefined
  if (kind === 'doors' || kind === 'drawers') {
    key = nextId('k', state.cabinets)
    w = sizedWidth('cabinet', hit ? hit.w : 60)
  } else if (kind === 'pantry') {
    const pk = pos.pantry ? 'pantry2' : 'pantry'
    if (pos[pk]) return null
    key = pk
    w = sizedWidth(pk, state.widths?.[pk] ?? PANTRY_W)
  } else {
    key = kind
    w = pos[kind]?.w
  }
  const f = w === undefined ? null : fitOn(plan, key, wall, hit ? moduleCenter(run, hit) : cm, { w, row: 'base' })
  return f?.ok ? Math.round(f.w * 2) / 2 : null
}

/**
 * Длина стены (или острова) меняется: свои места остаются, где возможно.
 * Предмет за новым краем придвигается к краю (не влезает — место сбрасывается),
 * пустое место за краем ужимается до края или убирается.
 */
export function resizeWalls(state: KitchenState, sizes: Partial<Pick<KitchenState, 'a' | 'b' | 'c' | 'island'>>, plan: Plan): KitchenState {
  // неопределённые размеры не трогают стены: `{b: undefined}` стирал бы длину B и ронял чертёж (ревью 05)
  sizes = Object.fromEntries(Object.entries(sizes).filter(([, v]) => v !== undefined)) as typeof sizes
  const pos = itemPositions(plan)
  const at: NonNullable<KitchenState['at']> = { ...state.at }
  const gaps: NonNullable<KitchenState['gaps']> = { ...state.gaps }
  const rows = rowsOf(state)
  const walls: [keyof typeof sizes, WallId][] = [['a', 'A'], ['b', 'B'], ['c', 'C'], ['island', 'I']]
  for (const [field, wall] of walls) {
    const len = sizes[field]
    if (len === undefined) continue
    for (const [k, p] of Object.entries(pos) as [ItemKey, ItemPlace][]) {
      if (p.wall !== wall || at[k] === undefined || p.center + p.w / 2 <= len + 0.01) continue
      if (isGap(k)) {
        const w = len - (p.center - p.w / 2)
        if (w >= 1) {
          gaps[k] = { ...gaps[k], w: Math.round(w) }
          at[k] = len - w / 2
        } else {
          removeKey(rows, k)
          delete gaps[k]
          delete at[k]
        }
      } else if (len >= p.w) at[k] = len - p.w / 2
      else delete at[k]
    }
  }
  return stateWith(state, rows, gaps, at, sizes)
}
