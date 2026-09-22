import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
process.env.SHOP_PAYMENT_MODE = 'mock'

import { products } from '@/data/products'
import { AFFIRM, OFFER, looksLikeQuestion, start, step } from '@/lib/telegram/order'
import { detectLang } from '@/lib/assistant/talk'
import { talkLang } from '@/lib/assistant/reply'
import { followUp } from '@/lib/assistant/followup'
import { nameFromTurns } from '@/lib/assistant/respond'
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

describe('вопрос посреди заказа (случай из WhatsApp)', () => {
  const two = products.filter((p) => p.price > 0 && p.variants.some((v) => v.stock > 0)).slice(0, 2).map((p) => p.id)

  it('на вопрос вместо номера не твердит «напишите номер»', async () => {
    await start('wa:test-q1', two, 'ky', 'Заказ из WhatsApp')
    expect(await step('wa:test-q1', 'Менин суроомо жооп берсениз', 'ky', 'ky')).toBeNull()
    // Выбор отменён — дальше отвечает консультант, а не анкета.
    expect(await step('wa:test-q1', '1', 'ky', 'ky')).toBeNull()
  })

  it('вопрос без «?» не принимает за имя', async () => {
    await start('wa:test-q2', [two[0]], 'ky', 'Заказ из WhatsApp')
    expect(await step('wa:test-q2', 'Сиздерге заказ кылсак келгенден кийин акчасын толойбузбу', 'ky', 'ky')).toBeNull()
    expect(await step('wa:test-q2', 'Айка', 'ky', 'ky')).toMatch(/Телефон/)
  })

  it('номер из списка по-прежнему работает', async () => {
    await start('wa:test-q3', two, 'ru', 'Заказ из WhatsApp')
    expect(await step('wa:test-q3', '2', 'ru', 'ru')).toMatch(/Как вас зовут/)
  })

  it('длинная фраза со словом «заказ» — вопрос, а не покупка', () => {
    expect(looksLikeQuestion('Сиздерге заказ кылсак келгенден кийин акчасын толойбузбу')).toBe(true)
    expect(looksLikeQuestion('беру')).toBe(false)
    expect(looksLikeQuestion('как заказать')).toBe(false)
  })

  it('кыргызский без ө и ү узнаёт', () => {
    expect(detectLang('Менин суроомо жооп берсениз', 'ru')).toBe('ky')
    expect(detectLang('Сиздерге заказ кылсак келгенден кийин акчасын толойбузбу', 'ru')).toBe('ky')
    expect(detectLang('Сколько стоит холодильник', 'ru')).toBe('ru')
    expect(detectLang('менинг телефоним', 'ru')).not.toBe('ky')
  })
})

describe('язык по фото и голосовому', () => {
  it('описание фото по-русски не переключает язык; подпись — переключает', () => {
    expect(talkLang([{ role: 'user', text: '[Фото] Холодильник белый Avest.\nПодпись покупателя: бул барбы' }], 'ru')).toBe('ky')
    expect(talkLang([{ role: 'user', text: 'muzlatgich kerak' }, { role: 'user', text: '[Фото] Холодильник белый Avest.' }], 'ru')).toBe('uz')
    expect(talkLang([{ role: 'user', text: '[Голосовое] салам мага муздаткыч керек' }], 'ru')).toBe('ky')
  })
})

describe('напоминание «ещё актуально?»', () => {
  it('после ссылки на оплату не напоминает', async () => {
    const r = await followUp([{ role: 'user', text: 'беру' }, { role: 'assistant', text: 'Оплатить: https://pay' }], [product.id], 'ru')
    expect(r).toEqual({ skip: 'ordered' })
  })
  it('пишет на языке покупателя и с товаром', async () => {
    const r = await followUp([{ role: 'user', text: 'muzlatgich narxi qancha' }, { role: 'assistant', text: 'x' }], [product.id], 'ru', 'Aziz')
    expect(r).toHaveProperty('text')
    const text = (r as { text: string }).text
    expect(text).toMatch(/^Aziz, /)
    expect(text).toContain(product.nameRu)
    expect(text).toContain('olaman')
  })
  it('без товара — пропуск', async () => {
    expect(await followUp([{ role: 'user', text: 'привет' }], [], 'ru')).toEqual({ skip: 'not-shown' })
  })
})

describe('имя из разговора', () => {
  it('«меня зовут», «менин атым», «mening ismim»', () => {
    expect(nameFromTurns([{ role: 'user', text: 'меня зовут азамат, нужен холодильник' }])).toBe('Азамат')
    expect(nameFromTurns([{ role: 'user', text: 'Менин атым Айка' }])).toBe('Айка')
    expect(nameFromTurns([{ role: 'user', text: "mening ismim Aziz" }])).toBe('Aziz')
  })
  it('ответ на вопрос бота «как к вам обращаться?»', () => {
    const turns = [
      { role: 'user' as const, text: 'нужна стиралка' },
      { role: 'assistant' as const, text: 'Подберу. Как к вам обращаться?' },
      { role: 'user' as const, text: 'Нурлан, нас четверо' },
    ]
    expect(nameFromTurns(turns)).toBe('Нурлан')
  })
  it('не путает «да» и числа с именем', () => {
    expect(nameFromTurns([{ role: 'assistant', text: 'Как вас зовут?' }, { role: 'user', text: 'да' }])).toBeUndefined()
    expect(nameFromTurns([{ role: 'assistant', text: 'Как вас зовут?' }, { role: 'user', text: '0555 123456' }])).toBeUndefined()
    expect(nameFromTurns([{ role: 'user', text: 'сколько стоит?' }])).toBeUndefined()
  })
})

describe('«ооба» на кыргызское предложение оформить', () => {
  it('OFFER узнаёт «буйрутманы тариздейлиби?»', () => {
    expect(OFFER.test('Эгер жаккан болсо, буйрутманы тариздейлиби? «Ооба» деп жазсаңыз')).toBe(true)
    expect(AFFIRM.test('Ооба')).toBe(true)
  })
})

describe('узбекская кириллица без особых букв (случай Мастурахон)', () => {
  it('узнаёт узбекский', () => {
    for (const q of ['Уко яхшимисиз', 'Меники канча колди', 'Канчага бердиз', 'Бизга битта бегавой керегиди', 'Канака тавсия киласиз', 'Расмини ташолесими']) {
      expect(detectLang(q, 'ru'), q).toBe('uz')
    }
    expect(detectLang('Бизга битта бегавой керегиди Канака тавсия киласиз', 'ru')).toBe('uz')
  })
  it('кыргызский и русский не ломаются', () => {
    expect(detectLang('Менин суроомо жооп берсениз', 'ru')).toBe('ky')
    expect(detectLang('Канча турат, жеткирип бересизби', 'ru')).toBe('ky')
    expect(detectLang('Сколько стоит и когда привезёте', 'ru')).toBe('ru')
  })
})
