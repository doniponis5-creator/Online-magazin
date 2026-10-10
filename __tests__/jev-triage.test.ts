import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { decide, paidAmount, parseTriage, type Triage } from '@/lib/assistant/triage'
import { hotLines, parseHot } from '@/lib/assistant/hot'

/** Ответ Jev на пять вопросов «да/нет». */
const scores = (s: Partial<Triage>): Triage => ({ shop: 0.1, staff: 0.1, personal: 0.1, payment: 0.1, complaint: 0.1, ...s })

describe('Jev до Gemini: что делать с сообщением (04.10)', () => {
  it('замер на настоящих сообщениях 26.09–03.10 → то же решение', () => {
    // Числа — ответы Jev из замера 04.10.
    expect(decide({ payment: 0.93, personal: 0.65, staff: 0.42, shop: 0.15, complaint: 0.11 }, false)).toEqual({ kind: 'payment', alarm: false })
    expect(decide({ payment: 0.92, shop: 0.53, staff: 0.16, personal: 0.07, complaint: 0.04 }, false).kind).toBe('payment')
    expect(decide({ staff: 0.75, shop: 0.54, complaint: 0.41, personal: 0.34, payment: 0.3 }, false).kind).toBe('staff')
    expect(decide({ personal: 0.92, staff: 0.53, shop: 0.11, complaint: 0.04, payment: 0.04 }, false).kind).toBe('personal')
    expect(decide({ complaint: 0.74, staff: 0.58, personal: 0.44, shop: 0.26, payment: 0.19 }, false)).toEqual({ kind: 'shop', alarm: true })
    expect(decide({ shop: 0.91, complaint: 0.65, payment: 0.33, staff: 0.16, personal: 0.15 }, false)).toEqual({ kind: 'shop', alarm: true })
    expect(decide({ shop: 0.49, personal: 0.32, staff: 0.19, complaint: 0.13, payment: 0.06 }, false)).toEqual({ kind: 'shop', alarm: false })
  })
  it('идёт продажа — «не покупатель» не бывает, а чек и жалоба — бывают', () => {
    expect(decide(scores({ personal: 0.95, shop: 0.05 }), true).kind).toBe('shop')
    expect(decide(scores({ staff: 0.9, shop: 0.2 }), true).kind).toBe('shop')
    expect(decide(scores({ payment: 0.95, shop: 0.2 }), true).kind).toBe('payment')
    expect(decide(scores({ complaint: 0.8 }), true).alarm).toBe(true)
  })
  it('тревога «ЖАЛОБА» — только когда жалоба есть в словах (05.10)', () => {
    const jevSays = scores({ shop: 0.6, complaint: 0.7 })
    // Название товара — не жалоба, хоть Jev и сказал 0,7.
    expect(decide(jevSays, false, 'Идиш жууган аппарат').alarm).toBe(false)
    // Спор о цене — не жалоба.
    expect(decide(jevSays, false, 'Кымбат экен, Москвада арзан').alarm).toBe(false)
    // Настоящие жалобы — тревога.
    expect(decide(jevSays, false, 'Не работает').alarm).toBe(true)
    expect(decide(jevSays, false, 'кир жуугуч бузулуп калды').alarm).toBe(true)
    expect(decide(jevSays, false, 'Посудомойку взяли у вас на прошлой неделе, течёт снизу вода').alarm).toBe(true)
    // Jev не сказал «жалоба» — слова тревогу не поднимают.
    expect(decide(scores({ shop: 0.9, complaint: 0.2 }), false, 'Не работает').alarm).toBe(false)
  })
  it('сомнение — к модели: «оплатил?» рядом с вопросом о товаре — не чек', () => {
    expect(decide(scores({ payment: 0.85, shop: 0.7 }), false).kind).toBe('shop')
    expect(decide(scores({ personal: 0.9, shop: 0.4 }), false).kind).toBe('shop')
    expect(decide(scores({ staff: 0.8, shop: 0.7 }), false).kind).toBe('shop')
  })
  it('ответ Jev: битый или неполный — null, а не догадка', () => {
    expect(parseTriage(null)).toBeNull()
    expect(parseTriage({ answers: { shop: { noul: 0.9 } } })).toBeNull()
    const ok = parseTriage({ answers: { shop: { noul: 0.9 }, staff: { noul: 0.1 }, personal: { noul: 0 }, payment: { noul: 1.2 }, complaint: { noul: '0.3' } } })
    expect(ok).toEqual({ shop: 0.9, staff: 0.1, personal: 0, payment: 1, complaint: 0.3 })
  })
  it('сумма из чека и слов', () => {
    expect(paidAmount('перевод на сумму 4 000 сомов (KGS)')).toBe(4000)
    expect(paidAmount('Квитанция О!Деньги на сумму 21 000 сомов')).toBe(21000)
    expect(paidAmount('5500.00 KGS')).toBe(5500)
    expect(paidAmount("15900 so'm tashladim")).toBe(15900)
    expect(paidAmount('төлөм жүргүзүп койдум')).toBeNull()
  })
})

describe('respond: Jev сортирует WhatsApp до модели', () => {
  afterEach(() => {
    vi.doUnmock('@/lib/assistant/triage')
    vi.doUnmock('@/lib/assistant/leads')
    vi.doUnmock('@/lib/assistant/reply')
    vi.resetModules()
  })
  const wa = (key: string) => ({ key, orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: { phone: '+996555000099', name: 'Азамат' } })
  async function setup(s: Triage) {
    vi.resetModules()
    const sent: { kind: string; text: string }[] = []
    let gemini = 0
    vi.doMock('@/lib/assistant/triage', async (orig) => ({ ...(await orig<typeof import('@/lib/assistant/triage')>()), triage: async () => s }))
    vi.doMock('@/lib/assistant/leads', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/leads')>()),
      notifyOwner: async (kind: string, text: string) => (sent.push({ kind, text }), true),
      startLead: async () => 'ok',
    }))
    vi.doMock('@/lib/assistant/reply', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/reply')>()),
      answer: async () => ((gemini += 1), { text: 'Ответ модели.', products: [], source: 'gemini' as const, audience: 'customer' as const }),
    }))
    const { respond } = await import('@/lib/assistant/respond')
    return { respond, sent, calls: () => gemini }
  }

  it('чек: «рахмат, проверим» без модели, владельцу 💳 с суммой', async () => {
    const { respond, sent, calls } = await setup(scores({ payment: 0.93, shop: 0.15 }))
    const r = await respond(wa('t:pay'), [{ role: 'user', text: '[Фото] перевод на сумму 4 000 сомов получателю Дониёрбек А.' }], 'ky', null)
    expect(r).toMatchObject({ source: 'flow', handoff: true })
    expect(r.text).toMatch(/Рахмат! Руководство/)
    expect(calls()).toBe(0)
    expect(sent).toEqual([expect.objectContaining({ kind: 'payment', text: expect.stringContaining('Сумма: 4000 сом') })])
  })
  it('не про магазин и не идёт продажа — молчим, модель не зовём', async () => {
    const { respond, calls } = await setup(scores({ personal: 0.92, shop: 0.1 }))
    const r = await respond(wa('t:pers'), [{ role: 'user', text: 'Даниярбек, кымыз ала барам эртең' }], 'ky', null)
    // Первое сообщение нового номера — молчим, но чат на 12 часов не глушим: Jev мог ошибиться (ревью 10.10)
    expect(r).toMatchObject({ silent: true, mute: false })
    expect(calls()).toBe(0)
  })
  it('не про магазин посреди переписки — молчим и глушим', async () => {
    const { respond, calls } = await setup(scores({ personal: 0.92, shop: 0.1 }))
    const r = await respond(
      wa('t:pers3'),
      [
        { role: 'user', text: 'Салам' },
        { role: 'assistant', text: 'Ассаламу алейкум. Угуп жатам, кандай техника керек?' },
        { role: 'user', text: 'Даниярбек, кымыз ала барам эртең' },
      ],
      'ky',
      null,
    )
    expect(r).toMatchObject({ silent: true, mute: true })
    expect(calls()).toBe(0)
  })
  it('то же, но бот уже показывал товар — отвечает модель', async () => {
    const { respond, calls } = await setup(scores({ personal: 0.92, shop: 0.1 }))
    await respond(wa('t:pers2'), [{ role: 'user', text: 'Эртең Nova 7 сатсам…' }], 'ky', null, undefined, ['cb-00000029'])
    expect(calls()).toBe(1)
  })
  it('работнику о своём — «уточню у руководства» без модели', async () => {
    const { respond, calls } = await setup(scores({ staff: 0.75, shop: 0.5 }))
    const r = await respond(wa('t:staff'), [{ role: 'user', text: "Doniyor, berib ketdim, ustanovka qilganimiz yo'q" }], 'ru', null)
    expect(r.handoff).toBe(true)
    expect(r.text).toMatch(/руководств/i)
    expect(calls()).toBe(0)
  })
  it('жалоба — владельцу 🚨 один раз за день, а покупателю отвечает модель', async () => {
    const { respond, sent, calls } = await setup(scores({ complaint: 0.74, shop: 0.3 }))
    const turns = [{ role: 'user' as const, text: 'Стиралкани хали бери карамеди, бола келмади' }]
    const r = await respond(wa('t:compl'), turns, 'ru', null)
    expect(r.text).toBe('Ответ модели.')
    await respond(wa('t:compl'), turns, 'ru', null)
    expect(sent.filter((s) => s.kind === 'complaint')).toHaveLength(1)
    expect(calls()).toBe(2)
  })
  it('вопрос о товаре — как раньше, модель', async () => {
    const { respond, sent, calls } = await setup(scores({ shop: 0.95 }))
    await respond(wa('t:shop'), [{ role: 'user', text: 'Кир машина 8 кг барбы?' }], 'ky', null)
    expect(calls()).toBe(1)
    expect(sent).toHaveLength(0)
  })
})

describe('«Кому позвонить сегодня»', () => {
  it('ответ Jev → оценка; непонятный — null', () => {
    expect(parseHot({ answers: { stage: { choice: 'hot', confidence: 0.9 }, why: { choice: 'trust' } } }, '+996 1', 'нақд бериб олсам?', 'Электро Эндуро'))
      .toEqual({ who: '+996 1', stage: 'hot', why: 'trust', sure: 0.9, last: 'нақд бериб олсам?', product: 'Электро Эндуро' })
    expect(parseHot({ answers: { stage: { choice: 'maybe' } } }, 'x', '', '')).toBeNull()
  })
  it('сначала «позвоните», потом «напомнить»; купившие и знакомые не попадают', () => {
    const lines = hotLines([
      { who: '+996 2', stage: 'warm', why: 'price', sure: 0.5, last: 'кымбат экен', product: 'Эндуро' },
      { who: '+996 1', stage: 'hot', why: 'trust', sure: 1, last: '[Голосовое] колго тийгенде төлөсөм болобу', product: 'Электро Эндуро' },
      { who: '+996 3', stage: 'bought', why: 'none', sure: 1, last: 'төлөп койдум', product: '' },
      { who: '+996 4', stage: 'not_customer', why: 'none', sure: 1, last: 'кымыз', product: '' },
    ]).join('\n')
    expect(lines.indexOf('🔥 Позвоните сегодня')).toBeLessThan(lines.indexOf('⏳ Отложили'))
    expect(lines).toContain('• +996 1 — Электро Эндуро — позвоните голосом, пригласите в магазин\n  «колго тийгенде төлөсөм болобу»')
    expect(lines).toContain('рассрочку MIslamic')
    expect(lines).not.toMatch(/\+996 3|\+996 4/)
  })
  it('звонить некому — блока нет', () => {
    expect(hotLines([{ who: 'x', stage: 'cold', why: 'none', sure: 1, last: '', product: '' }])).toEqual([])
  })
})

describe('замечания ревью 04.10', () => {
  it('имена не уходят в Jev', async () => {
    const { withoutNames } = await import('@/lib/assistant/triage')
    expect(withoutNames('Азамат, есть Флагман. Азаматка привет', ['Азамат', undefined, ''])).toBe('Имя, есть Флагман. Азаматка привет')
    expect(withoutNames('a.b (x)', ['a.b (x)'])).toBe('Имя')
  })
  it('сумма: «5.500 сом», «5,500 сом», «3000с», «оплатил 5500 с»', () => {
    expect(paidAmount('5.500 сом')).toBe(5500)
    expect(paidAmount('5,500 сом')).toBe(5500)
    expect(paidAmount('3000с')).toBe(3000)
    expect(paidAmount('оплатил 5500 с карты')).toBe(5500)
    expect(paidAmount('5500.00 KGS')).toBe(5500)
    expect(paidAmount('3000 сомдон')).toBe(3000)
  })
  it('«кому позвонить»: ответы на «как вас зовут» и «улица и дом» в Jev не уходят', async () => {
    const { chatOf } = await import('@/lib/assistant/hot')
    const text = chatOf([
      { role: 'user', text: 'беру' },
      { role: 'assistant', text: 'Хорошо, оформим. Как вас зовут?' },
      { role: 'user', text: 'Нурсеит' },
      { role: 'assistant', text: 'Улица и дом?' },
      { role: 'user', text: 'Ташбулак кочосу 37' },
      { role: 'user', text: 'номерим 0700 441 154' },
    ])
    expect(text).not.toMatch(/Нурсеит|Ташбулак|441/)
    expect(text).toContain('[ответ скрыт]')
  })
})

describe('respond: замечания ревью', () => {
  afterEach(() => {
    vi.doUnmock('@/lib/assistant/triage')
    vi.doUnmock('@/lib/assistant/leads')
    vi.doUnmock('@/lib/assistant/reply')
    vi.resetModules()
  })
  async function setup(s: Triage, delivered = true) {
    vi.resetModules()
    const sent: { kind: string; who: { name?: string }; ref?: string }[] = []
    let gemini = 0
    vi.doMock('@/lib/assistant/triage', async (orig) => ({ ...(await orig<typeof import('@/lib/assistant/triage')>()), triage: async () => s }))
    vi.doMock('@/lib/assistant/leads', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/leads')>()),
      notifyOwner: async (kind: string, _t: string, who: { name?: string }, _c: string, ref?: string) => (sent.push({ kind, who, ref }), delivered),
      startLead: async () => 'ok',
    }))
    vi.doMock('@/lib/assistant/reply', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/reply')>()),
      answer: async () => ((gemini += 1), { text: 'Ответ модели.', products: [], source: 'gemini' as const, audience: 'customer' as const }),
    }))
    const { respond } = await import('@/lib/assistant/respond')
    return { respond, sent, calls: () => gemini }
  }
  it('«Төлөдүмбү? Карызым канча?» — вопрос, не чек: отвечает модель', async () => {
    const { respond, sent, calls } = await setup(scores({ payment: 0.9, shop: 0.2 }))
    const wa = { key: 'wa:q', orderSource: 'x', leadChannel: 'whatsapp' as const, known: { phone: '+996555000011' } }
    const r = await respond(wa, [{ role: 'user', text: 'Төлөдүмбү? Карызым канча калды?' }], 'ky', null)
    expect(r.text).toBe('Ответ модели.')
    expect(calls()).toBe(1)
    expect(sent).toHaveLength(0)
  })
  it('Instagram: владельцу — «Instagram @ник», повтор отсекается по чату, а не по имени', async () => {
    const { respond, sent } = await setup(scores({ payment: 0.95, shop: 0.1 }))
    const ig = { key: 'ig:123', orderSource: 'x', leadChannel: 'instagram' as const, known: { name: 'Айбек' }, label: 'Instagram @aibek_osh' }
    await respond(ig, [{ role: 'user', text: '[Фото] чек перевода 15 900 сомов' }], 'ky', null)
    expect(sent[0]).toMatchObject({ kind: 'payment', who: { name: 'Instagram @aibek_osh, Айбек' }, ref: 'ig:123' })
  })
  it('жалоба не дошла (сервер лежал) — со следующим сообщением пробуем снова', async () => {
    const { respond, sent } = await setup(scores({ complaint: 0.8, shop: 0.3 }), false)
    const wa = { key: 'wa:retry', orderSource: 'x', leadChannel: 'whatsapp' as const, known: { phone: '+996555000012' } }
    await respond(wa, [{ role: 'user', text: 'синди' }], 'ky', null)
    await respond(wa, [{ role: 'user', text: 'синди, иштебей атат' }], 'ky', null)
    expect(sent.filter((s) => s.kind === 'complaint')).toHaveLength(2)
  })
})
