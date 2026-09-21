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

import { cheaperThan } from '@/lib/assistant/budget'

describe('«дорого» — дешевле того, что предложили', () => {
  it('потолок ниже самой низкой названной цены', () => {
    expect(cheaperThan('Дорого', 'Посмотрите VELBERG VLB-6003G за 28400 сом')).toBe(28399)
    expect(cheaperThan('qimmat ekan', 'Artel VCB0316 narxi 5 900 som, Midea 6 800 som')).toBe(5899)
    expect(cheaperThan('кымбат', 'Баасы 37 400 сом')).toBe(37399)
  })
  it('без «дорого» или без цены — ничего', () => {
    expect(cheaperThan('Беру', 'за 28400 сом')).toBeNull()
    expect(cheaperThan('Дорого', 'Ассаламу алейкум! Чем помочь?')).toBeNull()
  })
})
