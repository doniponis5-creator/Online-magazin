import { describe, expect, it } from 'vitest'
import { carouselStyles, FEATURED_STYLES, shortList, STYLES } from '@/lib/kitchen/styles'

/**
 * Таск 06 (спецификация, истории 25, 28; Решения §6): что видно сразу —
 * карусель из 8 стилей, короткие списки отделки; остальное — по кнопке,
 * ничего из каталога не удалено.
 */
describe('карусель стилей', () => {
  it('в карусели ровно 8 стилей, отмеченных в каталоге; каталог целиком остался', () => {
    expect(FEATURED_STYLES).toHaveLength(8)
    expect(STYLES.length).toBeGreaterThan(8)
    // порядок карусели — номер в каталоге, а не порядок в списке
    const order = FEATURED_STYLES.map((s) => s.featured)
    expect(order).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
  it('значка «Новинка» у стилей больше нет', () => {
    expect(STYLES.some((s) => 'isNew' in s)).toBe(false)
  })
  it('выбранный стиль из карусели — карусель как есть; выбранный из полного списка — первым, всего по-прежнему 8', () => {
    const inside = FEATURED_STYLES[3].id
    expect(carouselStyles(inside)).toEqual(FEATURED_STYLES)
    const outside = STYLES.find((s) => !s.featured)!
    const shown = carouselStyles(outside.id)
    expect(shown).toHaveLength(8)
    expect(shown[0].id).toBe(outside.id)
    expect(shown.slice(1)).toEqual(FEATURED_STYLES.slice(0, 7))
    expect(carouselStyles(undefined)).toEqual(FEATURED_STYLES)
  })
})

describe('короткий список отделки: N сразу, выбранное всегда видно', () => {
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  it('без выбора — первые N', () => {
    expect(shortList(all, 5, () => false)).toEqual([1, 2, 3, 4, 5])
  })
  it('выбранное среди первых N — список не меняется', () => {
    expect(shortList(all, 5, (x) => x === 2)).toEqual([1, 2, 3, 4, 5])
  })
  it('выбранное дальше N — оно первое, всего по-прежнему N', () => {
    expect(shortList(all, 5, (x) => x === 9)).toEqual([9, 1, 2, 3, 4])
  })
  it('список короче N — целиком', () => {
    expect(shortList([1, 2], 5, () => false)).toEqual([1, 2])
  })
})
