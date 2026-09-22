import { describe, expect, it } from 'vitest'
import { bonusRule } from './bonusRule'

describe('bonusRule', () => {
  it('без предела в сомах — только процент', () => {
    expect(bonusRule(10, 0, 'ru')).toBe('до 10% заказа')
  })
  it('100% и предел — только сумма', () => {
    expect(bonusRule(100, 334, 'ru')).toBe('до 334 сом за заказ')
    expect(bonusRule(100, 334, 'ky')).toBe('бир заказга 334 сомго чейин')
  })
  it('процент и предел — оба', () => {
    expect(bonusRule(50, 334, 'ru')).toBe('до 50% заказа, но не больше 334 сом')
  })
})
