import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
process.env.SHOP_PAYMENT_MODE = 'mock'

import { products } from '@/data/products'
import { fromJson } from '@/lib/assistant/answer-json'
import { parseAnswer } from '@/lib/assistant/local'
import { FULL_PAY, cancel, forgetDeposit, rememberDeposit, start, step } from '@/lib/telegram/order'

// Владелец 08.10: боится или хочет платить при получении — заклад (от 1 000 сом, сумму выбирает сам),
// товар — в такси, остаток — по второй ссылке (сервер: shop_deposit_rules.py).
const product = () => products.find((p) => p.price > 5000 && p.variants.some((v) => v.stock > 0))!

async function order(chat: number, lang: 'ru' | 'ky', between?: () => void) {
  const first = await start(chat, [product().id], lang)
  between?.()
  await step(chat, 'Азамат', lang, lang)
  await step(chat, '0555123456', lang, lang)
  const done = await step(chat, lang === 'ky' ? 'өзүм алам' : 'сам заберу', lang, lang)
  return { first, done: String(done) }
}

describe('заклад', () => {
  it('сумму из ответа модели берём, только если она не меньше 1 000', () => {
    const ok = parseAnswer(fromJson(JSON.stringify({ reply: 'Хорошо, заклад 3 000 сом. Оформляем?', audience: 'customer', deposit: 3000 })))
    expect(ok.deposit).toBe(3000)
    expect(ok.text).toBe('Хорошо, заклад 3 000 сом. Оформляем?') // служебная строка покупателю не видна
    const small = parseAnswer(fromJson(JSON.stringify({ reply: 'Заклад — от 1 000 сом.', audience: 'customer', deposit: 500 })))
    expect(small.deposit).toBeUndefined()
    expect(parseAnswer(fromJson(JSON.stringify({ reply: 'Есть.', audience: 'customer' }))).deposit).toBeUndefined()
  })

  it('согласился — заклад виден в первом шаге оформления и в итоге, со словами про такси и остаток', async () => {
    rememberDeposit(77, 2000)
    const { first, done } = await order(77, 'ky')
    expect(first).toMatch(/Заклад: 2\s000/)
    expect(done).toMatch(/Заклад 2\s000/)
    expect(done).toContain('машинага')
    expect(done).toContain('Таксини айдоочуга')
  })

  it('без заклада — как раньше: вся сумма', async () => {
    const { first, done } = await order(78, 'ru')
    expect(first).not.toContain('Заклад')
    expect(done).toContain('Оплата:')
    expect(done).not.toContain('Заклад')
  })

  it('«отмена» стирает заклад: следующий заказ — на всю сумму', async () => {
    rememberDeposit(79, 2000)
    cancel(79)
    const { done } = await order(79, 'ru')
    expect(done).not.toContain('Заклад')
  })

  it('«всё сразу оплачу» посреди оформления стирает заклад', async () => {
    rememberDeposit(80, 2000)
    const { first, done } = await order(80, 'ru', () => forgetDeposit(80))
    expect(first).toContain('Заклад')
    expect(done).not.toContain('Заклад')
  })

  it('вопрос посреди оформления заклад не стирает: повторное «да» — снова с закладом', async () => {
    rememberDeposit(82, 3000)
    await start(82, [product().id], 'ru')
    await step(82, 'а доставка сколько стоит?', 'ru', 'ru') // анкета прервалась вопросом
    const { first, done } = await order(82, 'ru')
    expect(first).toContain('Заклад')
    expect(done).toMatch(/Заклад 3\s000/)
  })

  it('открытая анкета с закладом через 3 часа к новому заказу заклад не приносит', async () => {
    const now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now - 3 * 3600 * 1000)
    rememberDeposit(83, 2000)
    await start(83, [product().id], 'ru') // анкета открыта и брошена
    clock.mockReturnValue(now)
    const { first, done } = await order(83, 'ru')
    clock.mockRestore()
    expect(first).not.toContain('Заклад')
    expect(done).not.toContain('Заклад')
  })

  it('заклад старше двух часов к новому заказу не пристаёт', async () => {
    const now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now - 3 * 3600 * 1000)
    rememberDeposit(81, 2000)
    clock.mockReturnValue(now)
    const { done } = await order(81, 'ru')
    clock.mockRestore()
    expect(done).not.toContain('Заклад')
  })

  it('«всё сразу оплачу» узнаём, «толук маалымат» — нет', () => {
    for (const t of ['толук төлөйм', 'баарын азыр төлөйм', 'оплачу полностью', 'всю сумму оплачу', 'hammasini tolayman', 'тулик тулайман'])
      expect(FULL_PAY.test(t), t).toBe(true)
    for (const t of ['толук маалымат бериңизчи', 'полностью автомат?', 'заклад 2000 берем', 'кийин толойм'])
      expect(FULL_PAY.test(t), t).toBe(false)
  })
})
