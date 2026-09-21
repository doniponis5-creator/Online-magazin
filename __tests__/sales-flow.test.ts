import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
process.env.SHOP_PAYMENT_MODE = 'mock'

import { products } from '@/data/products'
import { start, step } from '@/lib/telegram/order'
import { CALL_INTENT, leadContext, leadStep, startLead } from '@/lib/assistant/leads'

const product = products.find((p) => p.price > 0 && p.variants.some((v) => v.stock > 0))!

describe('заказ в чате на сайте', () => {
  it('вошедшего покупателя не спрашивает имя и телефон', async () => {
    const first = await start('web:test-1', [product.id], 'ru', 'Заказ из чата на сайте', {
      name: 'Азамат',
      phone: '+996555123456',
    })
    expect(first).toContain(product.nameRu)
    expect(first).toMatch(/Куда везти/)
    const done = await step('web:test-1', 'заберу сам', 'ru', 'ru')
    expect(done).toContain('Оплатить:')
  })

  it('гостя спрашивает по порядку: имя, телефон, куда', async () => {
    expect(await start('web:test-2', [product.id], 'ru', 'Заказ из чата на сайте')).toMatch(/Как вас зовут/)
    expect(await step('web:test-2', 'Нурлан', 'ru', 'ru')).toMatch(/номер телефона/)
    expect(await step('web:test-2', '0700 123 456', 'ru', 'ru')).toMatch(/Куда везти/)
  })
})

describe('перезвоните мне', () => {
  it('узнаёт просьбу на трёх языках', () => {
    for (const q of ['Перезвоните мне', 'Дайте менеджера', 'menga qo\'ng\'iroq qiling', 'мага чалып коюңуз', 'odam bilan gaplashmoqchiman']) {
      expect(CALL_INTENT.test(q)).toBe(true)
    }
    expect(CALL_INTENT.test('Сколько стоит холодильник?')).toBe(false)
  })

  it('вошедшему не задаёт вопрос про номер', async () => {
    expect(await startLead('web:lead-1', 'ru', 'ctx', { phone: '+996555123456' })).toMatch(/перезвонит/)
  })

  it('гостя просит номер и не принимает мусор', async () => {
    expect(await startLead('web:lead-2', 'uz', 'ctx')).toMatch(/raqamingiz/)
    expect(await leadStep('web:lead-2', 'abc', 'uz')).toMatch(/to'g'ri emas/)
    expect(await leadStep('web:lead-2', '0555 123 456', 'uz')).toMatch(/Tayyor/)
    expect(await leadStep('web:lead-2', '0555 123 456', 'uz')).toBeNull()
  })

  it('пересказ для сотрудника: вопросы и товары', () => {
    const text = leadContext(['нужен холодильник', 'а дешевле?'], ['Midea MDRB'])
    expect(text).toContain('• нужен холодильник')
    expect(text).toContain('Смотрел: Midea MDRB')
  })
})
