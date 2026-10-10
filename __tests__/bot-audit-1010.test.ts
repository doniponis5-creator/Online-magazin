import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
process.env.SHOP_PAYMENT_MODE = 'mock'

/**
 * Аудит бота 10.10 (журнал 01–10.10, 2055 ответов): каждый случай, где терялся покупатель, — здесь,
 * чтобы не вернулся. Слова покупателей — настоящие, из журнала.
 */
import { products, type Product } from '@/data/products'
import { DEFER, OFFER, grantedDiscount, looksLikeAddress, rememberDiscount, start, step } from '@/lib/telegram/order'
import { detectLang } from '@/lib/assistant/talk'
import { houseStyle } from '@/lib/assistant/reply'
import { placeFor } from '@/lib/assistant/prompt'
import { localAnswer } from '@/lib/assistant/local'
import { searchProducts } from '@/lib/assistant/knowledge'
import { parseTriage, type Triage } from '@/lib/assistant/triage'
import { planComment, type CommentScores } from '@/lib/assistant/comments'
import { chatText } from '@/lib/assistant/quality'
import { otherKind } from '@/lib/assistant/respond'

const product = products.find((p) => p.price > 0 && p.variants.some((v) => v.stock > 0))!
function item(id: string, nameRu: string, brand: string, price = 15900): Product {
  return { ...products[0], id, nameRu, nameKy: nameRu, brand, price, variants: products[0].variants.map((v) => ({ ...v, stock: 3 })) }
}

describe('«потом» по-кыргызски — не заказ', () => {
  it('«кийин», «ала албайм», «айлык тийгенде» — отложил', () => {
    for (const t of ['Азыр ала албайм кийин алам', 'Кийинки айда алабыз, айлык тийгенде', 'Бугун эртен алалбайм', 'Азыр эмес']) {
      expect(DEFER.test(t), t).toBe(true)
    }
  })
  it('«келгенден кийин», «мечиттен кийинки үй» — не «потом»', () => {
    for (const t of ['Сиздерге заказ кылсак келгенден кийин акчасын толойбузбу', 'мечиттен кийинки үй', 'Алам', 'Ооба алам']) {
      expect(DEFER.test(t), t).toBe(false)
    }
  })
})

describe('«Алсаңыз, ушул жерден тариздеп берем.» — тоже предложение оформить', () => {
  it('без «?» узнаётся', () => {
    expect(OFFER.test('Оштун борборуна чейин акысыз жеткирип беребиз. Алсаңыз, ушул жерден тариздеп берем.')).toBe(true)
    expect(OFFER.test('Тариздейлиби?')).toBe(true)
    expect(OFFER.test('Бишкектин борборуна чейин акысыз жеткирип беребиз.')).toBe(false)
  })
  it('образец в промпте — вопросом', async () => {
    const { readFileSync } = await import('node:fs')
    expect(readFileSync('src/lib/assistant/prompt.ts', 'utf8')).not.toContain('Алсаңыз, ушул жерден тариздеп берем')
  })
})

describe('адрес доставки — не любая фраза', () => {
  it('мусор и «напишу потом» — не адрес', () => {
    expect(looksLikeAddress('Базар Дан алысбыз биз')).toBe(false)
    expect(looksLikeAddress('Азыр толук жазам э')).toBe(false)
    expect(looksLikeAddress('Абдырахманов Зулум кочосу 4 уй  Ориентир Мал базар')).toBe(true)
    expect(looksLikeAddress('мечиттин жанында')).toBe(true)
    expect(looksLikeAddress('Ленина 15')).toBe(true)
  })
  it('анкета переспрашивает с примером, «жазам» — каждый раз, потом берёт как написал', async () => {
    const key = 'wa:audit-addr'
    await start(key, [product.id], 'ky', 'Заказ из WhatsApp', { name: 'Айпери', phone: '+996555000111' })
    expect(await step(key, 'Кара-Суу', 'ky', 'ky')).toMatch(/Көчө жана үй/)
    expect(await step(key, 'Базар Дан алысбыз биз', 'ky', 'ky')).toMatch(/Көчөнүн атын/)
    expect(await step(key, 'Азыр толук жазам э', 'ky', 'ky')).toMatch(/Көчөнүн атын/)
    // Второй раз без цифр и улицы — не гоняем по кругу: берём как написал
    expect(await step(key, 'Сары-Колот айылы', 'ky', 'ky')).toMatch(/Заказ/)
  })
})

describe('скидка, уже уступленная в чате', () => {
  it('grantedDiscount помнит процент, без торга — 0', () => {
    expect(grantedDiscount('wa:audit-none')).toBe(0)
    rememberDiscount('wa:audit-disc', 2, undefined, { productId: product.id })
    expect(grantedDiscount('wa:audit-disc')).toBe(2)
  })
})

describe('не тот вид товара — анкету не начинаем', () => {
  it('«Автамат алам» при полуавтомате', () => {
    expect(otherKind('Автамат алам', 'Стиральная машина п/а ARTEL TG 70 FN')).toBe(true)
    expect(otherKind('Автамат алам', 'Стиральная машина LG F2V3PS6W 8кг белый')).toBe(false)
    expect(otherKind('жарым автомат керек', 'Стиральная машина LG F2V3PS6W 8кг белый')).toBe(true)
    expect(otherKind('Ушудан алайын', 'Стиральная машина п/а ARTEL TG 70 FN')).toBe(false)
  })
})

describe('поиск: марка кириллицей', () => {
  it('«Авангард» находит AVANGARD', () => {
    const list = [item('avg', 'Стиральная машина п/а AVANGARD ATG-72-708', 'AVANGARD', 7700), item('lg', 'Стиральная машина LG F2V3PS6W', 'LG', 34900)]
    expect(searchProducts('Авангард деген машина 7 литрлик канча', 'ky', 6, list).map((p) => p.id)).toContain('avg')
  })
})

describe('язык', () => {
  it('«Ассолому Алекум» — узбек; «ассалом» + кыргызские слова — кыргыз', () => {
    expect(detectLang('Ассолому Алекум', 'ru')).toBe('uz')
    expect(detectLang('Уаалейкум ассалом Апеей аябай кымбатко', 'ru')).toBe('ky')
  })
  it('«Оформляйбызбы?» → «Тариздейлиби?»', () => {
    expect(houseStyle('Макул. Оформляйбызбы?', 'ky')).toBe('Макул. Тариздейлиби?')
  })
  it('запасной ответ на «Салом» — приветствие на языке разговора, а не «подсказать не смогу»', () => {
    const a = localAnswer('Салом', 'ru', null, [], 'uz')
    expect(a.text).not.toMatch(/подсказать не смогу/)
    expect(localAnswer('Ассаламу алейкум', 'ru', null, [], 'ky').text).not.toMatch(/жардам бере албайм/)
  })
})

describe('подсказка о месте — по последнему сообщению', () => {
  it('«Рассрочкага берилеби» после города — без доставки; «доставка канча» — с городом', () => {
    expect(placeFor('Жети-Өгүз Рассрочкага берилеби', 'Рассрочкага берилеби')).toBe('Рассрочкага берилеби')
    expect(placeFor('Жети-Өгүз Доставка канча', 'Доставка канча')).toBe('Жети-Өгүз Доставка канча')
  })
})

describe('Jev: пустой ответ — не «нет»', () => {
  it('noul null / "" — весь ответ null', () => {
    const base = { shop: { noul: 0.9 }, staff: { noul: 0.1 }, personal: { noul: 0 }, payment: { noul: 0.1 }, complaint: { noul: 0.1 } }
    expect(parseTriage({ answers: { ...base, shop: { noul: null } } })).toBeNull()
    expect(parseTriage({ answers: { ...base, shop: { noul: '' } } })).toBeNull()
    expect(parseTriage({ answers: base })).not.toBeNull()
  })
})

describe('Instagram: «жалоба» Jev без слов жалобы — не тревога', () => {
  it('«Идиш жууган аппарат» — ответ, не «Кечиресиз»', () => {
    const s: CommentScores = { ask: 0.6, praise: 0, complaint: 0.7, spam: 0 }
    expect(planComment('Идиш жууган аппарат', s, null).action).not.toBe('alert')
    expect(planComment('Кир машина бузулуп калды, жооп бергиле', s, null).action).toBe('alert')
  })
})

describe('недельный отчёт: без номеров и адресов', () => {
  it('chatText прячет телефон и ответ на «Көчө жана үй?»', () => {
    const text = chatText([
      { role: 'user', text: 'Номерим 0700441154' },
      { role: 'assistant', text: 'Көчө жана үй?' },
      { role: 'user', text: 'Ленин 15' },
    ])
    expect(text).not.toMatch(/0700441154/)
    expect(text).not.toContain('Ленин 15')
  })
})

describe('журнал для еженедельной проверки', () => {
  it('exportRows: с даты, по порядку, JSON на строку', async () => {
    const { exportRows } = await import('@/lib/assistant/log')
    const row = (at: string) => ({ at, lang: 'ru', q: 'q', a: 'a', found: false, source: 'gemini' })
    const text = exportRows([row('2026-10-09T10:00:00Z'), row('2026-10-01T10:00:00Z'), row('2026-10-05T10:00:00Z')], '2026-10-03')
    expect(text.split('\n').map((l) => JSON.parse(l).at)).toEqual(['2026-10-05T10:00:00Z', '2026-10-09T10:00:00Z'])
    expect(exportRows([row('2026-10-01T10:00:00Z')], 'мусор').split('\n')).toHaveLength(1)
  })
})

describe('respond: случаи из журнала', () => {
  afterEach(() => {
    vi.doUnmock('@/lib/assistant/triage')
    vi.doUnmock('@/lib/assistant/leads')
    vi.doUnmock('@/lib/assistant/reply')
    vi.resetModules()
  })
  const wa = (key: string) => ({ key, orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: { phone: '+996555000098', name: 'Айпери' } })
  type Ans = { text: string; audience?: 'customer' | 'staff' | 'personal'; discount?: number }
  const shop: Triage = { shop: 0.8, staff: 0.1, personal: 0.1, payment: 0.1, complaint: 0.1 }
  async function setup(answers: Ans[], s: Triage | null = shop) {
    vi.resetModules()
    const sent: { kind: string; text: string }[] = []
    const leads: string[] = []
    let gemini = 0
    vi.doMock('@/lib/assistant/triage', async (orig) => ({ ...(await orig<typeof import('@/lib/assistant/triage')>()), triage: async () => s }))
    vi.doMock('@/lib/assistant/leads', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/leads')>()),
      notifyOwner: async (kind: string, text: string) => (sent.push({ kind, text }), true),
      startLead: async (key: string) => (leads.push(key), 'ok'),
    }))
    vi.doMock('@/lib/assistant/reply', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/reply')>()),
      answer: async () => {
        const a = answers[Math.min(gemini, answers.length - 1)]
        gemini += 1
        return { products: [], source: 'gemini' as const, audience: 'customer' as const, ...a }
      },
    }))
    const { respond } = await import('@/lib/assistant/respond')
    return { respond, sent, leads, calls: () => gemini }
  }

  it('«Азыр ала албайм кийин алам» на «Тариздейлиби?» — не анкета, отвечает модель', async () => {
    const { respond, calls } = await setup([{ text: 'Макул, даяр болгондо жазыңыз.' }])
    const r = await respond(
      wa('t:a1'),
      [
        { role: 'user', text: 'Канча' },
        { role: 'assistant', text: `${product.nameRu} — 23 900 сом. Тариздейлиби?` },
        { role: 'user', text: 'Азыр ала албайм кийин алам' },
      ],
      'ky',
      null,
      undefined,
      [product.id],
    )
    expect(r.text).not.toMatch(/Атыңыз ким/)
    expect(calls()).toBe(1)
  })

  it('«Акча котордум» без Jev — оплата: «руководство проверит» и 💳 владельцу, модель не зовём', async () => {
    const { respond, sent, calls } = await setup([{ text: 'Ответ модели.' }], null)
    const r = await respond(wa('t:a2'), [{ role: 'user', text: 'Акча котордум эле силерге\nТекшердиңерби' }], 'ky', null)
    expect(r.text).toMatch(/Руководство төлөмдү текшерип/)
    expect(sent.map((x) => x.kind)).toEqual(['payment'])
    expect(calls()).toBe(0)
  })

  it('фото чека — оплата, «Төлөдүмбү?» — нет (вопрос про рассрочку)', async () => {
    const receipt = '[Фото] На скриншоте электронный чек банка «Компаньон» об успешной оплате по QR-коду получателю «Смарт Центр» на сумму 21 400 KGS'
    const a = await setup([{ text: 'Ответ модели.' }], null)
    expect((await a.respond(wa('t:a3'), [{ role: 'user', text: receipt }], 'ky', null)).text).toMatch(/текшерип/)
    const b = await setup([{ text: 'Карызыңыз 5 000 сом.' }], null)
    expect((await b.respond(wa('t:a4'), [{ role: 'user', text: 'Төлөдүмбү?' }], 'ky', null)).text).toBe('Карызыңыз 5 000 сом.')
  })

  it('модель «подтвердила» оплату — заменяем на «руководство проверит»', async () => {
    const { respond, sent } = await setup([{ text: 'Төлөмүңүз түштү, рахмат!' }])
    const r = await respond(wa('t:a5'), [{ role: 'user', text: 'Мына' }], 'ky', null)
    expect(r.text).toMatch(/текшерип/)
    expect(sent.map((x) => x.kind)).toContain('payment')
  })

  it('скидка без просьбы — второй ответ без неё; «кымбат» — скидка остаётся', async () => {
    const one = await setup([{ text: 'Сизге 3% арзандатуу менен 23 180 сом.', discount: 3 }, { text: '2 комплект идиш батат.' }])
    const r = await one.respond(wa('t:a6'), [{ role: 'user', text: 'Канча идиш батат' }], 'ky', null)
    expect(r.text).toBe('2 комплект идиш батат.')
    expect(one.calls()).toBe(2)
    const two = await setup([{ text: 'Сизге 2% арзандатуу менен 23 420 сом.', discount: 2 }])
    const k = await two.respond(wa('t:a7'), [{ role: 'user', text: 'Кымбат экен' }], 'ky', null)
    expect(k.text).toMatch(/23 420/)
    expect(two.calls()).toBe(1)
  })

  it('«Фотолору барбы» — не «уточню у руководства»: модель отвечает сама', async () => {
    const { respond, leads, calls } = await setup([{ text: 'Түшүндүм, руководстводон тактап, жазам.', audience: 'staff' }, { text: 'Мына, Midea — 23 900 сом.' }])
    const r = await respond(wa('t:a8'), [{ role: 'user', text: 'Фотолору барбы' }], 'ky', null)
    expect(r.text).toBe('Мына, Midea — 23 900 сом.')
    expect(calls()).toBe(2)
    expect(leads).toEqual([])
  })

  it('долг по рассрочке — по-прежнему руководству', async () => {
    const { respond, leads, calls } = await setup([{ text: 'Түшүндүм.', audience: 'staff' }])
    const r = await respond(wa('t:a9'), [{ role: 'user', text: 'Карызым канча калды' }], 'ky', null)
    expect(r.handoff).toBe(true)
    expect(calls()).toBe(1)
    expect(leads).toEqual(['t:a9'])
  })

  it('в журнал — что решил Jev: «shop», «payment» словами, «down» когда молчал', async () => {
    process.env.JEV_API_KEY = 'test'
    try {
      const a = await setup([{ text: 'Бар, 23 900 сом.' }])
      expect((await a.respond(wa('t:j1'), [{ role: 'user', text: 'Идиш жуугуч барбы' }], 'ky', null)).jev).toBe('shop')
      const b = await setup([{ text: 'Бар.' }], null)
      expect((await b.respond(wa('t:j2'), [{ role: 'user', text: 'Идиш жуугуч барбы' }], 'ky', null)).jev).toBe('down')
      expect((await b.respond(wa('t:j3'), [{ role: 'user', text: 'Акча котордум' }], 'ky', null)).jev).toBe('payment')
    } finally {
      delete process.env.JEV_API_KEY
    }
  })

  it('служба поддержки WhatsApp — чужой бот, молчим', async () => {
    const { respond, calls } = await setup([{ text: 'Ответ модели.' }])
    const r = await respond(wa('t:a10'), [{ role: 'user', text: 'Я здесь, чтобы помочь вам. Номер вашего запроса 1234567.' }], 'ru', null)
    expect(r).toMatchObject({ silent: true, mute: true })
    expect(calls()).toBe(0)
  })
})
