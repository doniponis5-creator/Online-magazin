import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
process.env.SHOP_PAYMENT_MODE = 'mock'

import { products } from '@/data/products'
import { start, step } from '@/lib/telegram/order'

describe('заказ в Telegram', () => {
  it('доходит до ссылки на оплату', async () => {
    const product = products.find((p) => p.price > 0 && p.variants.some((v) => v.stock > 0))!
    const first = await start(42, [product.id], 'uz')
    expect(first).toContain(product.nameRu)

    expect(await step(42, 'Азамат', 'uz', 'ru')).toContain('ракам')
    expect(await step(42, '0555123456', 'uz', 'ru')).toContain('Каерга')
    const done = await step(42, "o'zim olaman", 'uz', 'ru')
    expect(done).toContain('Тулаш:')
    expect(done).toContain('TEST-')
  })

  it('плохой номер не пропускает дальше', async () => {
    const product = products.find((p) => p.price > 0 && p.variants.some((v) => v.stock > 0))!
    await start(43, [product.id], 'ru')
    await step(43, 'Азамат', 'ru', 'ru')
    // Слова вместо номера — это разговор, отвечает консультант; цифры не те — переспрашиваем.
    expect(await step(43, 'не скажу', 'ru', 'ru')).toBeNull()
    expect(await step(43, '123', 'ru', 'ru')).toContain('не похож')
  })
})

import { AFFIRM, BUY_INTENT, OFFER } from '@/lib/telegram/order'

describe('когда начинать оформление', () => {
  it('узнаёт намерение купить на трёх языках', () => {
    for (const text of ['ha oformit qil', 'shuni olaman', 'буду брать, оформляйте', 'zakaz qilaman', 'куда перевести деньги']) {
      expect(BUY_INTENT.test(text)).toBe(true)
    }
  })

  it('не принимает за покупку обычный вопрос', () => {
    for (const text of ['а сколько литров?', 'kafolati qancha', 'рассрочка есть?']) {
      expect(BUY_INTENT.test(text)).toBe(false)
    }
  })

  it('короткое «да» узнаётся отдельно', () => {
    expect(AFFIRM.test('ha')).toBe(true)
    expect(AFFIRM.test('да')).toBe(true)
    expect(AFFIRM.test('ооба')).toBe(true)
    expect(AFFIRM.test('а сколько стоит')).toBe(false)
  })

  it('предложение оформить заказ видно в ответе бота', () => {
    expect(OFFER.test('Доставим бесплатно. Хотите оформить заказ?')).toBe(true)
    expect(OFFER.test('Buyurtma qilasizmi?')).toBe(true)
    expect(OFFER.test('Гарантия 12 месяцев.')).toBe(false)
  })
})
