import { describe, expect, it } from 'vitest'
import { budgetFrom } from '@/lib/assistant/budget'

describe('бюджет покупателя', () => {
  it('понимает, как пишут на самом деле', () => {
    expect(budgetFrom('Семья 5 человек, до 30 тысяч')).toBe(30000)
    expect(budgetFrom('до 30000')).toBe(30000)
    expect(budgetFrom('до 30 000 сом')).toBe(30000)
    expect(budgetFrom('бюджет 25к')).toBe(25000)
    expect(budgetFrom('30 mingacha kir yuvish mashinasi')).toBe(30000)
    expect(budgetFrom('20 000 гача')).toBe(20000)
    expect(budgetFrom('25 миңге чейин')).toBe(25000)
    expect(budgetFrom('примерно 15 тысяч')).toBe(15000)
  })

  it('не путает с килограммами, людьми и моделями', () => {
    expect(budgetFrom('8 кг, семья 5 человек')).toBeNull()
    expect(budgetFrom('Midea MF205W80WB')).toBeNull()
    expect(budgetFrom('нужен холодильник')).toBeNull()
    expect(budgetFrom('стиралка до 8 кг')).toBeNull()
    expect(budgetFrom('телевизор до 55 дюймов')).toBeNull()
  })
})
