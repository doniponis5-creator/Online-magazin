import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { choicesOfPost, commentLang, installmentLine, isPlus, planComment, productOfPost, type CommentScores } from '@/lib/assistant/comments'
import { bestNameMatch } from '@/lib/assistant/knowledge'
import { products } from '@/data/products'
import type { Product } from '@/data/products'

/** Товар для проверок: только то, что смотрят bestNameMatch и planComment. */
function item(id: string, nameRu: string, price = 15900, stock = 3): Product {
  const base = products[0]
  return { ...base, id, nameRu, nameKy: nameRu, brand: '', price, variants: base.variants.map((v) => ({ ...v, stock })) }
}
const LIST = [
  item('enduro', 'Электро Эндуро WN-A10'),
  item('moto', 'Мототцикл спорт', 22100),
  item('desk1', 'Парта МИНИ Ламинат', 500),
  item('desk2', 'Парта мини', 600),
  item('basket', 'Корзина для Белья Yangi URNA (Мини)', 600),
  item('blender', 'Блендер ДОБРЫНЯ мини (Ручной)', 900),
  item('oven', 'Встраиваемая духовка UAKEEN UK-322', 30000),
  item('fridge1', 'Холодильник AVEST BCD-340 WG No Frost', 39000),
  item('fridge2', 'Холодильник AVEST MF-226WR', 32400),
  item('vac', 'Пылесос UAKEEN ZL-940 (Моющий)', 13900),
  item('gone', 'Электро Велик GEPARD M2', 33900, 0),
]
const s = (x: Partial<CommentScores>): CommentScores => ({ ask: 0, praise: 0, complaint: 0, spam: 0, ...x })

describe('товар по подписи поста — без чужой цены', () => {
  it('замер 04.10: «мини» и «322 литр» не перетягивают', () => {
    expect(bestNameMatch('Эндура мотоцикл мини электрический кайрадан поступление болду 🤯 Доставка бесплатная', LIST)?.id).toBe('enduro')
    expect(bestNameMatch('Спорт мотоцикл чоңдор үчүн', LIST)?.id).toBe('moto')
    expect(bestNameMatch('Моющий пылесос UAKEEN ZL-940 товар дня', LIST)?.id).toBe('vac')
    // Не уверены — null: в Direct спросим «какой товар?», а не назовём «Парту за 500» или «Духовку UK-322».
    // «No Frost» здесь у одного AVEST — он и есть (322 л); духовка UK-322 по одному числу не выбирается.
    expect(bestNameMatch('Холодильник AVEST No Frost 322 литр', LIST)?.id).toBe('fridge1')
    expect(bestNameMatch('Холодильник 322 литр', LIST)?.id).not.toBe('oven')
    expect(bestNameMatch('Мини 38 литр', LIST)).toBeNull()
    expect(bestNameMatch('15900 с 🤯🫂🇰🇬 Доставка бесплатная', LIST)).toBeNull()
  })
  it('одного общего слова мало; цена в подписи другая — не он (ревью 04.10)', () => {
    expect(bestNameMatch('Ламинат для пола', LIST)).toBeNull()
    expect(bestNameMatch('Спорт костюм', LIST)).toBeNull()
    expect(bestNameMatch('Блендер Philips 3в1', LIST)).toBeNull()
    expect(bestNameMatch('Пылесос UAKEEN беспроводной 12900 сом', LIST)).toBeNull()
    expect(bestNameMatch('Пылесос UAKEEN ZL-940 13 900 сом', LIST)?.id).toBe('vac')
    // Одно слово, но цена та же — он.
    expect(bestNameMatch('Эндура 15 900 сом гана!', LIST)?.id).toBe('enduro')
  })
  it('Instagram 09.10: пост стиральной «LEVO … DD Motor» — не «Мототцикл спорт», цена из подписи не модель', () => {
    const levo = [
      ...LIST,
      { ...item('levo80', 'Стиральная машина LEVO LV-80LUX-T DD Motor (черный)', 31900), brand: 'LEVO' },
      { ...item('levo70', 'Стиральная машина LEVO LV-70DG2T', 24800), brand: 'LEVO' },
      { ...item('lg8', 'Стиральная машина LG F2V3PS6W 8кг белый', 29900), brand: 'LG' },
      item('axma', 'Средство для посудомоечных машин AXMA (900 гр) порошок', 900),
    ]
    for (const caption of [
      'Стиральная машина LEVO LV-80LUX-T DD Motor (черный)\n31 900 сом',
      'LEVO 8 кг DD Motor инвертор 31900 сом',
      'Кир жуугуч машина LEVO 8кг DD мотор арзандатуу',
      'Стиральная машина DD Motor',
    ]) expect(productOfPost(caption, levo)?.id).toBe('levo80')
    // «мотор» — двигатель, не мотоцикл; а «мото», «мотоцикл» — по-прежнему мотоцикл
    expect(productOfPost('Мотор DD 8 кг', levo)).toBeNull()
    expect(choicesOfPost('Мотор DD 8 кг', levo).map((p) => p.id)).not.toContain('moto')
    expect(bestNameMatch('Спорт мотоцикл чоңдор үчүн', levo)?.id).toBe('moto')
  })
  it('хэштеги и отметки не считаются', () => {
    expect(productOfPost('#эндуро @smartcentrr', LIST)).toBeNull()
  })
})

describe('рилс «Мини посудомойка» — «Баасы?» (05.10)', () => {
  const dishes = [
    item('dw1', 'Посудомоечная машина MIDEA MDWM-218TWO', 23900),
    item('dw2', 'Посудомоечная машина VELBERG VDW-45', 37400),
    item('dw3', 'Посудомоечная машина ARTEL AD-60', 41900),
    item('dw0', 'Посудомоечная машина GORENJE', 30000, 0),
  ]
  const list = [...LIST, ...dishes]
  const caption = 'Мини посудомойка 🤩😍 0557100505'
  it('модель не названа — в Direct те, что есть, с ценами, дешёвые первыми', () => {
    expect(productOfPost(caption, list)).toBeNull()
    const choices = choicesOfPost(caption, list)
    expect(choices.map((p) => p.id)).toEqual(['dw1', 'dw2', 'dw3']) // нет на складе — не предлагаем
    const plan = planComment('Баасы', s({ ask: 0.9 }), null, choices)
    expect(plan.public).toBe('Директке жаздык 📩')
    expect(plan.private).toMatch(/^Ассаламу алейкум! Азыр бизде бар:\n• Посудомоечная машина MIDEA MDWM-218TWO — 23\s900 сом\n/)
    expect(plan.private).toMatch(/Кайсынысы кызыктырды\?$/)
    // Одна такая в наличии — «Ушулбу?»
    expect(planComment('Баасы', s({ ask: 0.9 }), null, [dishes[0]]).private).toMatch(/Ушулбу\?$/)
  })
  it('цена или модель в подписи — сразу этот товар', () => {
    expect(productOfPost('Мини посудомойка 23 900 сом 🔥', list)?.id).toBe('dw1')
    expect(productOfPost('Посудомойка MIDEA MDWM-218TWO', list)?.id).toBe('dw1')
    const plan = planComment('Баасы', s({ ask: 0.9 }), productOfPost('Мини посудомойка 23 900 сом', list))
    expect(plan.private).toMatch(/MIDEA MDWM-218TWO — 23\s900 сом/)
  })
  it('вид не ясен — как раньше «какой товар?»', () => {
    expect(choicesOfPost('Скидка! Успейте 🔥', list)).toEqual([])
    expect(choicesOfPost('Холодильник и пылесос', list)).toEqual([]) // два вида — не угадываем
    expect(planComment('Баасы', s({ ask: 0.9 }), null, []).private).toMatch(/Кайсы товар кызыктырды/)
  })
})

describe('что делать с комментарием', () => {
  const enduro = LIST[0]
  it('«Канча?» и «+» — «Директке жаздык», в Direct товар, цена и вопрос', () => {
    for (const text of ['Канча?', '+']) {
      const plan = planComment(text, s({ ask: 0.9 }), enduro)
      expect(plan).toMatchObject({ action: 'answer', public: 'Директке жаздык 📩', productId: 'enduro', lang: 'ky' })
      expect(plan.private).toMatch(/^Ассаламу алейкум! Электро Эндуро WN-A10 — 15\s900 сом\. Кайсы шаардан болосуз\?$/u)
    }
  })
  it('«+» в любом виде — как «баасы»: в Direct товар и цена (владелец 09.10)', () => {
    for (const text of ['+', '++', '+++', ' + ', '+!', '+ 🔥', '🔥+', '➕', '＋', 'Плюс', 'плюс 👍', '+😍😍']) {
      expect(isPlus(text)).toBe(true)
      // Jev мог счесть «+» похвалой или спамом — всё равно ответ с ценой
      const plan = planComment(text, s({ praise: 0.9, spam: 0.85 }), enduro)
      expect(plan.action).toBe('answer')
      expect(plan.private).toMatch(/Электро Эндуро WN-A10 — 15\s900 сом/u)
    }
    for (const text of ['1+1 акция бар', 'Плюсы и минусы?', '🔥', 'супер', '+996 555 12 34 56']) expect(isPlus(text)).toBe(false)
  })
  it('по-русски — по-русски; товара не узнали — «какой товар?»', () => {
    const plan = planComment('Цена в лс', s({ ask: 0.94 }), null)
    expect(plan.public).toBe('Написали вам в Direct 📩')
    expect(plan.private).toBe('Ассаламу алейкум! Какой товар заинтересовал? Напишите — скажу цену.')
  })
  it('по-узбекски — под постом по-кыргызски, в Direct по-узбекски', () => {
    const text = 'Бу канча туради? Нархини ёзинг, хозир борми?'
    expect(commentLang(text)).toBe('uz')
    const plan = planComment(text, s({ ask: 0.95 }), enduro)
    expect(plan.public).toBe('Директке жаздык 📩')
    expect(plan.private).toMatch(/Кайси шахардансиз\?$/)
    const sorry = planComment('Ёмон товар, синиб колди, пулимни кайтаринглар!', s({ complaint: 0.9 }), null)
    expect(sorry.public).toBe('Кечиресиз! Директке жаздык 📩')
    expect(planComment('Директга ёздик 📩', s({ ask: 0.9 }), null).action).toBe('skip')
  })
  it('товара нет на складе — «предложить похожий?», цену не называем', () => {
    const plan = planComment('Канча турат?', s({ ask: 0.9 }), LIST.at(-1)!)
    expect(plan.private).toMatch(/азыр жок\. Окшошун сунуштайынбы\?/)
    expect(plan.private).not.toMatch(/сом/)
  })
  it('жалоба — извинение при всех, разбор в Direct', () => {
    const plan = planComment('Алдамчылар, акча алып товар бербей жатышат', s({ complaint: 0.88, spam: 0.45 }), enduro)
    expect(plan).toMatchObject({ action: 'alert', public: 'Кечиресиз! Директке жаздык 📩' })
    expect(plan.private).toMatch(/Эмне болгонун жазыңызчы/)
  })
  it('злая жалоба с матом — не прячем молча, а владельцу и извинение', () => {
    expect(planComment('Алдамчы, бла, акчамды кайтаргыла', s({ complaint: 0.9, spam: 0.85 }), enduro).action).toBe('alert')
    // Спам со словами интереса («цена в директ») не скрываем — отвечаем.
    expect(planComment('цена в директ', s({ spam: 0.9, ask: 0.2 }), enduro).action).toBe('answer')
  })
  it('спам скрываем; «🔥», «супер», отметку друга — не трогаем', () => {
    expect(planComment('Заработок 500$ в день, пиши в директ', s({ spam: 0.95, ask: 0.22 }), enduro).action).toBe('hide')
    expect(planComment('🔥🔥🔥', s({ praise: 0.92, ask: 0.11 }), enduro).action).toBe('skip')
    expect(planComment('@aibek_osh карачы мына', s({ praise: 0.73, ask: 0.11 }), enduro).action).toBe('skip')
  })
  it('свой ответ «Директке жаздык 📩» вернулся — не отвечаем самим себе', () => {
    expect(planComment('Директке жаздык 📩', s({ ask: 0.72 }), enduro).action).toBe('skip')
    expect(planComment('Написали вам в Direct 📩', null, enduro).action).toBe('skip')
  })
  it('без Jev — по словам интереса', () => {
    expect(planComment('канча турат', null, enduro).action).toBe('answer')
    expect(planComment('класс', null, enduro).action).toBe('skip')
  })
  it('спор о цене — не жалоба: спокойный ответ без 🚨 (Instagram 05.10)', async () => {
    const dish = item('dish', 'Посудомоечная машина MIDEA MDWM-218TWO', 23900)
    // Настоящие комментарии под рилсом «Мини посудомойка»; Jev оба счёл жалобой.
    for (const text of [
      '23 мин  ге кымбат ,москвада 5 мин рубл .уялбайсынба',
      '23900 го мындан чонун алса болотда жон эле кишини алдай бересинерби булар 5 минден 7 мин сомго эле турат',
      'Очень дорого',
    ]) {
      const plan = planComment(text, s({ complaint: 0.85, spam: 0.6 }), dish)
      expect(plan.action).toBe('answer')
      expect(['Пикириңизге рахмат 🙏 Баасы тууралуу Директке жаздык 📩', 'Спасибо за отзыв 🙏 Про цену написали вам в Direct 📩']).toContain(plan.public)
      expect(plan.private).toMatch(/23\s900/)
      expect(plan.private).not.toMatch(/кепилдик|гарант|жеткир|доставк/i) // не выдумываем
      // «Дорого» — предлагаем рассрочку банка: 23 900 / 4 = 5 975 в месяц, без переплаты.
      expect(plan.private).toMatch(/Адал рассрочка/)
      expect(plan.private).toMatch(/5\s975/)
    }
    // Дороже 40 000 — «МРассрочка» без суммы в месяц (там переплата, считает банк); дороже 200 000 — ничего.
    expect(installmentLine(60000, 'ru')).toBe('Можно и в рассрочку: «МРассрочка» MBANK — до 24 месяцев (одобряет банк).')
    expect(installmentLine(40000, 'ky')).toMatch(/айына 10\s000 сомдон/)
    expect(installmentLine(250000, 'ky')).toBe('')
    const { storePolicy } = await import('@/lib/assistant/policy')
    expect(storePolicy()).toContain('Лимит — от 2 000 до 40 000 сом')
    expect(storePolicy()).toContain('за 4 месяца — каждый месяц четверть цены (23 900 сом → 4 платежа по 5 975)')
    expect(storePolicy()).toContain('«МРассрочка» (приложение MBANK): до 200 000 сом, до 24 месяцев')
    // Товара не узнали — цену не называем.
    expect(planComment('Кымбат го', s({ complaint: 0.7 }), null).private).not.toMatch(/\d/)
    // Сломалось или «верните деньги» — это жалоба, хоть и про деньги.
    expect(planComment('Кымбат алдым, бир жумада бузулду', s({ complaint: 0.9 }), dish).action).toBe('alert')
    expect(planComment('Алдамчылар, акча алып товар бербей жатышат', s({ complaint: 0.88 }), dish).action).toBe('alert')
    // Свой ответ под постом вернулся webhook'ом — молчим.
    expect(planComment('Пикириңизге рахмат 🙏 Баасы тууралуу Директке жаздык 📩', s({ complaint: 0.7 }), dish).action).toBe('skip')
  })
})

describe('/api/channel/instagram-comment', () => {
  const SECRET = 'test-secret'
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.doUnmock('@/lib/assistant/leads')
    vi.doUnmock('@/lib/assistant/comments')
    vi.resetModules()
  })
  const request = (body: object, secret = SECRET) => {
    const text = JSON.stringify(body)
    return new Request('http://x/api/channel/instagram-comment', {
      method: 'POST',
      body: text,
      headers: { 'x-signature': createHmac('sha256', secret).update(text).digest('hex') },
    })
  }
  it('без подписи — 404; жалоба — решение alert, а владельцу пишет сервер после ответа в Direct', async () => {
    vi.stubEnv('SHOP_API_SECRET', SECRET)
    vi.resetModules()
    const sent: string[] = []
    vi.doMock('@/lib/assistant/leads', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/leads')>()),
      notifyOwner: async (kind: string) => (sent.push(kind), true),
    }))
    vi.doMock('@/lib/assistant/comments', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/comments')>()),
      scoreComment: async () => ({ ask: 0.05, praise: 0.05, complaint: 0.9, spam: 0.1 }),
    }))
    const { POST } = await import('@/app/api/channel/instagram-comment/route')
    expect((await POST(request({ id: '18001', text: 'x' }, 'wrong'))).status).toBe(404)
    expect((await POST(request({ id: 'abc', text: 'x' }))).status).toBe(400)
    const response = await POST(request({ id: '18001', text: 'Алдамчылар!', caption: 'Эндура мини' }))
    expect(await response.json()).toMatchObject({ ok: true, action: 'alert', public: 'Кечиресиз! Директке жаздык 📩' })
    expect(sent).toEqual([])
  })
})
