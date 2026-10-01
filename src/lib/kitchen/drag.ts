import { companions, fitOn, itemPositions, placeAt, resolveArrangement, stepItem, swapFirst, swapFit, type Narrow, type Plan, type Planner, type SnapKind } from './layout'
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

/** Что принять после «левее / правее»: заплатка состояния и кто прилипает к соседям. */
export type Nudge = { patch: Partial<KitchenState>; snap: ItemKey[] }

/**
 * «Левее / правее» на `step` см (кнопки ← → и клавиши): соседи
 * подстраиваются; упёрся в технику или другой предмет — встаёт вплотную по
 * ту сторону соседа. `dir` — направление на экране: у левой стены и у
 * острова ряд идёт справа налево, поэтому наоборот. `null` — двигать некуда.
 * Чистая функция: экран передаёт заплатку в `apply(patch, snap)`.
 */
export function nudgeMove(state: KitchenState, plan: Plan, key: ItemKey, dir: 1 | -1, planner: Planner, step = 5): Nudge | null {
  const positions = itemPositions(plan)
  const p = positions[key]
  if (!p) return null
  const sign = (p.wall === 'B' || p.wall === 'I' ? -dir : dir) as 1 | -1
  // Свой верхний: двигается в своём ряду (manualUppers), ширина прежняя.
  // Порядок низа его не знает — по нему шкаф прыгал через всю стену.
  if (p.row === 'upper') {
    const put = (cm: number) => {
      const { state: next, fit } = placeAt(state, key, p.wall, cm, planner, 0, { w: p.w })
      return fit?.ok && next !== state ? { patch: next, snap: [] } : null
    }
    // На 5 см — без прилипания: placeAt тянет к соседу ближе 5 см обратно.
    const at = { ...state.at, [key]: p.center + sign * step }
    const moved = itemPositions(planner({ ...state, at }, []))[key]
    if (moved && moved.wall === p.wall && moved.w === p.w && Math.abs(moved.center - p.center) >= 1) return { patch: { at }, snap: [] }
    // Упёрся: встаёт вплотную по ту сторону соседа по верхнему ряду.
    const ups = Object.entries(positions)
      .filter(([k, q]) => k !== key && q?.row === 'upper' && q.wall === p.wall && sign * (q.center - p.center) > 0)
      .map(([, q]) => q!)
      .sort((a, b) => sign * (a.center - b.center))
    return ups[0] ? put(ups[0].center + sign * (ups[0].w / 2 + p.w / 2)) : null
  }
  const order = resolveArrangement(state.shape, state.arrangement, state.cabinets, state.gaps)
  const present = new Set(Object.keys(positions) as ItemKey[])
  const frozen = (except: ItemKey[]) => {
    const at: NonNullable<KitchenState['at']> = {}
    for (const [k, q] of Object.entries(positions) as [ItemKey, { center: number }][]) if (!except.includes(k)) at[k] = q.center
    return at
  }
  const at = { ...frozen([key, ...companions(plan, key)]), [key]: p.center + sign * step }
  const moved = itemPositions(planner({ ...state, arrangement: order, at }, [key]))[key]
  if (moved && moved.wall === p.wall && Math.abs(moved.center - p.center) >= 1) return { patch: { arrangement: order, at }, snap: [key] }
  // Упёрся: встаёт вплотную по ту сторону соседа.
  const list = order[p.wall]
  let j = list.indexOf(key) + sign
  while (j >= 0 && j < list.length && !present.has(list[j])) j += sign
  const n = list[j] ? positions[list[j]] : undefined
  if (!n) return null
  return { patch: { arrangement: stepItem(order, key, sign, present), at: { ...frozen([key]), [key]: n.center + sign * (n.w / 2 + p.w / 2) } }, snap: [key] }
}
