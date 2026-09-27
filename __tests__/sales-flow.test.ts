import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
process.env.SHOP_PAYMENT_MODE = 'mock'

import { products } from '@/data/products'
import { AFFIRM, BUY_INTENT, OFFER, looksLikeQuestion, start, step } from '@/lib/telegram/order'
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
    expect(await startLead('web:lead-1', 'ru', 'ctx', { phone: '+996555123456' })).toMatch(/перезвонят/)
  })

  it('гостя просит номер и не принимает мусор', async () => {
    expect(await startLead('web:lead-2', 'uz', 'ctx')).toMatch(/ракамингизни/)
    expect(await leadStep('web:lead-2', 'abc', 'uz')).toMatch(/тугри эмас/)
    expect(await leadStep('web:lead-2', '0555 123 456', 'uz')).toMatch(/Тайёр/)
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
    expect(text).toContain('оламан')
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

describe('узбекские слова кириллицей в шагах заказа', () => {
  it('«оламан» — покупка, «ха» — согласие, «узим оламан» — самовывоз', () => {
    expect(BUY_INTENT.test('оламан')).toBe(true)
    expect(BUY_INTENT.test('буюртма килмокчиман')).toBe(true)
    expect(AFFIRM.test('Ха')).toBe(true)
    expect(AFFIRM.test('Хоп')).toBe(true)
    expect(OFFER.test('Буюртма килайликми? «Ха» деб ёзинг')).toBe(true)
  })
})

describe('вопрос вместо имени и телефона (случай «Есть скидка»)', () => {
  it('«Есть скидка» — не имя; «Есть скидка на товар» — не «номер не похож»', async () => {
    await start('web:test-disc', [product.id], 'ru', 'Заказ из чата на сайте')
    expect(await step('web:test-disc', 'Есть скидка', 'ru', 'ru')).toBeNull()
    expect(await step('web:test-disc', 'Азамат', 'ru', 'ru')).toMatch(/номер телефона/)
    expect(await step('web:test-disc', 'Есть скидка на товар', 'ru', 'ru')).toBeNull()
    expect(await step('web:test-disc', '0555 12', 'ru', 'ru')).toMatch(/не похож/)
    expect(await step('web:test-disc', '0555 123456', 'ru', 'ru')).toMatch(/Куда везти/)
  })
  it('обычные имена и «канча турат» не путает', () => {
    expect(looksLikeQuestion('Айгүл')).toBe(false)
    expect(looksLikeQuestion('Нурлан Асанов')).toBe(false)
    expect(looksLikeQuestion('Канча турат')).toBe(true)
    expect(looksLikeQuestion('Чегирма борми')).toBe(true)
  })
})

describe('«да, но денег пока нет» (случай Аиды)', () => {
  it('условное «ооба» не начинает заказ; «потом» посреди анкеты снимает её', async () => {
    const { DEFER } = await import('@/lib/telegram/order')
    expect(DEFER.test('Ооба алат элем азыр акчам 12500с толук эмес 5.6куну болот буюрса,толуктап алып байланышайын')).toBe(true)
    expect(DEFER.test('Толом жургузойун анан жазайын')).toBe(true)
    expect(DEFER.test('Маслахат килиб олай рахмат')).toBe(true)
    expect(DEFER.test('Ооба')).toBe(false)
    expect(DEFER.test('Нурлан')).toBe(false)
    expect(DEFER.test('айылга Колго')).toBe(false)
    await start('wa:test-defer', [product.id], 'ky', 'Заказ из WhatsApp')
    expect(await step('wa:test-defer', 'Толом жургузойун анан жазайын', 'ky', 'ky')).toBeNull()
    // Заказ снят — следующее «Айгүл» уже не имя в анкете.
    expect(await step('wa:test-defer', 'Айгүл', 'ky', 'ky')).toBeNull()
  })
  it('«Маслахат килиб олай рахмат» — узбекский, не кыргызский', () => {
    expect(detectLang('Маслахат килиб олай рахмат', 'ru')).toBe('uz')
    expect(detectLang('Адрес каерда', 'ru')).toBe('uz')
    expect(detectLang('Толовни каерга киламиз Доставка борми', 'ru')).toBe('uz')
    expect(detectLang('Ооба озумо алам, айылга Колго', 'ru')).toBe('ky')
    expect(detectLang('Чон коломдогу выпечка бышырганга конвекциясы бар духовка издеп жаттым эле', 'ru')).toBe('ky')
  })
})

describe('«Ок» после напоминания — молчим (случай Баходиржона и Чолпон)', () => {
  it('в WhatsApp «Ок»/«👍»/«рахмат» без вопроса — silent; на «оформим?» — нет', async () => {
    const { respond } = await import('@/lib/assistant/respond')
    const wa = { key: 'wa:ack-1', orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: { phone: '+996555000001' } }
    const reminder = { role: 'assistant' as const, text: 'Завтра, 25.09.2026, — день оплаты по рассрочке: 9 600 сом. Для оплаты нажмите кнопку ниже 👇' }
    for (const ack of ['Ок', 'ок.', '👍', 'Рахмат', 'Спасибо!', 'Макул', 'Тушундим']) {
      const r = await respond(wa, [reminder, { role: 'user', text: ack }], 'ru', null)
      expect(r.silent, ack).toBe(true)
    }
    const first = await respond(wa, [{ role: 'user', text: 'Ок' }], 'ru', null)
    expect(first.silent).toBe(true)
    const question = await respond({ ...wa, key: 'wa:ack-2' }, [{ role: 'assistant', text: 'Сколько человек в семье?' }, { role: 'user', text: 'Ок' }], 'ru', null)
    expect(question.silent).not.toBe(true)
  })
})

describe('«Хорошо спасибо» после прощания — не заказ (случай Юлдуз)', () => {
  it('OFFER — только вопрос; «хорошо спасибо» — не согласие; в WhatsApp молчим', async () => {
    expect(OFFER.test('Если позже решите приобрести — пишите, быстро оформим!')).toBe(false)
    expect(OFFER.test('Буйрутма бересизби?')).toBe(true)
    expect(OFFER.test('Оформим? Напишите «да» — оформлю прямо здесь.')).toBe(true)
    expect(AFFIRM.test('Хорошо спасибо')).toBe(false)
    expect(AFFIRM.test('Хорошо')).toBe(true)
    expect(AFFIRM.test('Ок, рахмат')).toBe(false)
    const { respond } = await import('@/lib/assistant/respond')
    const wa = { key: 'wa:bye-1', orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: { phone: '+996555000002', name: 'Юлдуз' } }
    const turns = [
      { role: 'assistant' as const, text: 'Юлдуз, вы смотрели Стиральная машина FLAGMAN — 21 400 сом. Ещё актуально?' },
      { role: 'user' as const, text: 'Извините, мы передумали' },
      { role: 'assistant' as const, text: 'Понял вас, Юлдуз, ничего страшного. Если позже решите приобрести технику — пишите, всегда поможем выбрать и быстро оформим!' },
      { role: 'user' as const, text: 'Хорошо спасибо' },
    ]
    const r = await respond(wa, turns, 'ru', null, undefined, [product.id])
    expect(r.silent).toBe(true)
  })
  it('«Ок» после «Чем могу помочь? …вариант.» — молчим; после «Как вас зовут?» — нет', async () => {
    const { respond } = await import('@/lib/assistant/respond')
    const wa = { key: 'wa:ok-3', orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: { phone: '+996555000003' } }
    expect((await respond(wa, [{ role: 'assistant', text: 'Чем могу помочь? Если ищете технику, подберу отличный вариант.' }, { role: 'user', text: 'Ок' }], 'ru', null)).silent).toBe(true)
    expect((await respond({ ...wa, key: 'wa:ok-4' }, [{ role: 'assistant', text: 'Как вас зовут?' }, { role: 'user', text: 'Ок' }], 'ru', null)).silent).not.toBe(true)
  })
  it('кыргызский с русскими словами — кыргызский', () => {
    expect(detectLang('Levo под заказ 5 же 5.2 кг алып келип бере аласынарбы?', 'ru')).toBe('ky')
  })
})

describe('«хочу посмотреть на сайте» вместо города — заказ снимается (случай Хусанбоя)', () => {
  it('на шаге «куда» и «адрес» не-адрес закрывает анкету', async () => {
    await start('web:test-city', [product.id], 'ru', 'Заказ из чата на сайте', { name: 'Хусанбой', phone: '+996555000009' })
    expect(await step('web:test-city', 'Отправьте то что на сайте', 'ru', 'ru')).toBeNull()
    // Анкета снята: следующее сообщение не станет адресом.
    expect(await step('web:test-city', 'Не так понял, хочу посмотреть то что в наличии на сайте', 'ru', 'ru')).toBeNull()
    // Настоящий адрес по-прежнему проходит.
    await start('web:test-city2', [product.id], 'ru', 'Заказ из чата на сайте', { name: 'Азамат', phone: '+996555000010' })
    expect(await step('web:test-city2', 'Ош', 'ru', 'ru')).toMatch(/Адрес/)
    expect(await step('web:test-city2', 'улица Ленина 12', 'ru', 'ru')).toContain('Оплатить:')
  })
})

describe('уроки из журнала WhatsApp 22–26.09', () => {
  it('«барып алам» / «озум барам» — визит, не заказ', async () => {
    const { respond } = await import('@/lib/assistant/respond')
    const wa = { key: 'wa:visit-1', orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: { phone: '+996555000020' } }
    const turns = [{ role: 'assistant' as const, text: 'Бар, 21 400 сом.' }, { role: 'user' as const, text: 'мен барып коруп алам' }]
    const r = await respond(wa, turns, 'ru', null, undefined, [product.id])
    expect(r.source).not.toBe('flow')
  })
  it('в списке выбирают моделью или ценой, не только номером', async () => {
    const two = products.filter((p) => p.price > 0 && p.variants.some((v) => v.stock > 0)).slice(0, 2)
    await start('wa:pick-2', two.map((p) => p.id), 'ky', 'Заказ из WhatsApp')
    expect(await step('wa:pick-2', `${two[1].price} сомдугун алам`, 'ky', 'ky')).toMatch(/Атыңыз ким/)
    await start('wa:pick-3', two.map((p) => p.id), 'ru', 'Заказ из WhatsApp')
    const token = (two[0].nameRu.match(/[A-Za-z0-9][A-Za-z0-9()\/-]{3,}/g) ?? []).find((t) => !/^\d+$/.test(t) && !two[1].nameRu.toLowerCase().includes(t.toLowerCase()))!
    expect(await step('wa:pick-3', token, 'ru', 'ru')).toMatch(/Как вас зовут/)
  })
  it('количество: «беру 2», «иккита», «8 кг» — не количество', async () => {
    const { wantedQty } = await import('@/lib/assistant/respond')
    expect(wantedQty('беру 2')).toBe(2)
    expect(wantedQty('2 ни заказ берет элек да')).toBe(2)
    expect(wantedQty('иккита заказ киламиз')).toBe(2)
    expect(wantedQty('8 кг алам')).toBe(1)
    expect(wantedQty('беру')).toBe(1)
    const first = await start('wa:qty-1', [product.id], 'ru', 'Заказ из WhatsApp', { name: 'Азамат', phone: '+996555000021' }, 2)
    expect(first).toContain('× 2')
  })
  it('имя «.», «А», «Клиент розничная» — не имя', async () => {
    const { cleanName } = await import('@/lib/assistant/talk')
    expect(cleanName('.')).toBeUndefined()
    expect(cleanName('А')).toBeUndefined()
    expect(cleanName('Клиент розничная')).toBeUndefined()
    expect(cleanName('Айка')).toBe('Айка')
    const r = await followUp([{ role: 'user', text: 'канча' }, { role: 'assistant', text: 'x' }], [product.id], 'ru', '.')
    expect((r as { text: string }).text).not.toMatch(/^\./)
  })
  it('«{{SWE001}}», e-mail, один знак — молчим', async () => {
    const { respond } = await import('@/lib/assistant/respond')
    const wa = { key: 'wa:junk-1', orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: { phone: '+996555000022' } }
    for (const junk of ['{{SWE001}}', 'kirulbek@gmail.com', '?', '😍']) {
      expect((await respond(wa, [{ role: 'user', text: junk }], 'ru', null)).silent, junk).toBe(true)
    }
  })
  it('узбекское приветствие и кыргызское «кандесан» — язык узнаётся', () => {
    expect(detectLang('Ассалому алекум уко йахшимисиз чарчаме ишлайапсими', 'ru')).toBe('uz')
    expect(detectLang('Ассалом алекум досм кандесан', 'ru')).toBe('ky')
    expect(detectLang('Даставка кылып саласынарбы Кара кулжага, ушул 8кг алат элем', 'ru')).toBe('ky')
  })
})
