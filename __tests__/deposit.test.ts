import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
process.env.SHOP_PAYMENT_MODE = 'mock'

import { products } from '@/data/products'
import { formatSom } from '@/lib/format'
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

// 08.10, сайт, Баткен: бот уступил 4% и согласился на заклад 1 000 («1000 оа»), а ссылка ушла на 23 900 — на всю цену.
describe('скидка и заклад из разговора — в ссылке на оплату', () => {
  const plain = () => products.find((p) => p.price > 5000 && !p.sale && !(p.oldPrice && p.oldPrice > p.price) && p.variants.some((v) => v.stock > 0))!

  it('сумма заклада из ответа покупателя и «да» на наш вопрос', async () => {
    const { depositFromReply } = await import('@/lib/telegram/order')
    const bot = 'Заклад 1 000 сомдон башталат. 1 000 сом бере аласызбы?'
    expect(depositFromReply('1000 оа', bot)).toBe(1000)
    expect(depositFromReply('оа', bot)).toBe(1000)
    expect(depositFromReply('2 000 берем', 'Канча заклад бересиз?')).toBe(2000)
    expect(depositFromReply('900 сом берем пока что', 'Канча заклад бересиз?')).toBeUndefined()
    expect(depositFromReply('0555 123 456', bot)).toBeUndefined()          // телефон — не сумма
    expect(depositFromReply('1000 оа', 'Тариздейлиби?')).toBeUndefined()  // разговор не о закладе
  })

  it('скидка из текста бота и цена «вниз до 10 сом»', async () => {
    const { discountFromText, discounted } = await import('@/lib/telegram/order')
    expect(discountFromText('Ооба, 4% арзандатуу менен 22 940 сом болот.')).toBe(4)
    expect(discountFromText('Сизга 2% чегирма килиб беришимиз мумкин, 23 420 сом булади.')).toBe(2)
    expect(discountFromText('Больше 5% скидку дать не можем.')).toBeUndefined()   // отказ без суммы — не скидка
    expect(discountFromText('Скидка 10% невозможна')).toBeUndefined()        // больше 5% не берём
    expect(discountFromText('Кепилдик 3 жыл, 100% оригинал')).toBeUndefined()
    expect(discounted(23900, 4)).toBe(22940)
  })

  it('разговор целиком: «5 килип бер» → 4%, «1000 оа» → заклад; ссылка — 22 940 и заклад 1 000', async () => {
    const p = plain()
    vi.resetModules()
    vi.doMock('@/lib/assistant/reply', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/reply')>()),
      answer: async () => ({ text: 'Ооба, 4% арзандатуу менен болот. Тариздейлиби?', products: [], source: 'gemini' as const, audience: 'customer' as const, discount: 4 }),
    }))
    const { respond } = await import('@/lib/assistant/respond')
    const flow = await import('@/lib/telegram/order')
    const site = { key: `web:batken-${Math.random()}`, orderSource: 'Заказ из чата на сайте', leadChannel: 'site' as const, known: {} }
    const u = (text: string) => ({ role: 'user' as const, text })
    const b = (text: string) => ({ role: 'assistant' as const, text })
    await respond(site, [u('идиш жуугуч канча'), b(`${p.nameRu} — ${p.price} сом`), u('5 килип бер')], 'ky', null, undefined, [p.id])
    const first = await respond(site, [u('5 килип бер'), b('Ооба, 4% арзандатуу менен болот. Тариздейлиби?'), u('заклад берип турам болобу'),
      b('Заклад 1 000 сомдон башталат. 1 000 сом бере аласызбы?'), u('1000 оа')], 'ky', null, undefined, [p.id])
    vi.doUnmock('@/lib/assistant/reply')
    const price = flow.discounted(p.price, 4)
    expect(first.text).toContain(formatSom(price))
    expect(first.text).toMatch(/Заклад: 1\s000/)
    await flow.step(site.key, 'Дони', 'ky', 'ky')
    await flow.step(site.key, '0555123456', 'ky', 'ky')
    const done = String(await flow.step(site.key, 'өзүм алам', 'ky', 'ky'))
    vi.resetModules()
    expect(done).toContain(formatSom(price))          // заказ на цену со скидкой
    expect(done).toMatch(/Заклад 1\s000/)             // и ссылка — на заклад
    expect(done).toContain(formatSom(price - 1000))   // остаток считается от цены со скидкой
  })

  it('на товар со скидкой или акцией торговая скидка не ложится', async () => {
    const { discountable } = await import('@/lib/telegram/order')
    const sale = products.find((p) => p.oldPrice && p.oldPrice > p.price)
    if (sale) expect(discountable(sale)).toBe(false)
    expect(discountable(plain())).toBe(true)
  })
})

// 08.10, сайт, сушилка KEREMET 3 000: бот «Майли, 2 900 сом килиб бераман», а ссылка ушла на 2 910 (3 % вниз до 10);
// «2900 га берилар» на шаге имени стало именем.
describe('договорная цена из торга', () => {
  const plain = () => products.find((p) => p.price > 5000 && !p.sale && !(p.oldPrice && p.oldPrice > p.price) && p.variants.some((v) => v.stock > 0))!

  it('договорная цена точнее процента, но не дешевле −5 %', async () => {
    const { bargainPrice } = await import('@/lib/telegram/order')
    const p = { ...plain(), price: 3000 }
    expect(bargainPrice(p, { pct: 3, price: 2900 })).toBe(2900)
    expect(bargainPrice(p, { pct: 3 })).toBe(2910)
    expect(bargainPrice(p, { price: 2500 })).toBe(3000)            // −17 % — не берём
    expect(bargainPrice(p, { price: 3000 })).toBe(3000)            // «цена» без уступки — ничего не меняет
    expect(bargainPrice({ ...p, oldPrice: 3500 }, { price: 2900 })).toBe(3000) // товар со скидкой — цена сайта
  })

  it('«2900 га берилар» и «боладими» на шаге имени — не имя', async () => {
    const flow = await import('@/lib/telegram/order')
    await flow.start(91, [plain().id], 'uz')
    expect(await flow.step(91, '2900 га берилар', 'uz', 'ru')).toBeNull()
    expect(await flow.step(91, 'боладими', 'uz', 'ru')).toBeNull()
    expect(String(await flow.step(91, 'Дони', 'uz', 'ru'))).toMatch(/[Тт]елефон/)
    flow.cancel(91)
  })

  it('поле price ответа → анкета и итог на договорную цену', async () => {
    const p = plain()
    const deal = Math.ceil(p.price * 0.97 / 100) * 100 - 100   // «круглая» цена в пределах −5 %
    vi.resetModules()
    vi.doMock('@/lib/assistant/reply', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/reply')>()),
      answer: async () => ({ text: `Майли, ${deal} сом килиб бераман.`, products: [], source: 'gemini' as const, audience: 'customer' as const, price: deal }),
    }))
    const { respond } = await import('@/lib/assistant/respond')
    const flow = await import('@/lib/telegram/order')
    const site = { key: `web:dryer-${Math.random()}`, orderSource: 'Заказ из чата на сайте', leadChannel: 'site' as const, known: {} }
    await respond(site, [{ role: 'user', text: `${deal} га берилар` }], 'ru', null, undefined, [p.id])
    vi.doUnmock('@/lib/assistant/reply')
    const first = await flow.start(site.key, [p.id], 'uz')
    expect(first).toContain(formatSom(deal))
    await flow.step(site.key, 'Дони', 'uz', 'ru')
    await flow.step(site.key, '0555123456', 'uz', 'ru')
    const done = String(await flow.step(site.key, 'узим оламан', 'uz', 'ru'))
    vi.resetModules()
    expect(done).toContain(formatSom(deal))
  })
})

describe('вопрос посреди анкеты — в конце спрашиваем шаг анкеты', () => {
  it('модель просила имя, анкета ждёт телефон — покупатель видит вопрос анкеты', async () => {
    const { withPending } = await import('@/lib/telegram/order')
    expect(withPending('Оплата по ссылке из банка. Исмингизни ёзинг?', 'Телефон ракамингиз?')).toBe('Оплата по ссылке из банка. Телефон ракамингиз?')
    expect(withPending('Майли, 2 900 сом килиб бераман.', 'Телефон ракамингиз?')).toBe('Майли, 2 900 сом килиб бераман. Телефон ракамингиз?')
    expect(withPending('Заклад 1 000 сомдон. Канча заклад бересиз?', 'Телефон?')).toBe('Заклад 1 000 сомдон. Канча заклад бересиз?')
  })
})

describe('аудит 08.10 вечер', () => {
  const plain = () => products.find((p) => p.price > 5000 && !p.sale && !(p.oldPrice && p.oldPrice > p.price) && p.variants.some((v) => v.stock > 0))!
  it('номер дома в адресе — не заклад', async () => {
    const { depositFromReply } = await import('@/lib/telegram/order')
    const bot = 'MIDEA — 23 900 сом.\nЗаклад: 1 000 сом — калганы товар таксиге жүктөлгөндө. Кайда жеткирели?'
    expect(depositFromReply('Араван, Ош-3000 көчөсү 12', bot, true)).toBeUndefined()
    expect(depositFromReply('2000', 'Түшүнөм. Канча заклад бересиз?', true)).toBe(2000)
  })
  it('скидка на товар A к товару B не переходит', async () => {
    const flow = await import('@/lib/telegram/order')
    const [a, b] = products.filter((p) => p.price > 5000 && flow.discountable(p) && p.variants.some((v) => v.stock > 0))
    flow.rememberDiscount(95, 4, undefined, { productId: a.id })
    const first = await flow.start(95, [b.id], 'ru')
    expect(first).toContain(formatSom(b.price))
    expect(first).not.toContain('со скидкой')
    flow.cancel(95)
  })
  it('«алып бериңиз» на шаге адреса — адрес, заказ не теряется', async () => {
    const flow = await import('@/lib/telegram/order')
    await flow.start(96, [plain().id], 'ky', 'Заказ', { name: 'Азамат', phone: '+996555123456' })
    const answer = await flow.step(96, 'Кара-Суу, алып бериңиз', 'ky', 'ky')
    expect(answer).not.toBeNull()
    flow.cancel(96)
  })
})
