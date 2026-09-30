import { addAt, DEPTH, minA, runCm, runX, UPPER_DEPTH, type ModuleKind, type Plan, type Planner, type Run, type UpperKind } from '@/lib/kitchen/layout'
import { baseKey, upperKey } from '@/lib/kitchen/fronts'
import type { FixedItem, GapId, KitchenState, Shape, SlotKind, WallId } from '@/lib/kitchen/types'

/**
 * Геометрия плана сверху без React и three.js: та же система координат, что
 * у чертежа (`PlanSketch`, `planSvg`) — ряд задан началом `ox/oz` и поворотом
 * `rot`, точка ряда `(x, z)` (вдоль стены, от стены) переводится в мир по одной
 * формуле. Интерактивный план (`PlanView`) только рисует ячейки отсюда и
 * переводит палец в «стена + см» через `hitRun`.
 */

/** Точка ряда → мир (см). Формула — как в `PlanSketch`/`planSvg`. */
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

export type Rect = { x: number; y: number; w: number; h: number }

/** Прямоугольник отрезка ряда `x…x+w` глубиной `d0…d1` в мире, выровненный по осям (кухня стоит под прямыми углами). */
export function rectOf(run: Pick<Run, 'ox' | 'oz' | 'rot'>, x: number, w: number, d0: number, d1: number): Rect {
  const cs = [runWorld(run, x, d0), runWorld(run, x + w, d0), runWorld(run, x + w, d1), runWorld(run, x, d1)]
  const xs = cs.map((c) => c.x)
  const zs = cs.map((c) => c.z)
  const x0 = Math.min(...xs)
  const y0 = Math.min(...zs)
  return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...zs) - y0 }
}

/** Полоса ряда, в которую попадает палец: чуть шире шкафов, чтобы не промахиваться. */
const BAND = 10
/** Дальше этого от любой полосы — цели нет (как в 3D: мимо кухни — отпустить = отмена). */
const TOL = 60

/**
 * Палец в мире → ближайший ряд и см ОТ УГЛА (как ждёт раскладка: `runCm`, на
 * стене B это `length − x`). Внутри полосы ряда — расстояние 0 (в углу первым
 * выигрывает A); дальше `TOL` см от всех — null.
 */
export function hitRun(plan: Pick<Plan, 'runs'>, wx: number, wz: number, tol = TOL): { wall: WallId; cm: number } | null {
  let best: { wall: WallId; cm: number; dist: number } | null = null
  for (const run of plan.runs) {
    const { x, z } = runLocal(run, wx, wz)
    const dz = z < -BAND ? -BAND - z : z > DEPTH + BAND ? z - DEPTH - BAND : 0
    const dx = x < 0 ? -x : x > run.length ? x - run.length : 0
    const dist = Math.hypot(dx, dz)
    if (dist <= tol && (!best || dist < best.dist)) best = { wall: run.id, cm: Math.round(runCm(run, Math.min(run.length, Math.max(0, x))) * 10) / 10, dist }
  }
  return best ? { wall: best.wall, cm: best.cm } : null
}

/** Цепочка размеров ряда: начало, края каждого модуля, конец — уникальные, по порядку. */
export function chainOf(run: Pick<Run, 'length' | 'modules'>): number[] {
  const r = (v: number) => Math.round(v * 10) / 10
  const cuts = new Set<number>([0, r(run.length)])
  for (const m of run.modules) {
    cuts.add(r(m.x))
    cuts.add(r(m.x + m.w))
  }
  return [...cuts].filter((c) => c >= 0 && c <= run.length + 0.05).sort((a, b) => a - b)
}

export type PlanCell = {
  /** ключ сцены — как у движка: предмет/свой шкаф/пусто по ключу модели, автошкаф `A120`, верх `a120` */
  key: string
  wall: WallId
  row: 'base' | 'upper' | 'gap'
  /** у пустого места — какой ряд оно занимает */
  gapRow?: 'base' | 'upper'
  /** вдоль ряда, см */
  x: number
  w: number
  /** глубина от стены, см */
  depth: number
  kind: ModuleKind | UpperKind | 'gap'
  slot: SlotKind | null
  /** можно нажать и тащить */
  pick: boolean
  /** прямоугольник в мире */
  rect: Rect
  /** ряд стоит вдоль оси Z (боковая стена) — подписи поворачиваются */
  vertical: boolean
}

const SLOT_OF_KIND: Partial<Record<ModuleKind, SlotKind>> = { fridge: 'fridge', dishwasher: 'dishwasher', washer: 'washer', oven: 'oven', tall: 'microwave' }
/** Верхние, которые можно взять: свои и автоматические шкафы и полки; вытяжка, угловой, над холодильником — из низа. */
const UPPER_PICK: ReadonlySet<UpperKind> = new Set(['doors', 'shelf'])
/** Автошкафы низа, которые можно взять (как `keyAt` движка: планка уже 15 см — нет). */
const BASE_AUTO_PICK: ReadonlySet<ModuleKind> = new Set(['doors', 'drawers', 'bottle', 'filler'])

/** Все ячейки плана: низ, верх контуром, пустые места — с ключами сцены, готовые к рисованию и захвату. */
export function planCells(plan: Pick<Plan, 'runs'>): PlanCell[] {
  const out: PlanCell[] = []
  for (const run of plan.runs) {
    const wall = run.id as WallId
    const vertical = Math.abs(Math.sin(run.rot)) > 0.5
    for (const m of run.modules) {
      const key = m.item ?? baseKey(run.id, m.x)
      const pick = m.item ? true : BASE_AUTO_PICK.has(m.kind) && m.w >= 15
      out.push({ key, wall, row: 'base', x: m.x, w: m.w, depth: DEPTH, kind: m.kind, slot: m.kind === 'hob' ? 'hob' : (SLOT_OF_KIND[m.kind] ?? null), pick, rect: rectOf(run, m.x, m.w, 0, DEPTH), vertical })
    }
    if (run.wall)
      for (const u of run.uppers) {
        if (u.kind === 'none') continue
        const key = u.item ?? upperKey(run.id, u.x)
        out.push({ key, wall, row: 'upper', x: u.x, w: u.w, depth: UPPER_DEPTH, kind: u.kind, slot: u.kind === 'hood' ? 'hood' : null, pick: UPPER_PICK.has(u.kind), rect: rectOf(run, u.x, u.w, 0, UPPER_DEPTH), vertical })
      }
    for (const g of run.gaps ?? []) {
      const depth = g.row === 'upper' ? UPPER_DEPTH : DEPTH
      out.push({ key: g.item, wall, row: 'gap', gapRow: g.row, x: g.x, w: g.w, depth, kind: 'gap', slot: null, pick: true, rect: rectOf(run, g.x, g.w, 0, depth), vertical })
    }
  }
  return out
}

/** Середина ячейки в см от угла — то, что нужно `placeAt`/`addAt`/`previewMove`. */
export function cellCm(run: Pick<Run, 'id' | 'length'>, cell: Pick<PlanCell, 'x' | 'w'>): number {
  return runCm(run, cell.x + cell.w / 2)
}
/** См от угла → позиция вдоль ряда (для рисования предпросмотра). */
export const cellX = runX

/** Куда ставить из меню «+»: стена, см от угла, пустое место (если попали в него). */
export type PlanTarget = { wall: WallId; cm: number; gap: GapId | null }

/** Слот техники → предмет раскладки; вытяжка и микроволновка своего места в ряду не занимают. */
export const SLOT_ITEM: Partial<Record<SlotKind, FixedItem>> = { fridge: 'fridge', dishwasher: 'dishwasher', washer: 'washer', hob: 'hob', oven: 'oven' }

/**
 * «+» → «Технику» → выбрали модель в шаге «Техника»: предмет слота встаёт в
 * запомненное место через `addAt`. Не встал или у слота нет предмета — состояние прежнее.
 */
export function addPicked(state: KitchenState, target: PlanTarget, slot: SlotKind, planner: Planner): KitchenState {
  const item = SLOT_ITEM[slot]
  if (!item) return state
  const r = addAt(state, target.wall, target.cm, item, planner)
  return r.key ? r.state : state
}

/** Стены толщиной `T` на плане (как у чертежа). */
export const WALL_T = 12

/** Рамка кухни на плане, см: стены, ряды, остров и окно — без полей под цепочки размеров. */
export function planFrame(plan: Plan): { x0: number; y0: number; x1: number; y1: number } {
  const W = plan.room.w
  const winEnd = plan.window?.wall === 'left' ? plan.window.at + plan.window.w / 2 + 20 : 0
  const D = Math.max(...plan.runs.map((r) => (r.id === 'A' ? DEPTH : r.id === 'I' ? (plan.island?.z ?? 0) + (plan.island?.d ?? 0) + 20 : r.length)), 120, winEnd)
  return { x0: -WALL_T, y0: -WALL_T, x1: W + WALL_T, y1: D }
}

/**
 * Смена формы: своя расстановка, свои шкафы, места, пустые места, ручной
 * верх и его шкафы — всё от прежней формы; остаются только размеры и выбор.
 * (Ревью таска 03: `gaps`/`manualUppers`/`upperCabs` раньше оставались сиротами.)
 */
export function resetForShape(state: KitchenState, shape: Shape): Partial<KitchenState> {
  return { shape, a: Math.max(state.a, minA(shape)), arrangement: undefined, cabinets: undefined, at: undefined, gaps: undefined, manualUppers: undefined, upperCabs: undefined }
}
