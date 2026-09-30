import { SIZE_BANDS, sizeBand, wallLength, type SizeBand } from '@/lib/gallery/rules'
import { planKitchen } from '@/lib/kitchen/layout'
import { chosenItems, planInputOf, projectItems, projectTotal } from '@/lib/kitchen/order'
import { DEFAULT_STATE, queryFromState, SLOT_KEYS, stateFromQuery } from '@/lib/kitchen/share'
import { getStyle } from '@/lib/kitchen/styles'
import { SLOTS, type KitchenAppliance, type KitchenState, type Shape, type SlotKind } from '@/lib/kitchen/types'

/**
 * Полоса «Готовые кухни» на шаге «Форма»: размер, бюджет, лучшие из галереи
 * и открытие кухни по строке проекта. Без React и three.js — считается и в тестах.
 */

// размер — одно правило с галереей (ключи small | mid | big); из rules, не из texts — тексты галереи в бандл конструктора не едут
export { SIZE_BANDS, sizeBand, wallLength, type SizeBand }
export type StripFilter = { shape: Shape | null; size: SizeBand | null }

/** Лучшие из галереи рядом с готовыми: оценка ≥ 4 и оценок ≥ 3, до шести, в порядке сервера. */
export function topOfGallery<T extends { avg: number; count: number }>(items: readonly T[]): T[] {
  return items.filter((i) => i.avg >= 4 && i.count >= 3).slice(0, 6)
}

/**
 * Кухня из строки проекта, как по ссылке. Модели, которой больше нет в
 * каталоге, слот остаётся пустым (а не подставляется другая) — `missing`
 * говорит, где подсказать «модель закончилась — выберите другую».
 */
export function openQuery(q: string, appliances: readonly KitchenAppliance[]): { state: KitchenState; missing: SlotKind[] } {
  const known = new Map(appliances.map((a) => [a.id, a]))
  const params = new URLSearchParams(q)
  const state = stateFromQuery(params, known)
  const missing = SLOTS.filter((slot) => {
    const v = params.get(SLOT_KEYS[slot])
    return Boolean(v && v !== '-' && !known.has(v))
  })
  if (missing.length === 0) return { state, missing }
  const picks = { ...state.picks }
  for (const slot of missing) picks[slot] = null
  return { state: { ...state, picks }, missing }
}

/** Сумма техники проекта по текущим ценам — то же, что «Итого» конструктора. */
export function techSum(state: KitchenState, appliances: readonly KitchenAppliance[]): number {
  const style = getStyle(state.style)
  const plan = planKitchen(planInputOf(state, chosenItems(state.picks, appliances), []), { shelves: style.shelves })
  return projectTotal(projectItems(state, plan, appliances)).sum
}

/**
 * Кухню открыли по ссылке (`?f=…`, «Хочу такую же»), а в автосохранении
 * (`kp-last`) — другая своя кухня: true — сначала положить её в «Мои варианты»,
 * иначе автосохранение через 400 мс её перезапишет.
 */
export function keepOnLink(last: KitchenState | null, next: KitchenState): boolean {
  if (!last) return false
  const q = queryFromState(last)
  return q !== queryFromState(DEFAULT_STATE) && q !== queryFromState(next)
}
