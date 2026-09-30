import { fitOn, itemPositions, type Narrow, type Plan, type SnapKind } from './layout'
import type { ItemKey, WallId } from './types'

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
}

/**
 * Позиция ПАЛЬЦА `cm` минус точка захвата `grab` — середина модуля; дальше
 * магнит 6 см к концам стены и краям соседей, в плане (`opposite`) — ещё к
 * краям противоположного ряда. null — модуля нет в раскладке или нет такой стены.
 */
export function previewMove(plan: Plan, key: ItemKey, wall: WallId, cm: number, grab: number, opts: { opposite?: boolean; soft?: ItemKey[] } = {}): Preview | null {
  // soft — мягкие соседи жеста (P1): предпросмотр и постановка считают по одному правилу
  const fit = fitOn(plan, key, wall, cm - grab, { opposite: opts.opposite, soft: opts.soft })
  if (!fit) return null
  const half = fit.w / 2
  const r1 = (v: number) => Math.round(Math.max(0, v) * 10) / 10
  return {
    center: fit.center,
    width: fit.w,
    wall,
    fits: fit.ok,
    snap: fit.snap,
    labels: { left: r1(fit.center - half - fit.free.from), right: r1(fit.free.to - (fit.center + half)) },
    narrow: fit.narrow,
    need: fit.need,
  }
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
