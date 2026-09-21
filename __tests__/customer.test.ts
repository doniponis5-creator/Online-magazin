import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { maxBonusSpend } from '@/lib/customer/gateway'
import { SESSION_DAYS, decodeSession, encodeSession } from '@/lib/customer/session'
import { applyBonus, type ValidatedOrder } from '@/lib/orders/order'

const order: ValidatedOrder = {
  customer: { name: 'Азиз', phone: '+996700000000' },
  delivery: { method: 'pickup', city: '', address: '', price: 0 },
  comment: '',
  lines: [{ productId: 'p', oneCId: '', code: 'p', name: 'Товар', price: 20000, qty: 1, sum: 20000 }],
  goodsTotal: 20000,
  total: 20000,
  bonus: 0,
  lang: 'ru',
}

describe('бонусы на сайте', () => {
  it('максимум — процент заказа, но не больше баланса, целые сомы', () => {
    expect(maxBonusSpend(1000, 20000, 10)).toBe(1000) // 10% = 2000, баланс 1000
    expect(maxBonusSpend(5000, 20000, 10)).toBe(2000)
    expect(maxBonusSpend(5000, 3333, 10)).toBe(333)
    expect(maxBonusSpend(0, 20000, 10)).toBe(0)
    expect(maxBonusSpend(1000, 20000, 0)).toBe(0)
  })

  it('бонусы в заказе: в пределах максимума — принимаются', () => {
    expect(applyBonus(order, 1500, 2000)?.bonus).toBe(1500)
    expect(applyBonus(order, 0, 2000)?.bonus).toBe(0)
    expect(applyBonus(order, 'мусор', 2000)?.bonus).toBe(0)
  })

  it('бонусы в заказе: больше максимума или всей суммы — отказ', () => {
    expect(applyBonus(order, 2001, 2000)).toBeNull()
    expect(applyBonus(order, 20000, 50000)).toBeNull()
  })
})

describe('сессия покупателя', () => {
  it('подписанная сессия читается обратно', () => {
    const value = encodeSession('+996700000000', 'Азиз')
    expect(decodeSession(value)).toMatchObject({ phone: '+996700000000', name: 'Азиз' })
  })

  it('подменённый телефон или истёкшая сессия не принимаются', () => {
    const value = encodeSession('+996700000000', 'Азиз')
    const [payload, signature] = value.split('.')
    const forged = Buffer.from(
      Buffer.from(payload, 'base64url').toString('utf8').replace('700000000', '555555555'),
      'utf8',
    ).toString('base64url')
    expect(decodeSession(`${forged}.${signature}`)).toBeNull()
    // срок жизни входа берём из настройки: он будет меняться, тест не должен от этого падать
    const day = 24 * 3600 * 1000
    expect(decodeSession(value, Date.now() + (SESSION_DAYS - 1) * day)).not.toBeNull()
    expect(decodeSession(value, Date.now() + (SESSION_DAYS + 1) * day)).toBeNull()
    expect(decodeSession('мусор')).toBeNull()
    expect(decodeSession(undefined)).toBeNull()
  })
})

describe('вход через WhatsApp «наоборот» (тестовый режим)', () => {
  it('код 6 цифр, номер магазина, потом «ждём» и вход', async () => {
    const { waLoginStart, waLoginCheck } = await import('@/lib/customer/gateway')
    const start = await waLoginStart('127.0.0.1')
    expect(start.code).toMatch(/^\d{6}$/)
    expect(start.waPhone).toBe('996557100505')
    const first = await waLoginCheck(start.code)
    expect(first).toEqual({ pending: true })
    await expect(waLoginCheck('000000')).rejects.toThrow(/Время вышло/)
  })
})
