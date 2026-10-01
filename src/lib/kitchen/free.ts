import { baseKey, upperKey } from './fronts'
import {
  FREE_UPPER,
  freeCorners,
  freeGaps,
  freeRange,
  freeUpperRange,
  itemPositions,
  minA,
  moduleCenter,
  WIDTH_LIMITS,
  wallsOf,
  type Plan,
  type Run,
} from './layout'
import {
  isCabinet,
  type Arrangement,
  type BaseFront,
  type Cabinet,
  type CabinetId,
  type FixedItem,
  type FreeRoom,
  type FreeUpper,
  type FreeWall,
  type ItemKey,
  type KitchenState,
  type Shape,
  type WallId,
} from './types'

/**
 * «Пустая комната» (PRO): действия покупателя и мастера — войти, поставить,
 * убрать, повесить верх. Без React и three.js: каждое действие — новое
 * состояние или причина отказа; экран применяет его через `update`, поэтому
 * «Отменить» работает само. Раскладку считает `planKitchen` (его передают
 * снаружи — как `trial` экрана), здесь только решения «куда».
 */

export type PlanOf = (s: KitchenState) => Plan

/** Отказ: места нет (free — самый широкий свободный промежуток, см) или такой предмет уже стоит. */
export type FreeFail = { fail: 'noRoom'; free: number } | { fail: 'exists'; key: ItemKey }
export type FreeDone = { state: KitchenState; key?: ItemKey }

/** Что можно поставить с палитры. */
export type FreeAdd =
  | { kind: 'cabinet'; w: number; front: BaseFront }
  | { kind: 'item'; key: FixedItem }

/** Поля, которые бывают только у раскладки по правилам: в пустой комнате они не нужны. */
const RULES_ONLY: (keyof KitchenState)[] = ['pantries', 'tallOven', 'ovenApart']

const clean = <T extends object>(o: T | undefined): T | undefined => (o && Object.keys(o).length ? o : undefined)

/** Пустые стены той же комнаты: форма, размеры, стиль, отделка и техника — как были. */
export function emptyRoom(state: KitchenState): KitchenState {
  const next: KitchenState = {
    ...state,
    free: {},
    arrangement: undefined,
    cabinets: undefined,
    at: undefined,
    widths: undefined,
    heights: undefined,
    fronts: undefined,
    doorsRight: undefined,
    overFridgeFacade: undefined,
  }
  for (const k of RULES_ONLY) delete next[k]
  return next
}

/**
 * Пустая комната, другая форма: всё, что стоит на оставшихся стенах, — на тех
 * же местах (добавили остров к прямой — прямая не меняется); новая стена
 * пустая. Со снятых стен шкафы уходят, а выбранная техника остаётся выбранной
 * и ждёт в «Технике» («Поставить», `Plan.unplaced`). `dropped` — сколько
 * предметов сняли.
 */
export function reshapeRoom(state: KitchenState, shape: Shape): { state: KitchenState; dropped: number } {
  const keep = new Set<WallId>(wallsOf(shape))
  const arrangement: Arrangement = {}
  let dropped = 0
  for (const [wall, list] of Object.entries(state.arrangement ?? {}) as [WallId, ItemKey[]][]) {
    if (keep.has(wall)) arrangement[wall] = [...list]
    else dropped += list.length
  }
  const placed = new Set<string>(Object.values(arrangement).flat())
  // ключ фасада или стороны открывания привязан к стене первой буквой (A120, a60, I0)
  const onWall = (key: string) => !/^[ABCIabci]\d/.test(key) || keep.has(key[0].toUpperCase() as WallId)
  const pick = <T,>(o: Record<string, T> | undefined, ok: (key: string) => boolean) =>
    clean(Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => ok(k)))) as Record<string, T> | undefined
  const free = state.free ?? {}
  const corners = freeCorners(shape, free)
  const uppers = pick(free.uppers, (w) => keep.has(w as WallId)) as FreeRoom['uppers']
  const cornerW = pick(free.cornerW, (e) => corners.includes(e as 'start' | 'end')) as FreeRoom['cornerW']
  const next: KitchenState = {
    ...state,
    shape,
    free: { ...(corners.length ? { corners } : {}), ...(cornerW ? { cornerW } : {}), ...(uppers ? { uppers } : {}) },
    arrangement: clean(arrangement),
    cabinets: pick(state.cabinets, (id) => placed.has(id)) as KitchenState['cabinets'],
    at: pick(state.at, (key) => placed.has(key)) as KitchenState['at'],
    fronts: pick(state.fronts, onWall) as KitchenState['fronts'],
  }
  // экран сливает состояние с прежним (`update`): пустое поле — явно undefined, иначе останется старое
  const right = (state.doorsRight ?? []).filter(onWall)
  next.doorsRight = right.length ? right : undefined
  return { state: next, dropped }
}

/**
 * Текущая кухня — в пустую комнату: всё остаётся на своих местах, но каждый
 * шкаф становится своим (его можно двигать, менять и убирать). Шкафы уже 15 см
 * (планки) не переносятся — там остаётся пустое место. Верхние шкафы — своими
 * верхними; вытяжка, угловой и антресоль над холодильником ставятся сами.
 */
export function roomFromKitchen(state: KitchenState, plan: Plan): KitchenState {
  const arrangement: Arrangement = {}
  const at: Partial<Record<ItemKey, number>> = {}
  const cabinets: Record<CabinetId, Cabinet> = {}
  const fronts = { ...state.fronts }
  const renamed = new Map<string, string>()
  const corners: ('start' | 'end')[] = []
  const uppers: Partial<Record<FreeWall, FreeUpper[]>> = {}
  let n = 0
  for (const run of plan.runs) {
    const wall = run.id as WallId
    const list: ItemKey[] = []
    for (const m of run.modules) {
      const center = Math.round(moduleCenter(run, m) * 2) / 2
      if (m.item) {
        list.push(m.item)
        at[m.item] = center
        continue
      }
      if (m.kind === 'corner') {
        if (m.blindAt) corners.push(m.blindAt)
        continue
      }
      if (m.w < WIDTH_LIMITS.cabinet.min - 0.01) continue
      const key = baseKey(run.id, m.x)
      const id: CabinetId = `k${++n}`
      const picked = fronts[key] as BaseFront | undefined
      delete fronts[key]
      renamed.set(key, id)
      cabinets[id] = { w: Math.round(Math.min(WIDTH_LIMITS.cabinet.max, m.w)), front: picked ?? (m.kind === 'drawers' ? 'drawers3' : 'doors') }
      list.push(id)
      at[id] = center
    }
    arrangement[wall] = list
    if (!run.wall) continue
    const ups: FreeUpper[] = []
    for (const u of run.uppers) {
      if (u.kind !== 'doors' && u.kind !== 'shelf' && u.kind !== 'filler') continue
      if (u.w < FREE_UPPER.min - 0.01) continue
      // открытые полки стиля — своим фасадом «полки», иначе в пустой комнате станут дверцами
      if (u.kind === 'shelf' && !fronts[upperKey(run.id, u.x)]) fronts[upperKey(run.id, u.x)] = 'open'
      ups.push({ c: Math.round(moduleCenter(run, u) * 2) / 2, w: Math.round(Math.min(FREE_UPPER.max, u.w)) })
    }
    if (ups.length) uppers[wall as FreeWall] = ups
  }
  // «дверца вправо» у обычного шкафа переходит к его новому ключу
  const doorsRight = state.doorsRight?.map((k) => renamed.get(k) ?? k)
  const next: KitchenState = {
    ...state,
    free: { ...(corners.length ? { corners } : {}), ...(Object.keys(uppers).length ? { uppers } : {}) },
    arrangement,
    at: clean(at),
    cabinets: clean(cabinets) as KitchenState['cabinets'],
    fronts: clean(fronts),
    doorsRight: doorsRight?.length ? doorsRight : undefined,
  }
  for (const k of RULES_ONLY) delete next[k]
  return next
}

/**
 * Выйти из пустой комнаты: обычная кухня по правилам (стиль, отделка и техника
 * — те же). У пустой комнаты стена A бывает короче, чем нужно форме по
 * правилам (`minA`), — удлиняем, как это сделала бы ссылка.
 */
export function leaveRoom(state: KitchenState): KitchenState {
  return {
    ...state,
    a: Math.max(state.a, minA(state.shape)),
    free: undefined,
    arrangement: undefined,
    cabinets: undefined,
    at: undefined,
    fronts: undefined,
    doorsRight: undefined,
  }
}

/** Свободные промежутки низа на стене, см от угла (как `at`). */
export function lowerGaps(state: KitchenState, plan: Plan, wall: WallId): [number, number][] {
  const run = plan.runs.find((r) => r.id === wall)
  if (!run) return []
  const taken = run.modules.map((m): [number, number] => {
    const c = moduleCenter(run, m)
    return [c - m.w / 2, c + m.w / 2]
  })
  const [lo, hi] = freeRange(state, wall)
  return freeGaps(taken, lo, hi)
}

const widest = (gaps: [number, number][]) => Math.floor(gaps.reduce((m, [a, b]) => Math.max(m, b - a), 0))

/**
 * Куда встать новому: сразу справа от выбранного (near — его середина и ширина),
 * если там есть место; иначе — в первое свободное место от угла.
 */
function spotFor(gaps: [number, number][], w: number, near?: { center: number; w: number }): number | null {
  if (near) {
    const edge = near.center + near.w / 2
    const g = gaps.find(([a, b]) => a <= edge + 0.5 && b >= edge + w - 0.01)
    if (g) return Math.max(edge, g[0]) + w / 2
    const back = near.center - near.w / 2
    const h = gaps.find(([a, b]) => b >= back - 0.5 && a <= back - w + 0.01)
    if (h) return Math.min(back, h[1]) - w / 2
  }
  const first = gaps.find(([a, b]) => b - a >= w - 0.01)
  return first ? first[0] + w / 2 : null
}

/** Следующий свободный номер своего шкафа. */
function nextCabinet(state: KitchenState): CabinetId {
  let n = 1
  while (state.cabinets?.[`k${n}`]) n++
  return `k${n}`
}

/**
 * Поставить шкаф или технику на стену: рядом с выбранным или в первое
 * свободное место. Ширину техники знает только раскладка — поэтому сначала
 * пробуем «куда-нибудь», узнаём ширину, потом ставим куда надо.
 */
export function freeAdd(state: KitchenState, plan: Plan, planOf: PlanOf, wall: WallId, what: FreeAdd, near?: ItemKey): FreeDone | FreeFail {
  let key: ItemKey
  let base: KitchenState = state
  if (what.kind === 'item') {
    const where = Object.entries(state.arrangement ?? {}).find(([, list]) => list?.includes(what.key))
    if (where && itemPositions(plan)[what.key]) return { fail: 'exists', key: what.key }
    key = what.key
  } else {
    key = nextCabinet(state)
    base = { ...state, cabinets: { ...state.cabinets, [key]: { w: what.w, front: what.front } } }
  }
  // убрать ключ, где бы он ни числился (например, на стене, которой больше нет)
  const arrangement: Arrangement = {}
  for (const w of wallsOf(state.shape)) arrangement[w] = (state.arrangement?.[w] ?? []).filter((k) => k !== key)
  arrangement[wall] = [...(arrangement[wall] ?? []), key]
  const at = { ...state.at }
  delete at[key]
  const probe: KitchenState = { ...base, arrangement, at: clean(at) }
  const tried = planOf(probe)
  const placed = itemPositions(tried)[key]
  if (!placed || placed.wall !== wall) return { fail: 'noRoom', free: widest(lowerGaps(state, plan, wall)) }
  const nearPlace = near ? itemPositions(plan)[near] : undefined
  const center = spotFor(lowerGaps(state, plan, wall), placed.w, nearPlace && nearPlace.wall === wall ? nearPlace : undefined) ?? placed.center
  const next: KitchenState = { ...probe, at: { ...at, [key]: Math.round(center * 2) / 2 } }
  const check = itemPositions(planOf(next))[key]
  if (!check || check.wall !== wall) return { fail: 'noRoom', free: widest(lowerGaps(state, plan, wall)) }
  return { state: { ...next, at: { ...next.at, [key]: Math.round(check.center * 2) / 2 } }, key }
}

/**
 * Заполнить пустое место [от, до] (см от угла) своими шкафами ровно по его
 * ширине: шире 120 см — несколькими равными. Фасады — front (по умолчанию полки).
 * Уже 15 см шкаф не бывает — отказ.
 */
export function freeFill(state: KitchenState, planOf: PlanOf, wall: WallId, gap: [number, number], front: BaseFront = 'open'): FreeDone | FreeFail {
  const width = gap[1] - gap[0]
  if (width < WIDTH_LIMITS.cabinet.min - 0.01) return { fail: 'noRoom', free: Math.floor(width) }
  const n = Math.ceil(width / WIDTH_LIMITS.cabinet.max)
  const w = Math.floor(width / n)
  let next = state
  const keys: CabinetId[] = []
  for (let i = 0; i < n; i++) {
    const key = nextCabinet(next)
    keys.push(key)
    const list = [...(next.arrangement?.[wall] ?? []), key]
    next = {
      ...next,
      cabinets: { ...next.cabinets, [key]: { w, front } },
      arrangement: { ...next.arrangement, [wall]: list },
      at: { ...next.at, [key]: Math.round((gap[0] + w * i + w / 2) * 2) / 2 },
    }
  }
  const placed = itemPositions(planOf(next))
  if (keys.some((k) => placed[k]?.wall !== wall)) return { fail: 'noRoom', free: Math.floor(width) }
  return { state: next, key: keys[0] }
}

/**
 * Пустая комната: ширина поставленного (или угловой шкаф стены A) изменилась —
 * новые места на стене. Выбранное растёт от своей середины, соседи по порядку
 * отодвигаются туда, где есть свободное место, упёрлись в край — всё сдвигается
 * обратно. Ничто не перескакивает через соседа и не уезжает на другое место.
 * next — состояние уже с новой шириной (угловой — со своей шириной в `free`),
 * plan — раскладка до изменения. Середины (см от угла) или null — не помещается.
 */
export function freeReflow(next: KitchenState, plan: Plan, wall: WallId, grow?: { key: ItemKey; w: number }): Partial<Record<ItemKey, number>> | null {
  const run = plan.runs.find((r) => r.id === wall)
  if (!run) return null
  const [lo, hi] = freeRange(next, wall)
  const items = run.modules
    .filter((m) => m.item)
    .map((m) => ({ key: m.item!, s: moduleCenter(run, m) - m.w / 2, w: m.w }))
    .sort((a, b) => a.s - b.s)
  const i = grow ? items.findIndex((x) => x.key === grow.key) : -1
  if (grow) {
    if (i < 0) return null
    const c = items[i].s + items[i].w / 2
    items[i] = { key: grow.key, s: c - grow.w / 2, w: grow.w }
  }
  if (items.reduce((t, x) => t + x.w, 0) > hi - lo + 0.01) return null
  // соседи справа и слева от выбранного отодвигаются, не перескакивая друг через друга
  if (i >= 0) {
    for (let j = i + 1; j < items.length; j++) items[j].s = Math.max(items[j].s, items[j - 1].s + items[j - 1].w)
    for (let j = i - 1; j >= 0; j--) items[j].s = Math.min(items[j].s, items[j + 1].s - items[j].w)
  }
  // упёрлись в край стены (или в угловой шкаф) — ряд сдвигается обратно
  for (let j = items.length - 1; j >= 0; j--) items[j].s = Math.min(items[j].s, (j === items.length - 1 ? hi : items[j + 1].s) - items[j].w)
  for (let j = 0; j < items.length; j++) items[j].s = Math.max(items[j].s, j === 0 ? lo : items[j - 1].s + items[j - 1].w)
  if (items.some((x) => x.s + x.w > hi + 0.01)) return null
  return Object.fromEntries(items.map((x) => [x.key, Math.round((x.s + x.w / 2) * 2) / 2]))
}

/** Убрать поставленное: свой шкаф — совсем, технику — со стены (модель остаётся выбранной). */
export function freeRemove(state: KitchenState, key: ItemKey): KitchenState {
  const arrangement: Arrangement = {}
  for (const [w, list] of Object.entries(state.arrangement ?? {}) as [WallId, ItemKey[]][]) arrangement[w] = list.filter((k) => k !== key)
  const at = { ...state.at }
  delete at[key]
  const next: KitchenState = { ...state, arrangement, at: clean(at) }
  if (isCabinet(key)) {
    const cabinets = { ...state.cabinets }
    delete cabinets[key]
    next.cabinets = clean(cabinets) as KitchenState['cabinets']
    const doors = state.doorsRight?.filter((k) => k !== key)
    next.doorsRight = doors?.length ? doors : undefined
  }
  return next
}

/** Угловой шкаф у конца стены A — поставить или убрать. */
export function freeCorner(state: KitchenState, end: 'start' | 'end', on: boolean): KitchenState {
  const list = new Set(state.free?.corners ?? [])
  if (on) list.add(end)
  else list.delete(end)
  const corners = (['start', 'end'] as const).filter((e) => list.has(e))
  return { ...state, free: { ...state.free, corners: corners.length ? corners : undefined } }
}

/* ───────── верхние шкафы ───────── */

/**
 * Занятое в верхнем ряду стены (см от угла): все верхние шкафы, колонны, окно.
 * except — место своего шкафа, который сейчас двигают: его куски не считаются.
 */
function upperTaken(plan: Plan, run: Run, except?: [number, number]): [number, number][] {
  const own = (u: Run['uppers'][number], a: number, b: number) =>
    Boolean(except) && (u.kind === 'doors' || u.kind === 'shelf' || u.kind === 'filler') && a >= except![0] - 0.5 && b <= except![1] + 0.5
  const taken = run.uppers.flatMap((u): [number, number][] => {
    const c = moduleCenter(run, u)
    const a = c - u.w / 2
    const b = c + u.w / 2
    return own(u, a, b) ? [] : [[a, b]]
  })
  const win = plan.window
  if (run.id === 'A' && win?.wall === 'back') taken.push([win.at - win.w / 2, win.at + win.w / 2])
  return taken
}

/** Ключи фасадов своего верхнего шкафа u стены wall в раскладке plan (`a<x>`; окно могло разрезать его на куски). */
function upperKeysIn(plan: Plan, wall: FreeWall, u: FreeUpper): string[] {
  const run = plan.runs.find((r) => r.id === wall)
  if (!run) return []
  return run.uppers
    .filter((m) => {
      if (m.kind !== 'doors' && m.kind !== 'shelf' && m.kind !== 'filler') return false
      const c = moduleCenter(run, m)
      return c - m.w / 2 >= u.c - u.w / 2 - 0.5 && c + m.w / 2 <= u.c + u.w / 2 + 0.5
    })
    .map((m) => upperKey(run.id, m.x))
}

/**
 * Шкаф переехал (ключ фасада `a<x>`/`A<x>` — от его места в ряду): выбор
 * фасада и сторона открывания едут за ним со старых ключей на новые. Старые
 * записи убираются — иначе они достались бы следующему шкафу на этом месте.
 */
function carryFronts(before: KitchenState, next: KitchenState, oldKeys: string[], newKeys: string[]): KitchenState {
  if (oldKeys.join() === newKeys.join()) return next
  const variant = oldKeys.map((k) => before.fronts?.[k]).find(Boolean)
  const right = oldKeys.some((k) => before.doorsRight?.includes(k))
  const fronts = { ...next.fronts }
  for (const k of [...oldKeys, ...newKeys]) delete fronts[k]
  if (variant) for (const k of newKeys) fronts[k] = variant
  const doors = [...(next.doorsRight ?? []).filter((k) => !oldKeys.includes(k) && !newKeys.includes(k)), ...(right ? newKeys : [])]
  return { ...next, fronts: clean(fronts), doorsRight: doors.length ? doors : undefined }
}

/** Угловой шкаф у конца стены A сдвинулся (своя ширина, длина стены): его фасады — за ним. */
export function carryCornerFronts(before: KitchenState, next: KitchenState, planBefore: Plan, planAfter: Plan): KitchenState {
  const keyOf = (p: Plan, end: 'start' | 'end') => {
    const m = p.runs.find((r) => r.id === 'A')?.modules.find((mod) => mod.kind === 'corner' && mod.blindAt === end)
    return m ? [baseKey('A', m.x)] : []
  }
  let out = next
  for (const end of ['start', 'end'] as const) {
    const a = keyOf(planBefore, end)
    const b = keyOf(planAfter, end)
    if (a.length && b.length) out = carryFronts(before, out, a, b)
  }
  return out
}

/** Свободные промежутки верхнего ряда на стене, см от угла. */
export function upperGaps(state: KitchenState, plan: Plan, wall: FreeWall): [number, number][] {
  const run = plan.runs.find((r) => r.id === wall)
  if (!run) return []
  const [lo, hi] = freeUpperRange(state, wall)
  return freeGaps(upperTaken(plan, run), lo, hi)
}

const withUppers = (state: KitchenState, wall: FreeWall, list: FreeUpper[]): KitchenState => {
  const uppers = { ...state.free?.uppers, [wall]: list.length ? list : undefined }
  const has = Object.values(uppers).some((l) => l?.length)
  return { ...state, free: { ...state.free, uppers: has ? (uppers as FreeRoom['uppers']) : undefined } }
}

/** Повесить верхний шкаф шириной w: над выбранным низом, иначе в первое свободное место. */
export function freeAddUpper(state: KitchenState, plan: Plan, wall: FreeWall, w: number, near?: { center: number; w: number }): FreeDone | FreeFail {
  const width = Math.max(FREE_UPPER.min, Math.min(FREE_UPPER.max, Math.round(w)))
  const gaps = upperGaps(state, plan, wall)
  // над выбранным низом — по его середине, если влезает
  let center: number | null = null
  if (near) {
    const g = gaps.find(([a, b]) => b - a >= width - 0.01 && a <= near.center + 0.01 && b >= near.center - 0.01)
    if (g) center = Math.min(g[1] - width / 2, Math.max(g[0] + width / 2, near.center))
  }
  center ??= spotFor(gaps, width, near)
  if (center === null) return { fail: 'noRoom', free: widest(gaps) }
  const list = [...(state.free?.uppers?.[wall] ?? []), { c: Math.round(center * 2) / 2, w: width }]
  return { state: withUppers(state, wall, list) }
}

/** Какой свой верхний шкаф стоит в точке (середина, см от угла): его номер в списке стены. */
export function freeUpperAt(state: KitchenState, wall: FreeWall, center: number): number {
  const list = state.free?.uppers?.[wall] ?? []
  return list.findIndex((u) => center >= u.c - u.w / 2 - 0.5 && center <= u.c + u.w / 2 + 0.5)
}

/**
 * Сдвинуть свой верхний шкаф на dc см (вдоль стены от угла). Упёрся в соседа,
 * колонну или окно — встаёт по ту сторону, в ближайшее место, где помещается.
 */
export function freeMoveUpper(state: KitchenState, plan: Plan, wall: FreeWall, index: number, dc: number, planOf?: PlanOf): KitchenState | null {
  const list = [...(state.free?.uppers?.[wall] ?? [])]
  const u = list[index]
  if (!u) return null
  const run = plan.runs.find((r) => r.id === wall)
  if (!run) return null
  // занятое — без самого шкафа (его куски в плане могли быть разрезаны окном)
  const taken = upperTaken(plan, run, [u.c - u.w / 2, u.c + u.w / 2])
  const [lo, hi] = freeUpperRange(state, wall)
  const gaps = freeGaps(taken, lo, hi)
  const gap = gaps.find(([a, b]) => a <= u.c + 0.01 && b >= u.c - 0.01)
  let c = gap ? Math.min(gap[1] - u.w / 2, Math.max(gap[0] + u.w / 2, u.c + dc)) : u.c
  if (!gap || Math.abs(c - u.c) < 0.25) {
    const fits = gaps.filter(([a, b]) => b - a >= u.w - 0.01)
    const next = dc > 0 ? fits.find(([a]) => a >= u.c + 0.01) : [...fits].reverse().find(([, b]) => b <= u.c - 0.01)
    if (!next) return null
    c = dc > 0 ? next[0] + u.w / 2 : next[1] - u.w / 2
  }
  list[index] = { ...u, c: Math.round(c * 2) / 2 }
  const next = withUppers(state, wall, list)
  // planOf — фасад и сторона открывания едут за шкафом
  return planOf ? carryFronts(state, next, upperKeysIn(plan, wall, u), upperKeysIn(planOf(next), wall, list[index])) : next
}

/**
 * Перенести свой верхний шкаф на стену toWall, серединой к center (см от угла):
 * встаёт в ближайшее свободное место, где помещается. Так его таскают в 3D.
 */
export function freePlaceUpper(
  state: KitchenState,
  plan: Plan,
  wall: FreeWall,
  index: number,
  toWall: FreeWall,
  center: number,
  planOf?: PlanOf,
): { state: KitchenState; index: number } | FreeFail {
  const u = state.free?.uppers?.[wall]?.[index]
  const run = plan.runs.find((r) => r.id === toWall)
  if (!u || !run) return { fail: 'noRoom', free: 0 }
  const taken = upperTaken(plan, run, toWall === wall ? [u.c - u.w / 2, u.c + u.w / 2] : undefined)
  const [lo, hi] = freeUpperRange(state, toWall)
  const gaps = freeGaps(taken, lo, hi)
  let best: { c: number; d: number } | null = null
  for (const [a, b] of gaps) {
    if (b - a < u.w - 0.01) continue
    const c = Math.min(b - u.w / 2, Math.max(a + u.w / 2, center))
    if (!best || Math.abs(c - center) < best.d - 0.001) best = { c, d: Math.abs(c - center) }
  }
  if (!best) return { fail: 'noRoom', free: widest(gaps) }
  const moved = { ...u, c: Math.round(best.c * 2) / 2 }
  const carry = (next: KitchenState) => (planOf ? carryFronts(state, next, upperKeysIn(plan, wall, u), upperKeysIn(planOf(next), toWall, moved)) : next)
  if (toWall === wall) {
    const list = [...(state.free?.uppers?.[wall] ?? [])]
    list[index] = moved
    return { state: carry(withUppers(state, wall, list)), index }
  }
  const from = withUppers(state, wall, (state.free?.uppers?.[wall] ?? []).filter((_, i) => i !== index))
  const list = [...(from.free?.uppers?.[toWall] ?? []), moved]
  return { state: carry(withUppers(from, toWall, list)), index: list.length - 1 }
}

/** Новая ширина своего верхнего шкафа: растёт от середины, упёрся — сдвигается. */
export function freeResizeUpper(state: KitchenState, plan: Plan, wall: FreeWall, index: number, w: number, planOf?: PlanOf): FreeDone | FreeFail {
  const list = [...(state.free?.uppers?.[wall] ?? [])]
  const u = list[index]
  if (!u) return { fail: 'noRoom', free: 0 }
  const width = Math.max(FREE_UPPER.min, Math.min(FREE_UPPER.max, Math.round(w)))
  const run = plan.runs.find((r) => r.id === wall)
  if (!run) return { fail: 'noRoom', free: 0 }
  const taken = upperTaken(plan, run, [u.c - u.w / 2, u.c + u.w / 2])
  const [lo, hi] = freeUpperRange(state, wall)
  const gap = freeGaps(taken, lo, hi).find(([a, b]) => a <= u.c + 0.01 && b >= u.c - 0.01)
  if (!gap || gap[1] - gap[0] < width - 0.01) return { fail: 'noRoom', free: gap ? Math.floor(gap[1] - gap[0]) : 0 }
  const c = Math.min(gap[1] - width / 2, Math.max(gap[0] + width / 2, u.c))
  list[index] = { c: Math.round(c * 2) / 2, w: width }
  const next = withUppers(state, wall, list)
  return { state: planOf ? carryFronts(state, next, upperKeysIn(plan, wall, u), upperKeysIn(planOf(next), wall, list[index])) : next }
}

/** Убрать свой верхний шкаф; plan — забыть и его фасады (иначе они достались бы следующему на этом месте). */
export function freeRemoveUpper(state: KitchenState, wall: FreeWall, index: number, plan?: Plan): KitchenState {
  const u = state.free?.uppers?.[wall]?.[index]
  const next = withUppers(
    state,
    wall,
    (state.free?.uppers?.[wall] ?? []).filter((_, i) => i !== index),
  )
  return plan && u ? carryFronts(state, next, upperKeysIn(plan, wall, u), []) : next
}

/**
 * Верх над всем низом стены: над каждым шкафом, мойкой и техникой под
 * столешницей — верхний шкаф той же ширины, где ещё пусто. Над варочной —
 * вытяжка, над колоннами и холодильником — своё, окно — окно.
 */
export function freeUppersOverLower(state: KitchenState, plan: Plan, wall: FreeWall): KitchenState {
  const run = plan.runs.find((r) => r.id === wall)
  if (!run) return state
  const taken = upperTaken(plan, run)
  const [lo, hi] = freeUpperRange(state, wall)
  const list = [...(state.free?.uppers?.[wall] ?? [])]
  const lower = run.modules
    .filter((m) => m.kind !== 'hob' && m.kind !== 'fridge' && m.kind !== 'tall' && m.kind !== 'pantry' && m.kind !== 'corner')
    .map((m): [number, number] => {
      const c = moduleCenter(run, m)
      return [c - m.w / 2, c + m.w / 2]
    })
    .sort((p, q) => p[0] - q[0])
  for (const [a, b] of lower) {
    for (const [g0, g1] of freeGaps(taken, Math.max(lo, a), Math.min(hi, b))) {
      if (g1 - g0 < FREE_UPPER.min - 0.01) continue
      // шире предела — несколькими шкафами поровну
      const n = Math.ceil((g1 - g0) / FREE_UPPER.max)
      const w = (g1 - g0) / n
      for (let i = 0; i < n; i++) list.push({ c: Math.round((g0 + w * (i + 0.5)) * 2) / 2, w: Math.floor(w) })
      taken.push([g0, g1])
    }
  }
  return withUppers(state, wall, list)
}
