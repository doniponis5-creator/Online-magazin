import { fitOn, itemPositions, placeAt, swapFirst, swapFit, type Narrow, type Plan, type Planner, type SnapKind } from './layout'
import type { ItemKey, KitchenState, WallId } from './types'

/**
 * Предпросмотр перемещения — одна модель для 3D и плана сверху (спецификация
 * §2, R04). Вход: раскладка, ключ, стена, позиция пальца в см от угла и точка
 * захвата; выход — где окажется модуль после снапа, помещается ли, подписи
 * «до угла / до соседа» и кого можно сузить. 3D и план только переводят
 * пиксели в «стена + см» и рисуют то, что вернула эта функция.
 */
export type Preview = {
  /** середина модуля после снапа и упора в соседей, см от угла */
  center: number
  width: number
  wall: WallId
  fits: boolean
  snap: SnapKind
  /** до левого и правого соседа (или края стены), см; в движении обновляются */
  labels: { left: number; right: number }
  /** не помещается: кого сузить и на сколько; null — сузить некого */
  narrow: Narrow | null
  /** не помещается: сколько см не хватило (помещается — 0) */
  need: number
  /** встанет обменом местами (P3): с этим соседом, null — с автошкафом; нет поля — обычная постановка */
  swap?: ItemKey | null
}

/**
 * Позиция ПАЛЬЦА `cm` минус точка захвата `grab` — середина модуля; дальше
 * магнит 6 см к концам стены и краям соседей, в плане (`opposite`) — ещё к
 * краям противоположного ряда. null — модуля нет в раскладке или нет такой стены.
 */
/**
 * Пробная постановка для обмена: `state` и `planner` — те же, что получит `placeAt` на отпускании;
 * `memo` — кэш вердиктов на время жеста (ключ — стена, сосед, середина), чтобы не считать раскладку на каждый шаг пальца.
 */
export type SwapTrial = { state: KitchenState; planner: Planner; memo?: Map<string, boolean> }

export function previewMove(plan: Plan, key: ItemKey, wall: WallId, cm: number, grab: number, opts: { opposite?: boolean; soft?: ItemKey[]; trial?: SwapTrial } = {}): Preview | null {
  // soft — мягкие соседи жеста (P1): предпросмотр и постановка считают по одному правилу
  const fit = fitOn(plan, key, wall, cm - grab, { opposite: opts.opposite, soft: opts.soft })
  if (!fit) return null
  const half = fit.w / 2
  const r1 = (v: number) => Math.round(Math.max(0, v) * 10) / 10
  // не помещается, а палец над соседом той же стены — обмен местами, как в placeAt
  // встать можно, только ужав соседа, и палец глубоко на нём — тоже сначала обмен (P5: `swapFirst`, то же правило, что в placeAt)
  const sw = fit.ok && !swapFirst(plan, key, wall, cm - grab, opts.soft) ? null : swapFit(plan, key, wall, cm - grab)
  // зелёная рамка обмена — только если placeAt на отпускании правда поменяет (та же пробная раскладка), иначе «рамка, потом тост»
  if (sw && swapHolds(opts.trial, key, wall, cm, grab, opts.soft, `${wall}|${sw.with}|${sw.center}`, true)) return { center: sw.center, width: fit.w, wall, fits: true, snap: null, labels: { left: 0, right: 0 }, narrow: null, need: 0, swap: sw.with }
  // у варочной свой шкаф ≥ 30 встаёт вплотную (он сам столешница), но освобождённое им место у варочной
  // станет пустым и потребует запаса — рамку проверяет та же пробная раскладка, что и отпускание (P4)
  const nearHob = fit.ok && fit.row === 'base' && (key === 'hob' || fit.neighbours.left === 'hob' || fit.neighbours.right === 'hob')
  const holds = !nearHob || swapHolds(opts.trial, key, wall, cm, grab, opts.soft, `${wall}|fit|${fit.center}`)
  return {
    center: fit.center,
    width: fit.w,
    wall,
    fits: fit.ok && holds,
    snap: fit.snap,
    labels: { left: r1(fit.center - half - fit.free.from), right: r1(fit.free.to - (fit.center + half)) },
    narrow: fit.narrow,
    need: fit.need,
  }
}

/** `swap` — вердикт «встанет обменом»: мало, что встанет, — placeAt должен именно поменять местами, а не поставить уступкой */
function swapHolds(trial: SwapTrial | undefined, key: ItemKey, wall: WallId, cm: number, grab: number, soft: ItemKey[] | undefined, id: string, swap = false): boolean {
  if (!trial) return true
  const known = trial.memo?.get(id)
  if (known !== undefined) return known
  const fit = placeAt(trial.state, key, wall, cm, trial.planner, grab, { soft }).fit
  const ok = Boolean(fit?.ok && (!swap || fit.swap !== undefined))
  trial.memo?.set(id, ok)
  return ok
}

/**
 * Точка захвата: смещение точки нажатия от середины модуля, см. Запоминается
 * на 'start' и передаётся в каждый `previewMove`/`placeAt`: шкаф идёт за
 * пальцем, а не прыгает серединой под палец (audit-move §5 п. 1).
 */
export function grabOf(plan: Plan, key: ItemKey, cm: number): number {
  const p = itemPositions(plan)[key]
  return p ? Math.round((cm - p.center) * 10) / 10 : 0
}
