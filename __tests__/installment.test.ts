import { describe, expect, it } from 'vitest'
import { adalMonthly, mbankFits, ADAL_APP_LINK } from '@/lib/installment'

describe('рассрочка на сайте (06.10)', () => {
  it('«Адал»: 2 000–40 000 сом, платёж — цена / 4 вверх до сома', () => {
    expect(adalMonthly(13900)).toBe(3475)
    expect(adalMonthly(23900)).toBe(5975)
    expect(adalMonthly(3701)).toBe(926)
    expect(adalMonthly(40000)).toBe(10000)
    expect(adalMonthly(40001)).toBeNull()
    expect(adalMonthly(1999)).toBeNull()
    expect(adalMonthly(0)).toBeNull()
  })
  it('дороже «Адал» — «МРассрочка» до 200 000, без суммы', () => {
    expect(mbankFits(42500)).toBe(true)
    expect(mbankFits(200000)).toBe(true)
    expect(mbankFits(200001)).toBe(false)
    expect(mbankFits(23900)).toBe(false)
  })
  it('кнопка ведёт в кабинет «Адал» в MBANK, как кнопка «Подключить» на mbank.kg', () => {
    expect(ADAL_APP_LINK).toBe('https://app.mbank.kg/native/adal_cabinet_page')
  })
})
