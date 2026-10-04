import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
process.env.SHOP_PAYMENT_MODE = 'mock'

import { products } from '@/data/products'
import { AFFIRM, BUY_INTENT, OFFER, looksLikeQuestion, shortName, start, step } from '@/lib/telegram/order'
import { detectLang } from '@/lib/assistant/talk'
import { talkLang } from '@/lib/assistant/reply'
import { followUp, spokenName } from '@/lib/assistant/followup'
import { nameFromTurns } from '@/lib/assistant/respond'
import { CALL_INTENT, leadContext, leadStep, startLead } from '@/lib/assistant/leads'

const product = products.find((p) => p.price > 0 && p.variants.some((v) => v.stock > 0))!

describe('заказ в чате на сайте', () => {
  it('вошедшего покупателя не спрашивает имя и телефон', async () => {
    const first = await start('web:test-1', [product.id], 'ru', 'Заказ из чата на сайте', {
      name: 'Азамат',
      phone: '+996555123456',
    })
    expect(first).toContain(shortName(product.nameRu))
    expect(first).toMatch(/Куда привезти/)
    const done = await step('web:test-1', 'заберу сам', 'ru', 'ru')
    expect(done).toContain('Оплата:')
  })

  it('гостя спрашивает по порядку: имя, телефон, куда', async () => {
    expect(await start('web:test-2', [product.id], 'ru', 'Заказ из чата на сайте')).toMatch(/Как вас зовут/)
    expect(await step('web:test-2', 'Нурлан', 'ru', 'ru')).toMatch(/номер телефона/i)
    expect(await step('web:test-2', '0700 123 456', 'ru', 'ru')).toMatch(/Куда привезти/)
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
    expect(await startLead('web:lead-1', 'ru', 'ctx', { phone: '+996555123456' })).toMatch(/позвоним/)
  })

  it('гостя просит номер и не принимает мусор', async () => {
    expect(await startLead('web:lead-2', 'uz', 'ctx')).toMatch(/ракамингиз/)
    expect(await leadStep('web:lead-2', 'abc', 'uz')).toMatch(/тугри эмас/)
    expect(await leadStep('web:lead-2', '0555 123 456', 'uz')).toMatch(/кунгирок киламиз/)
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
    // Имя не ставим: в телефоне владельца оно бывает «Жанатим. Онам», «Ааааааа».
    expect(text).not.toMatch(/^Aziz/)
    expect(text).toContain(spokenName(product.nameRu))
    expect(text).toContain('савол колдими')
    // Напоминание не торопит с оформлением (владелец 03.10).
    expect(text).not.toMatch(/расмийлаштир|оформ/)
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
    expect(await step('web:test-disc', 'Азамат', 'ru', 'ru')).toMatch(/номер телефона/i)
    expect(await step('web:test-disc', 'Есть скидка на товар', 'ru', 'ru')).toBeNull()
    expect(await step('web:test-disc', '0555 12', 'ru', 'ru')).toMatch(/не прошёл/)
    expect(await step('web:test-disc', '0555 123456', 'ru', 'ru')).toMatch(/Куда привезти/)
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
    expect(await step('web:test-city2', 'Ош', 'ru', 'ru')).toMatch(/Улица и дом/)
    expect(await step('web:test-city2', 'улица Ленина 12', 'ru', 'ru')).toContain('Оплата:')
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
    expect(detectLang('Суротун жонотчу укам, 8 кг стиральный', 'ru')).toBe('ky')
  })
})

describe('аудит 26–28.09: WhatsApp', () => {
  const wa = (key: string) => ({ key, orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: { phone: '+996555000030' } })

  it('«Ок» и «{{SWE001}}» — молчим, но чат не глушим; чужой автоответ и эхо — глушим', async () => {
    const { respond } = await import('@/lib/assistant/respond')
    const junk = await respond(wa('wa:a1'), [{ role: 'user', text: '{{SWE001}}' }], 'ru', null)
    expect(junk.silent).toBe(true)
    expect(junk.mute).not.toBe(true)
    const ok = await respond(wa('wa:a2'), [{ role: 'user', text: 'Ок' }], 'ru', null)
    expect(ok.mute).not.toBe(true)
    const bot = await respond(wa('wa:a3'), [{ role: 'user', text: 'Добро пожаловать! Спасибо за обращение в Мухаммадумар! Чем мы можем вам помочь?' }], 'ru', null)
    expect(bot.silent && bot.mute).toBe(true)
    const echo = await respond(wa('wa:a4'), [{ role: 'assistant', text: 'Тушундим, руководствога айтаман.' }, { role: 'user', text: 'Тушундим, руководствога айтаман.' }], 'ru', null)
    expect(echo.silent && echo.mute).toBe(true)
  })

  it('номер телефона после показа товара — начинаем заказ', async () => {
    const { respond } = await import('@/lib/assistant/respond')
    const r = await respond(wa('wa:a5'), [{ role: 'assistant', text: 'UAKEEN ZL-940, 13 900 сом. Буйрутма кылабызбы?' }, { role: 'user', text: '0700441154 синий' }], 'ky', null, undefined, [product.id])
    expect(r.source).toBe('flow')
    expect(r.text).toContain(shortName(product.nameRu))
  })

  it('полный адрес на шаге «куда» — сразу заказ; «озум алам» на шаге «адрес» — самовывоз', async () => {
    await start('wa:a6', [product.id], 'ky', 'Заказ из WhatsApp', { name: 'Айгүл', phone: '+996555000031' })
    expect(await step('wa:a6', 'Ош шаары Араван району жаны арык айылы.Айтиев жоро кочосу 20 уй', 'ky', 'ky')).toMatch(/Рахмат! ✅/)
    await start('wa:a7', [product.id], 'ky', 'Заказ из WhatsApp', { name: 'Айгүл', phone: '+996555000032' })
    expect(await step('wa:a7', 'Ош', 'ky', 'ky')).toMatch(/Көчө жана үй/)
    const done = await step('wa:a7', 'Озум алам', 'ky', 'ky')
    expect(done).toMatch(/Рахмат! ✅/)
  })

  it('«Доставкасын айтып койгулачы Таласка» на шаге «адрес» — не адрес', async () => {
    await start('wa:a8', [product.id], 'ky', 'Заказ из WhatsApp', { name: 'Турдакун', phone: '+996555000033' })
    expect(await step('wa:a8', 'Талас', 'ky', 'ky')).toMatch(/Көчө жана үй/)
    expect(await step('wa:a8', 'Доставкасын айтып койгулачы Таласка', 'ky', 'ky')).toBeNull()
  })

  it('язык: кыргызский без примет — по разговору; вопросительное «-бы/-бу»', async () => {
    const { talkLang } = await import('@/lib/assistant/reply')
    const turns = [
      { role: 'user' as const, text: 'Ооба, Талас. Эртең төлөйм' },
      { role: 'assistant' as const, text: '…' },
      { role: 'user' as const, text: 'Доставкасын айтып койгулачы Таласка' },
    ]
    expect(talkLang(turns, 'ru')).toBe('ky')
    expect(detectLang('Рассрочка кандай болуп калат', 'ru')).toBe('ky')
    expect(talkLang([{ role: 'user', text: 'Мына озубузду араванбы же оштобу' }], 'ru')).toBe('ky')
    expect(talkLang([{ role: 'user', text: 'Kara baltada barby flial' }, { role: 'user', text: 'Stralnyi mašina 8 kg' }], 'ru')).toBe('ky')
    expect(talkLang([{ role: 'user', text: 'Где купить грибы и зубы чистить?' }], 'ru')).toBe('ru')
  })
})

describe('без кодовых слов: «да» на «Оформляем?» и «Позвонить вам?»', () => {
  it('«Оформляем?» → «ооба» начинает заказ; «Позвонить вам?» → «да» — заявка на звонок', async () => {
    const { respond } = await import('@/lib/assistant/respond')
    const wa = (key: string) => ({ key, orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: { phone: '+996555000040' } })
    const buy = await respond(wa('wa:n1'), [{ role: 'assistant', text: 'Флагман 8 кг, 21 400 сом. Оформляем?' }, { role: 'user', text: 'Ооба' }], 'ky', null, undefined, [product.id])
    expect(buy.source).toBe('flow')
    expect(buy.text).toContain(shortName(product.nameRu))
    const call = await respond({ ...wa('wa:n2'), known: {} }, [{ role: 'assistant', text: 'Точно не скажу. Позвонить вам?' }, { role: 'user', text: 'Да' }], 'ru', null)
    expect(call.source).toBe('flow')
    expect(call.text).toMatch(/Ваш номер телефона/)
  })
  it('в списке — «второй», «экинчиси»', async () => {
    const two = products.filter((p) => p.price > 0 && p.variants.some((v) => v.stock > 0)).slice(0, 2)
    await start('wa:n3', two.map((p) => p.id), 'ru', 'Заказ из WhatsApp')
    expect(await step('wa:n3', 'второй', 'ru', 'ru')).toMatch(/Как вас зовут/)
    await start('wa:n4', two.map((p) => p.id), 'ky', 'Заказ из WhatsApp')
    expect(await step('wa:n4', 'экинчисин', 'ky', 'ky')).toMatch(/Атыңыз ким/)
  })
  it('короткое имя: без «Стиральная машина»', () => {
    expect(shortName('Стиральная машина FLAGMAN AV-80MXLB(BG)')).toBe('FLAGMAN AV-80MXLB(BG)')
    expect(shortName('Холодильник* TOEAR BCD-220')).toBe('TOEAR BCD-220')
    expect(shortName('Электро Эндуро мини')).toBe('Электро Эндуро мини')
  })
})

describe('аудит 28–29.09: звонок обещан — заявка ушла; номер не спрашиваем; язык', () => {
  const wa = (key: string) => ({ key, orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: { phone: '+996555000050' } })

  it('«Сизге чалып түшүндүрүп берелиби?» → «Обаа» / «Оа» — заявка на звонок (flow)', async () => {
    const { respond } = await import('@/lib/assistant/respond')
    for (const [q, a, key] of [
      ['Бул боюнча так маалымат жок. Сизге чалып түшүндүрүп берелиби?', 'Обаа', 'wa:c1'],
      ['Так күнүн айта албайм. Сизге чалып берейинби?', 'Оа', 'wa:c2'],
      ['Экран алмаштыруу боюнча тактайм. Сизге чалып беришин сурайынбы?', 'Макул', 'wa:c3'],
    ] as const) {
      const r = await respond(wa(key), [{ role: 'assistant', text: q }, { role: 'user', text: a }], 'ky', null)
      expect(r.source, a).toBe('flow')
      expect(r.handoff, a).toBe(true)
    }
  })

  it('номер «чтобы позвонили» — не заказ', async () => {
    const { respond } = await import('@/lib/assistant/respond')
    const r = await respond(wa('wa:c4'), [{ role: 'assistant', text: 'Руководство сизге байланышуусу үчүн номериңизди калтырып коюңуз.' }, { role: 'user', text: '0220015314' }], 'ky', null, undefined, [product.id])
    expect(r.text).not.toContain(shortName(product.nameRu))
  })

  it('язык: «Пул тушдими», «нечпул шулар», «Nimaligiga qiziqdim» — узбекский; «Айлык тушпой атат» — кыргызский', () => {
    expect(detectLang('Пул тушдими', 'ru')).toBe('uz')
    expect(detectLang('Ассалом алейкум ука нечпул шулар?', 'ru')).toBe('uz')
    expect(detectLang('Nimaligiga qiziqdim', 'ru')).toBe('uz')
    expect(talkLang([{ role: 'user', text: 'Айлык тушпой атат тушсоле котором' }], 'ru')).toBe('ky')
    expect(talkLang([{ role: 'user', text: 'Холодильник' }], 'ru')).toBe('ru')
    expect(talkLang([{ role: 'user', text: 'Стиральный машина нужна' }], 'ru')).toBe('ru')
  })

  it('«[Ответ на фото: …]» не сбивает язык', () => {
    expect(talkLang([{ role: 'user', text: '[Ответ на фото: Посудомоечная машина, белая]\nНима бу?' }], 'ru')).toBe('uz')
  })
})

describe('аудит 30.09: «макул, но сначала спрошу» — не заявка; язык; отказ', () => {
  it('«Макул эжемен сурап көрөйүн» — не согласие на звонок', () => {
    for (const q of ['Макул эжемен сурап көрөйүн', 'Хорошо, посоветуюсь с женой', 'Да, спрошу у мамы', 'Макул, апам менен кеңешейин']) {
      expect(AFFIRM.test(q), q).toBe(false)
    }
    for (const q of ['Макул', 'Ооба', 'Да', 'хоп']) expect(AFFIRM.test(q), q).toBe(true)
  })

  it('«Кыскасы в наличии бар ээ? …» — кыргызский, одно русское «в наличии» не решает', () => {
    const q = 'Кыскасы в наличии бар ээ? Мен размерлерин билейин. Адресинер кандай?'
    expect(talkLang([{ role: 'user', text: q }], 'ru')).toBe('ky')
  })

  it('«QR код боса ям болорад» без примет — язык последнего ответа бота (кыргызский), не русский', () => {
    const turns = [
      { role: 'user' as const, text: 'Карта номериларди ташапкойин' },
      { role: 'assistant' as const, text: 'Төлөм сайтта буйрутма бергенден кийин QR-код же банк тиркемеси аркылуу жүргүзүлөт. Кайсы товарды карайын дедиңиз эле?' },
      { role: 'user' as const, text: 'QR код боса ям болорад' },
    ]
    expect(talkLang(turns, 'ru')).toBe('ky')
  })

  it('«А жок рахмат» — повторно «чалып берейинби?» не предлагаем', async () => {
    vi.resetModules()
    vi.doMock('@/lib/assistant/reply', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/reply')>()),
      answer: async () => ({ text: 'Макул, ыңгайлуу болгондо жазыңыз. Бир суроо болсо, чалып берейинби?', products: [], source: 'gemini' as const }),
    }))
    const { respond } = await import('@/lib/assistant/respond')
    const wa = { key: 'wa:d1', orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: { phone: '+996555000051' } }
    const r = await respond(wa, [{ role: 'assistant', text: 'Тариздейлиби?' }, { role: 'user', text: 'А жок рахмат' }], 'ky', null)
    expect(r.text).toBe('Макул, ыңгайлуу болгондо жазыңыз.')
    vi.doUnmock('@/lib/assistant/reply')
    vi.resetModules()
  })

  it('«Родной», «укам» без вопроса — бот молчит', async () => {
    const { respond } = await import('@/lib/assistant/respond')
    const wa = { key: 'wa:d2', orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: { phone: '+996555000052' } }
    for (const q of ['Радной', 'Родной', 'Укам']) {
      const r = await respond(wa, [{ role: 'user', text: q }], 'ru', null)
      expect(r.silent, q).toBe(true)
    }
  })
})

describe('аудит 01.10: вопрос после «макул» — не звонок; жалоба доходит до руководства', () => {
  const wa = (key: string) => ({ key, orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: { phone: '+996555000060' } })

  it('«Макул мен 9 жаштамын чоңдору барбы» на «Сизге чалып берейинби?» — заявки нет, отвечает модель', async () => {
    vi.resetModules()
    vi.doMock('@/lib/assistant/reply', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/reply')>()),
      answer: async () => ({ text: 'Чоңураагы бар: Мотоцикл спорт 22 100 сом. Тариздейлиби?', products: [], source: 'gemini' as const }),
    }))
    const { respond } = await import('@/lib/assistant/respond')
    const r = await respond(wa('wa:e1'), [{ role: 'assistant', text: 'Чоң моделдер тууралуу руководство тактап берет. Сизге чалып берейинби?' }, { role: 'user', text: 'Макул мен 9 жаштамын чоңдору барбы' }], 'ky', null)
    expect(r.source).toBe('gemini')
    expect(r.handoff).toBeFalsy()
    vi.doUnmock('@/lib/assistant/reply')
    vi.resetModules()
  })

  it('«Хозир руководствога етказаман…» — заявка уходит (handoff)', async () => {
    vi.resetModules()
    vi.doMock('@/lib/assistant/reply', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/reply')>()),
      answer: async () => ({ text: 'Тушундим. Хозир руководствога етказаман, сизга хабар беришади.', products: [], source: 'gemini' as const, audience: 'customer' as const }),
    }))
    const { respond } = await import('@/lib/assistant/respond')
    const r = await respond(wa('wa:e2'), [{ role: 'user', text: 'Стиралкани 3 кундан бери карамеди, нима килелик' }], 'ru', null)
    expect(r.handoff).toBe(true)
    vi.doUnmock('@/lib/assistant/reply')
    vi.resetModules()
  })
})

describe('склад в Бишкеке (01.10)', () => {
  it('в правилах: адрес, номер и только FLAGMAN, HANTAJI, KLEO, IDEAL', async () => {
    const { storePolicy } = await import('@/lib/assistant/policy')
    const p = storePolicy()
    expect(p).toContain('Советский тупик, 1')
    expect(p).toContain('0557100505')
    expect(p).toMatch(/FLAGMAN, HANTAJI, KLEO, IDEAL/)
  })

  it('адрес магазина или склада — с картой; чужие ссылки вырезаются', async () => {
    const { houseStyle, STORE_MAP, BISHKEK_MAP } = await import('@/lib/assistant/reply')
    expect(houseStyle('Дареги: Араван району, Ош-3000 көчөсү, 86.', 'ky')).toContain(STORE_MAP)
    expect(houseStyle('Дареги: Советский тупик, 1 — Б1 склад.', 'ky')).toContain(BISHKEK_MAP)
    const twice = houseStyle(`Ош-3000 көчөсү, 86. ${STORE_MAP}`, 'ky')
    expect(twice.split(STORE_MAP).length - 1).toBe(1)
    expect(houseStyle('Смотрите https://smarket.kg/ru/product/cb-1', 'ru')).not.toMatch(/https?:/)
    expect(houseStyle('Холодильник есть, 16 900 сом.', 'ru')).not.toMatch(/https?:/)
  })
})

describe('аудит 01.10 (день): очередь сообщений, оплата в анкете, язык цитаты и приветствия', () => {
  const wa = (key: string) => ({ key, orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: { phone: '+996555000080', name: 'Нурсеит' } })

  it('«Адрес скиньте» + «Или местоположение» + «?» — не мусор, отвечает модель', async () => {
    vi.resetModules()
    vi.doMock('@/lib/assistant/reply', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/reply')>()),
      answer: async () => ({ text: 'Адрес: Араванский район, улица Ош-3000, 86.', products: [], source: 'gemini' as const, audience: 'customer' as const }),
    }))
    const { respond } = await import('@/lib/assistant/respond')
    const r = await respond(wa('wa:f1'), [
      { role: 'assistant', text: 'Поздравляем с днём рождения!' },
      { role: 'user', text: 'Адрес можете скинуть пожалуйста' },
      { role: 'user', text: 'Или местоположение' },
      { role: 'user', text: '?' },
    ], 'ru', null)
    expect(r.silent).toBeFalsy()
    expect(r.text).toContain('Ош-3000')
    vi.doUnmock('@/lib/assistant/reply')
    vi.resetModules()
  })

  it('один «?» или «Ок» после ответа бота — по-прежнему тишина', async () => {
    const { respond } = await import('@/lib/assistant/respond')
    for (const q of ['?', 'Ок']) {
      const r = await respond(wa('wa:f2'), [{ role: 'assistant', text: 'Готово.' }, { role: 'user', text: q }], 'ru', null)
      expect(r.silent, q).toBe(true)
    }
  })

  it('«Кызыл-кыя шаарына…» + «Мбанк номер жоноткуло» на «Кайда жеткирели?» — город Кызыл-Кыя, не «Мбанк»', async () => {
    const { respond } = await import('@/lib/assistant/respond')
    const first = await respond(wa('wa:f3'), [{ role: 'assistant', text: `${product.nameRu}. Тариздейлиби?` }, { role: 'user', text: 'Болду алам' }], 'ky', null, undefined, [product.id])
    expect(first.text).toMatch(/Кайда жеткирели/)
    const r = await respond(wa('wa:f3'), [
      { role: 'assistant', text: first.text },
      { role: 'user', text: 'Кызыл-кыя шаарына даставка кылып берсениздер жакшы болот' },
      { role: 'user', text: 'Мбанк номер жоноткуло' },
    ], 'ky', null, undefined, [product.id])
    expect(r.text).toMatch(/Көчө жана үй/)
  })

  it('одно «Мбанк номер жоноткуло» на шаге «куда» — объяснить оплату и спросить снова', async () => {
    const { start, step } = await import('@/lib/telegram/order')
    await start('wa:f4', [product.id], 'ky', 'Заказ из WhatsApp', { name: 'Нурсеит', phone: '+996555000081' })
    const r = await step('wa:f4', 'Мбанк номер жоноткуло', 'ky', 'ru')
    expect(r).toMatch(/QR-код/)
    expect(r).toMatch(/Кайда жеткирели/)
  })

  it('язык: «[Ответ на фото: Ушул мото дагы барбы] ?» — кыргызский; приветствия', () => {
    expect(talkLang([{ role: 'user', text: '[Ответ на фото: Ушул мото дагы барбы] ?' }], 'ru')).toBe('ky')
    expect(talkLang([{ role: 'user', text: '[Ответ на фото: На фото красный мотоцикл] ?' }], 'ru')).toBe('ru')
    expect(detectLang('Ассалом алейкум', 'ru')).toBe('uz')
    expect(detectLang('Ассалому алейкум', 'ru')).toBe('uz')
    expect(detectLang('Ассаламу алейкум', 'ru')).toBe('ky')
  })

  it('в промпте: сроки не обещать, разрешения «тактап берейинби?» не спрашивать', async () => {
    const { systemInstruction } = await import('@/lib/assistant/prompt')
    const text = systemInstruction('ru', null, 'ky', [], '', '', undefined, null)
    expect(text).toMatch(/эртең келет/)
    expect(text).toMatch(/тактап берейинби/)
  })
})

describe('аудит 01.10 вечер (…8989): цитата, вопрос в очереди, наличные', () => {
  const wa = (key: string) => ({ key, orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: { phone: '+996555000090', name: 'Тест' } })

  it('ответ цитатой на «Кайда жеткирели?» — город принят, анкета не начинается заново', async () => {
    const { respond } = await import('@/lib/assistant/respond')
    const first = await respond(wa('wa:g1'), [{ role: 'assistant', text: `${product.nameRu}. Тариздейлиби?` }, { role: 'user', text: 'Ооба' }], 'ky', null, undefined, [product.id])
    expect(first.text).toMatch(/Кайда жеткирели/)
    const r = await respond(wa('wa:g1'), [
      { role: 'assistant', text: first.text },
      { role: 'user', text: `[Ответ на сообщение: ${first.text}]\nУчкун айылына жеткирип бериң` },
    ], 'ky', null, undefined, [product.id])
    expect(r.text).toMatch(/Көчө жана үй/)
  })

  it('«Акчасын алып келгенде берсем болобу» + «Оа» — сначала ответ на вопрос, не анкета', async () => {
    vi.resetModules()
    vi.doMock('@/lib/assistant/reply', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/reply')>()),
      answer: async () => ({ text: 'Жок, алдын ала төлөм гана. Тариздейлиби?', products: [], source: 'gemini' as const, audience: 'customer' as const }),
    }))
    const { respond } = await import('@/lib/assistant/respond')
    const r = await respond(wa('wa:g2'), [
      { role: 'assistant', text: 'Тариздейлиби?' },
      { role: 'user', text: 'Акчасын алып келгенде берсем болобу' },
      { role: 'user', text: 'Оа' },
    ], 'ky', null, undefined, [product.id])
    expect(r.source).toBe('gemini')
    vi.doUnmock('@/lib/assistant/reply')
    vi.resetModules()
  })

  it('«Мен наличка алам» — не заказ', async () => {
    vi.resetModules()
    vi.doMock('@/lib/assistant/reply', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/reply')>()),
      answer: async () => ({ text: 'Накталай — дүкөндө гана.', products: [], source: 'gemini' as const, audience: 'customer' as const }),
    }))
    const { respond } = await import('@/lib/assistant/respond')
    const r = await respond(wa('wa:g3'), [{ role: 'assistant', text: 'Сүйлөшүп көрүңүз.' }, { role: 'user', text: 'Мен наличка алам' }], 'ky', null, undefined, [product.id])
    expect(r.source).toBe('gemini')
    vi.doUnmock('@/lib/assistant/reply')
    vi.resetModules()
  })
})

describe('аудит 01.10 ночь: адрес вместо «да»', () => {
  it('на «Тариздейлиби?» прислал адрес со ссылкой на карту — заказ сразу с этим адресом', async () => {
    process.env.JEV_API_KEY = 'sk-or-test'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ answers: { kind: { choice: 'agree', confidence: 0.95 }, reason: { choice: 'other' }, when: { choice: 'unknown' } } }), { status: 200 })))
    const { respond } = await import('@/lib/assistant/respond')
    const wa = { key: 'wa:h1', orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: { phone: '+996555000095', name: 'Юсуф' } }
    const r = await respond(wa, [
      { role: 'assistant', text: `${product.nameRu}. Тариздейлиби?` },
      { role: 'user', text: 'улица Эркин-Эл, 20 Бишкек https://yandex.ru/navi?whatshere%5Bzoom%5D=12&ll=74.6%2C42.8' },
    ], 'ky', null, undefined, [product.id])
    expect(r.text).not.toMatch(/Кайда жеткирели/)
    expect(r.text).toMatch(/Заказ .*(сом|KGS)/)
    delete process.env.JEV_API_KEY
    vi.unstubAllGlobals()
  })
})

describe('продавец, а не «Тариздейлиби?» в каждом ответе; характеристики товара из разговора', () => {
  it('оформить предлагали в прошлом ответе — в новом «Тариздейлиби?» вырезается', async () => {
    vi.resetModules()
    vi.doMock('@/lib/assistant/reply', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/reply')>()),
      answer: async () => ({ text: 'Ооба, 8 кг. Тариздейлиби?', products: [], source: 'gemini' as const, audience: 'customer' as const }),
    }))
    const { respond } = await import('@/lib/assistant/respond')
    const wa = { key: 'wa:k1', orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: { phone: '+996555000099' } }
    const r = await respond(wa, [
      { role: 'assistant', text: 'Бар, 21 400 сом. Тариздейлиби?' },
      { role: 'user', text: 'Канча кг кирет' },
    ], 'ky', null)
    expect(r.text).toBe('Ооба, 8 кг.')
    vi.doUnmock('@/lib/assistant/reply')
    vi.resetModules()
  })

  it('показанный в чате товар — в подробном списке с характеристиками, даже если вопрос без названия', async () => {
    const { catalogForQuestion } = await import('@/lib/assistant/knowledge')
    const withSpecs = products.find((p) => p.specs.length > 0)!
    const text = catalogForQuestion(products, 'канча кг кирет', 'ru', null, [withSpecs.id])
    const detailed = text.split('ВЕСЬ КАТАЛОГ')[0]
    expect(detailed).toContain(`id=${withSpecs.id}`)
    expect(detailed).toContain(withSpecs.specs[0].valueRu)
  })
})

describe('язык: кыргызские окончания без особых букв', () => {
  it('«Программалары кандай? Энергиясы кандай класс?» — кыргызский; «Тариздейлиби?» — кыргызский; русские «товары» — нет', () => {
    expect(talkLang([{ role: 'user', text: 'Программалары кандай? Энергиясы кандай класс?' }], 'ru')).toBe('ky')
    expect(talkLang([{ role: 'user', text: 'Тариздейлиби' }], 'ru')).toBe('ky')
    expect(talkLang([{ role: 'user', text: 'Какие товары есть?' }], 'ru')).toBe('ru')
    expect(talkLang([{ role: 'user', text: 'Стиральная машина нужна' }], 'ru')).toBe('ru')
  })
})

describe('факты о товаре, размеры и доверие (01.10)', () => {
  it('Эндуро: возраст 8–10, заряд 3–4 часа, в горы не рекомендуем — в подробном каталоге', async () => {
    const { catalogForQuestion } = await import('@/lib/assistant/knowledge')
    const { productFacts } = await import('@/data/product-facts')
    expect(productFacts('cb-00002545')).toMatch(/8–10 лет/)
    expect(productFacts('cb-нет-такого')).toBe('')
    const enduro = { ...products[0], id: 'cb-00002545', nameRu: 'Электро Эндуро WN-A10', nameKy: 'Электро Эндуро WN-A10', brand: 'WN', specs: [] }
    const text = catalogForQuestion([enduro, ...products], 'эндуро', 'ru', null, ['cb-00002545'])
    expect(text.split('ВЕСЬ КАТАЛОГ')[0]).toMatch(/3–4 часа.*НЕ рекомендуем/)
  })

  it('в правилах: страх обмана — QR на магазин, с 2011 года, приехать, Instagram, голос руководства', async () => {
    const { storePolicy } = await import('@/lib/assistant/policy')
    const p = storePolicy()
    expect(p).toMatch(/А ВДРУГ ОБМАНУТ/)
    expect(p).toMatch(/QR-код O!Деньги/)
    expect(p).toMatch(/smartcentrr/)
  })

  it('в промпте: размеры и возраст — только из каталога, «на глаз» нельзя', async () => {
    const { systemInstruction } = await import('@/lib/assistant/prompt')
    expect(systemInstruction('ru', null, 'ky', [], '', '', undefined, null)).toMatch(/РАЗМЕРЫ И ВОЗРАСТ/)
  })
})

describe('хушмомила (01.10)', () => {
  it('в промпте: «Рахмат», «Кечиресиз», пожелание в конце — одной фразой', async () => {
    const { systemInstruction } = await import('@/lib/assistant/prompt')
    const t = systemInstruction('ru', null, 'ky', [], '', '', undefined, null)
    expect(t).toMatch(/ХУШМОМИЛА/)
    expect(t).toMatch(/Кечиресиз, күттүрүп койдук/)
    expect(t).toMatch(/Ден соолук болсун/)
  })
})

describe('Instagram (02.10): мем без подписи — молчим; не справилась — номер WhatsApp', () => {
  const ig = (key: string) => ({ key, orderSource: 'Заказ из Instagram', leadChannel: 'instagram' as const, known: {} })

  it('рилс без подписи и без слов — silent, отвечает сотрудник', async () => {
    const { respond } = await import('@/lib/assistant/respond')
    const r = await respond(ig('ig:share-1'), [{ role: 'user', text: '[Прислал публикацию из Instagram]' }], 'ru', null)
    expect(r.silent).toBe(true)
    expect(r.mute).not.toBe(true)
  })

  it('рилс с подписью о товаре — отвечает консультант', async () => {
    vi.resetModules()
    vi.doMock('@/lib/assistant/reply', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/reply')>()),
      answer: async () => ({ text: 'Есть, 27 500 сом.', products: [], source: 'gemini' as const, audience: 'customer' as const }),
    }))
    const { respond } = await import('@/lib/assistant/respond')
    const r = await respond(ig('ig:share-2'), [{ role: 'user', text: '[Прислал публикацию: Холодильник Avest 300 л]' }], 'ru', null)
    expect(r.silent).not.toBe(true)
    expect(r.text).toBe('Есть, 27 500 сом.')
    vi.doUnmock('@/lib/assistant/reply')
    vi.resetModules()
  })

  it('посудомойка (04.10): «идиш жууган машинка» — посудомоечная, не стиральная; заявке — вся переписка', async () => {
    const { searchProducts, dishwasherWords } = await import('@/lib/assistant/knowledge')
    const item = (id: string, nameRu: string) => ({ ...products[0], id, nameRu, nameKy: nameRu, brand: '', specs: [] })
    const list = [
      item('wash', 'Стиральная машина Artel 7 кг'),
      item('dish', 'Посудомоечная машина VELBERG VLB-4512Z инвертор 10 персон'),
      item('kazan', 'Казан идиш 6 литр'),
      item('desk', 'Парта мини'),
      item('vac', 'Пылесос моющий мини'),
    ]
    for (const q of ['Идиш жууган машинка канча экен', 'идиш жуугуч барбы', 'idish yuvadigan mashina', 'Посудомойка есть?', 'мини посуда мойка', 'посуда мыть машина']) {
      expect(searchProducts(q, 'ky', 3, list)[0]?.id, q).toBe('dish')
      expect(searchProducts(q, 'ky', 3, list).map((p) => p.id), q).toEqual(['dish'])
    }
    // «Кир жуугуч» — по-прежнему стиральная, «идиш» без «мыть» — посуда.
    expect(searchProducts('Кир жуугуч машина', 'ky', 3, list)[0]?.id).toBe('wash')
    expect(dishwasherWords(['идиш', 'казан'])).toEqual(['идиш', 'казан'])
    expect(dishwasherWords(['набор', 'посуды'])).toEqual(['набор', 'посуды'])
    expect(dishwasherWords(['посудомоечная', 'midea', 'mdwm'])).toEqual(['midea', 'mdwm', 'посудомоечная'])
    // Как пишут на самом деле (Instagram 04.10).
    const moto = [item('enduro', 'Электро Эндуро WN-A10'), item('moto', 'Мототцикл спорт'), item('desk', 'Парта мини')]
    for (const q of ['Детский эндурро баасы канча', 'ендура канча турат 4+', 'Детский эндеролор барбы', 'эндуронун ценазын']) {
      expect(searchProducts(q, 'ky', 3, moto)[0]?.id, q).toBe('enduro')
    }
    expect(searchProducts('Матаскыл кача', 'ky', 3, moto).map((p) => p.id)).toEqual(expect.arrayContaining(['enduro', 'moto']))
    // В сводке разделов видно, что посудомойки есть: «Кухонная техника» сама этого не говорила.
    const { kindsOf } = await import('@/lib/assistant/knowledge')
    expect(kindsOf([item('d1', 'Посудомоечная машина MIDEA MDWM-218TWO'), item('d2', 'Посудомоечная машина VELBERG'), item('o', 'Духовка UAKEEN')]))
      .toBe('посудомоечная машина, духовка')

    vi.resetModules()
    const leads: string[] = []
    vi.doMock('@/lib/assistant/leads', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/leads')>()),
      startLead: async (_key: string, _talk: string, context: string) => { leads.push(context) },
    }))
    vi.doMock('@/lib/assistant/reply', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/reply')>()),
      answer: async () => ({ text: 'x', products: [], source: 'gemini' as const, audience: 'staff' as const }),
    }))
    const { respond } = await import('@/lib/assistant/respond')
    await respond({ key: 'wa:dish-1', orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp', known: { phone: '+996555000061' } }, [
      { role: 'user', text: 'Идиш жууган машинка канча экен' },
      { role: 'assistant', text: 'Идиш жуугуч машиналар кампага келгенде сизге чалып кабар берип коёлубу?' },
      { role: 'user', text: 'Макул рахмат' },
      { role: 'user', text: 'Канча сом' },
      { role: 'user', text: 'Ошого карап акчамды топтой берейин' },
    ], 'ky', null)
    // Раньше владелец видел одно «Ошого карап акчамды топтой берейин» — без цены и без товара.
    expect(leads[0]).toMatch(/Макул рахмат\nКанча сом\nОшого карап акчамды топтой берейин/)
    expect(leads[0]).toMatch(/Перед этим магазин писал:\nИдиш жуугуч машиналар/)
    vi.doUnmock('@/lib/assistant/leads')
    vi.doUnmock('@/lib/assistant/reply')
    vi.resetModules()
  })

  it('вопрос для руководства: в Instagram — с номером WhatsApp, в WhatsApp — без', async () => {
    vi.resetModules()
    vi.doMock('@/lib/assistant/reply', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/reply')>()),
      answer: async () => ({ text: 'x', products: [], source: 'gemini' as const, audience: 'staff' as const }),
    }))
    const { respond } = await import('@/lib/assistant/respond')
    const turns = [{ role: 'user' as const, text: 'Сколько весит мотоцикл?' }]
    const inIg = await respond(ig('ig:staff-1'), turns, 'ru', null)
    expect(inIg.text).toBe('Поняла, уточню у руководства и напишу вам.\nБыстрее ответим в WhatsApp: +996 557 100 505')
    expect(inIg.handoff).toBe(true)
    const inWa = await respond({ key: 'wa:staff-1', orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp', known: { phone: '+996555000060' } }, turns, 'ru', null)
    expect(inWa.text).toBe('Поняла, уточню у руководства и напишу вам.')
    vi.doUnmock('@/lib/assistant/reply')
    vi.resetModules()
  })
})
