import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { mentionsFreeDelivery } from '@/lib/assistant/policy'
import { systemInstruction } from '@/lib/assistant/prompt'
import { durableMap } from '@/lib/durable'
import { products } from '@/data/products'

describe('бесплатная доставка — только туда, куда правда бесплатно (аудит 03.10)', () => {
  it('узнаёт города из списка на трёх языках и с окончаниями', () => {
    for (const text of [
      'Ошко жеткиресизби', 'я из Оша', 'Бишкекке канча', 'Өзгөндөн жазып жатам', 'Үзгөнгө', 'Кызыл Кияга', 'Жалал-Абадда', 'Ноокатка',
      'Osh', "O'shdan", 'Ўшдан', 'Ўшга', 'Наукатга', "O'zgan", 'Бозорқўрғонга', 'Qurshab', 'Оштун', 'Ошская область', 'Манаска жеткиресизби', 'Манас району', 'Манас шаарына', 'Манастанмын', 'Manasga',
    ])
      expect(mentionsFreeDelivery(text), text).toBe(true)
  })
  it('не путает «ошибка» с Ошем и не обещает Таласу и Нарыну', () => {
    for (const text of [
      'ошибка в заказе', 'Таластан болом', 'Нарынга жеткиресизби', 'Каракол', 'хорошо',
      // «Манас» — имя и улица в каждом городе; «оша» по-узбекски — «тот»; другой город рядом — не обещаем
      'Мен Манас, канча турат', 'Нарын, Манас көчөсү 12', 'Манасова көчөсү', 'оша машина канча', 'Талас, бирок Бишкекте иштейм',
    ])
      expect(mentionsFreeDelivery(text), text).toBe(false)
  })
})

describe('модель знает, где пишет', () => {
  const at = (where: 'site' | 'whatsapp' | 'instagram' | 'telegram') =>
    systemInstruction('ru', null, 'ru', products, '', '', null, null, undefined, false, [], where)
  it('WhatsApp — не «чат на сайте»', () => {
    expect(at('whatsapp')).toContain('Ты отвечаешь в WhatsApp магазина')
    expect(at('whatsapp')).not.toContain('Ты отвечаешь в чате на сайте')
  })
  it('Instagram: номера нет', () => expect(at('instagram')).toContain('Номера телефона покупателя у нас нет'))
  it('по умолчанию — сайт', () => expect(at('site')).toContain('Ты отвечаешь в чате на сайте магазина'))
  it('язык сайта больше не спорит с языком покупателя', () => expect(at('whatsapp')).not.toContain('Язык покупателя сейчас'))
})

describe('durableMap — память, которая переживает перезапуск', () => {
  afterEach(() => vi.useRealTimers())
  it('запись старше ttl забывается: недельный черновик не перехватит новый разговор', () => {
    vi.useFakeTimers()
    const map = durableMap<string, number>(`test-${Math.random()}`, 1000)
    map.set('a', 1)
    expect(map.get('a')).toBe(1)
    vi.advanceTimersByTime(1500)
    expect(map.has('a')).toBe(false)
    expect(map.get('a')).toBeUndefined()
  })
  it('ключ-число остаётся числом (чат Telegram)', () => {
    const map = durableMap<number | string, string>(`test-${Math.random()}`, 60_000)
    map.set(42, 'x')
    expect(map.get(42)).toBe('x')
    expect(map.get('42')).toBeUndefined()
  })
})

describe('durableMap на диске', () => {
  it('после «перезапуска» (пустая память процесса) черновик читается из файла', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = mkdtempSync(join(tmpdir(), 'durable-'))
    const saved = { VITEST: process.env.VITEST, STATE_DIR: process.env.STATE_DIR }
    delete process.env.VITEST
    process.env.STATE_DIR = dir
    try {
      const before = durableMap<number | string, { step: string }>('restart', 60_000)
      before.set(777, { step: 'name' })
      await new Promise((r) => setTimeout(r, 1300))
      // Черновик заказа меняют на месте, без set() (order.ts nextQuestion) — это тоже должно попасть в файл.
      before.get(777)!.step = 'address'
      await new Promise((r) => setTimeout(r, 1300))
      // Перезапуск сайта: память процесса пустая.
      ;(globalThis as { __smartcentr?: Record<string, unknown> }).__smartcentr = {}
      const after = durableMap<number | string, { step: string }>('restart', 60_000)
      expect(after).not.toBe(before)
      expect(after.get(777)).toEqual({ step: 'address' })
    } finally {
      process.env.VITEST = saved.VITEST
      if (saved.STATE_DIR === undefined) delete process.env.STATE_DIR
      else process.env.STATE_DIR = saved.STATE_DIR
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('продавец, а не реклама (владелец 03.10: «звучит не как человек»)', () => {
  const text = systemInstruction('ru', null, 'ky', products)
  it('не вываливает всё сразу и не пишет по шаблону', () => {
    expect(text).toContain('НЕ ВЫВАЛИВАЙ ВСЁ СРАЗУ')
    expect(text).toContain('Не пиши каждый ответ по одному шаблону')
    expect(text).toContain('Не два и не три вопроса сразу')
  })
  it('пишет в тон покупателю и его словами', () => expect(text).toContain('Пиши в тон покупателю'))
  it('имя покупателя не выспрашивает', () => {
    expect(text).toContain('не выспрашивай')
    expect(text).not.toMatch(/в первом или втором ответе спроси, как зовут/)
  })
  it('в образцах нет обещания «до центра района бесплатно» всем подряд и нет настоящих цен', () => {
    expect(text).not.toContain('Привезём бесплатно до центра района.')
    expect(text).not.toContain('до центра района или области — бесплатно')
    expect(text).toContain('Не знаешь, откуда он, — не обещай')
    const samples = text.slice(text.indexOf('ОБРАЗЦЫ'), text.indexOf('ЧЕГО НЕЛЬЗЯ'))
    expect(samples).not.toMatch(/15 900|18 800/)
  })
  it('правила не задублированы: «Здоровайся один раз» — одна строка', () => {
    expect(text.split('Здоровайся один раз').length - 1).toBe(1)
    expect(text.split('НЕ ТОРОПИ С ОФОРМЛЕНИЕМ').length - 1).toBe(1)
  })
})

describe('«Оформляем?» — по ситуации, а не в каждом ответе (владелец 03.10)', () => {
  const wa = (key: string) => ({ key, orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: { phone: '+996555000077' } })
  const withModel = async (said: string, turns: { role: 'user' | 'assistant'; text: string }[]) => {
    vi.resetModules()
    vi.doMock('@/lib/assistant/reply', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/reply')>()),
      answer: async () => ({ text: said, products: [], source: 'gemini' as const, audience: 'customer' as const }),
    }))
    const { respond } = await import('@/lib/assistant/respond')
    const r = await respond(wa(`wa:offer-${Math.random()}`), turns, 'ky', null)
    vi.doUnmock('@/lib/assistant/reply')
    vi.resetModules()
    return r.text
  }

  it('в первом ответе «Тариздейлиби?» убирается', async () => {
    const text = await withModel('Бар, 15 900 сом. Тариздейлиби?', [{ role: 'user', text: 'Эндуро барбы?' }])
    expect(text).toBe('Бар, 15 900 сом.')
  })
  it('ещё выбирает (спрашивает характеристику) — не предлагаем', async () => {
    const text = await withModel('Аккумулятор 12 Ач. Тариздейлиби?', [
      { role: 'user', text: 'Эндуро барбы?' }, { role: 'assistant', text: 'Бар, 15 900 сом. Балаңыз канча жашта?' },
      { role: 'user', text: 'Аккумулятору канча?' },
    ])
    expect(text).not.toMatch(/Тариздейлиби/)
  })
  it('готов («Жакты, Ошко жеткиресизби?») — предложение остаётся', async () => {
    const text = await withModel('Ооба, акысыз. Тариздейлиби?', [
      { role: 'user', text: 'Эндуро барбы?' }, { role: 'assistant', text: 'Бар, 15 900 сом.' },
      { role: 'user', text: 'Жакты. Ошко жеткиресизби?' },
    ])
    expect(text).toMatch(/Тариздейлиби/)
  })
  it('предлагали в прошлом ответе — второй раз подряд не предлагаем, даже если готов', async () => {
    const text = await withModel('Ооба. Тариздейлиби?', [
      { role: 'user', text: 'Эндуро барбы?' }, { role: 'assistant', text: 'Бар, 15 900 сом. Тариздейлиби?' },
      { role: 'user', text: 'Жакты, кантип төлөйм?' },
    ])
    expect(text).toBe('Ооба.')
  })
  it('разговор идёт давно, а не предлагали ни разу — можно предложить', async () => {
    const text = await withModel('Кафилдиги 1 жыл. Алсаңыз, ушул жерден тариздеп берем?', [
      { role: 'user', text: 'Эндуро барбы?' }, { role: 'assistant', text: 'Бар.' },
      { role: 'user', text: 'Түсү кандай?' }, { role: 'assistant', text: 'Кызыл.' },
      { role: 'user', text: 'Кепилдиги барбы?' },
    ])
    expect(text).toMatch(/тариздеп берем/)
  })
})

describe('«айта оласизми?» — «можете сказать?», не «купите?» (имтихон 03.10)', () => {
  it('OFFER не путает «айта оласизми» и «айта аласызбы» с предложением купить', async () => {
    const { OFFER } = await import('@/lib/telegram/order')
    expect(OFFER.test('Кайси товар, номини айта оласизми?')).toBe(false)
    expect(OFFER.test('Расмини юбора оласизми?')).toBe(false)
    expect(OFFER.test('Моделин айта аласызбы?')).toBe(false)
    expect(OFFER.test('Флагманни оласизми?')).toBe(true)
    expect(OFFER.test('Аласызбы?')).toBe(true)
    expect(OFFER.test('Тариздейлиби?')).toBe(true)
  })
})

describe('уроки настоящих переписок 26.09–03.10', () => {
  it('кыргыз в голосовом с казахскими «қ» — кыргызский, а не узбекский', async () => {
    const { detectLang } = await import('@/lib/assistant/talk')
    const q = '[Голосовое] Алло, ассалому алейкум. Қандайсыз, ака? Жақшысызбы? Ден соолуктар жақшыбы? Мына бу ака мини мотоцикл боюнча чыгып жатат, сатууда барбы же заказга келеби?'
    expect(detectLang(q, 'ru')).toBe('ky')
    expect(detectLang('Ассалому алейкум, қанча турады? Ўзбекча ёзинг', 'ru')).toBe('uz')
  })
  it('«Пилисоска», «стиралкаларды», «муздаткычтар» находят товар', async () => {
    const { searchProducts } = await import('@/lib/assistant/knowledge')
    for (const q of ['Пилисоска', 'стиралкаларды', 'пилесос керак']) // во вшитом каталоге холодильников нет
      expect(searchProducts(q, 'ru').length, q).toBeGreaterThan(0)
  })
  it('«К сожалению», «Тилекке каршы» в начале фразы убираются', async () => {
    const { houseStyle } = await import('@/lib/assistant/reply')
    expect(houseStyle('К сожалению, шлемов нет. Есть Эндуро.', 'ru')).toBe('Шлемов нет. Есть Эндуро.')
    expect(houseStyle('Бар. Тилекке каршы, шлем жок.', 'ky')).toBe('Бар. Шлем жок.')
  })
  it('уехал или отказался — «ещё думаете?» не шлём', async () => {
    const { followUp } = await import('@/lib/assistant/followup')
    const { products: list } = await import('@/data/products')
    const id = list.find((p) => p.price > 0)!.id
    expect(await followUp([{ role: 'user', text: 'Мен эртен россияга кетем' }, { role: 'assistant', text: 'Түшүнүктүү, жакшы барып келиңиз.' }], [id], 'ky')).toEqual({ skip: 'declined' })
    expect(await followUp([{ role: 'user', text: 'А жок рахмат' }, { role: 'assistant', text: 'Макул.' }], [id], 'ky')).toEqual({ skip: 'declined' })
  })
  it('«уточню у руководства» не повторяется: второй раз «уже передала», третий — тишина', async () => {
    vi.resetModules()
    vi.doMock('@/lib/assistant/reply', async (orig) => ({
      ...(await orig<typeof import('@/lib/assistant/reply')>()),
      answer: async () => ({ text: 'x', products: [], source: 'gemini' as const, audience: 'staff' as const }),
    }))
    const { respond } = await import('@/lib/assistant/respond')
    const wa = { key: 'wa:ack', orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: {} }
    const ack = 'Түшүндүм, руководстводон тактап, жазам.'
    const second = await respond(wa, [{ role: 'user', text: 'Ылдамдыгы канча?' }, { role: 'assistant', text: ack }, { role: 'user', text: 'Канча?' }], 'ky', null)
    expect(second.text).toBe('Руководствого айтып койдум, жакында жооп беришет.')
    const third = await respond(wa, [{ role: 'user', text: 'a' }, { role: 'assistant', text: ack }, { role: 'user', text: 'b' }, { role: 'assistant', text: second.text }, { role: 'user', text: 'Жооп бериңизчи' }], 'ky', null)
    expect(third.silent).toBe(true)
    vi.doUnmock('@/lib/assistant/reply')
    vi.resetModules()
  })
  it('системное сообщение Facebook — не покупатель', async () => {
    const { respond } = await import('@/lib/assistant/respond')
    const wa = { key: 'wa:fb', orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: {} }
    const r = await respond(wa, [{ role: 'user', text: 'Your WhatsApp account is successfully connected to your Facebook Page and added to the S маркет business portfolio.' }], 'ru', null)
    expect(r.silent).toBe(true)
  })
})

describe('короткая кыргызская фраза без «ы»', () => {
  it('«9 жашка толот да» — кыргызский', async () => {
    const { talkLang } = await import('@/lib/assistant/reply')
    expect(talkLang([{ role: 'user', text: '9 жашка толот да' }], 'ru')).toBe('ky')
  })
})

describe('журнал сайта 20.09–03.10', () => {
  it('кнопка «Заказать: … GEPARD M2 16\'» — одна штука, «M2» не количество', async () => {
    const { wantedQty } = await import('@/lib/assistant/respond')
    expect(wantedQty("Заказать: Электро Велик GEPARD M2 16'")).toBe(1)
    expect(wantedQty('беру X5')).toBe(1)
    expect(wantedQty('беру 2')).toBe(2)
    expect(wantedQty('2 шт')).toBe(2)
  })
  it('попросил по-русски (латиницей) — дальше по-русски', async () => {
    const { talkLang } = await import('@/lib/assistant/reply')
    const turns = [
      { role: 'user' as const, text: 'salom' }, { role: 'assistant' as const, text: 'Ассаламу алейкум. Эшитаман, кандай техника керак?' },
      { role: 'user' as const, text: 'po russki mojno' },
    ]
    expect(talkLang(turns, 'ru')).toBe('ru')
    expect(talkLang([...turns, { role: 'assistant' as const, text: 'x' }, { role: 'user' as const, text: 'ya ne ponimayu tebya' }], 'ru')).toBe('ru')
    expect(talkLang([{ role: 'user' as const, text: 'orusча эмес, кыргызча жазыңыз' }], 'ru')).toBe('ky')
  })
  it('адрес «15» — не «не получилось», а переспрос с примером', async () => {
    const { start, step } = await import('@/lib/telegram/order')
    const { products: list } = await import('@/data/products')
    const p = list.find((x) => x.price > 0 && x.variants.some((v) => v.stock > 0))!
    await start('t:addr', [p.id], 'ky', 'test', { name: 'Байэл', phone: '0555123456' })
    await step('t:addr', 'Ош', 'ky', 'ky')
    expect(await step('t:addr', '15', 'ky', 'ky')).toMatch(/мисалы: Ленин 15/)
  })
})

describe('напоминание как у продавца (владелец 03.10, скриншот WhatsApp)', () => {
  it('без кода модели и цены, «бесплатно» не повторяет', async () => {
    const { followUp, spokenName } = await import('@/lib/assistant/followup')
    expect(spokenName('Электро Эндуро WN-A10')).toBe('Электро Эндуро')
    expect(spokenName('Стиральная машина FLAGMAN AV-80MXLB(BG)')).toBe('FLAGMAN')
    const { products: list } = await import('@/data/products')
    const p = list.find((x) => x.price > 0)!
    const turns = [
      { role: 'user' as const, text: 'Баасы канча. Кызыл кыя га чейин доставка канча болот' },
      { role: 'assistant' as const, text: 'Бар. Кызыл-Кыянын борборуна чейин жеткирүү акысыз.' },
    ]
    const r = (await followUp(turns, [p.id], 'ky')) as { text: string }
    expect(r.text).toMatch(/боюнча суроо калдыбы\? Жазыңыз, жардам берем\.$/)
    expect(r.text).not.toMatch(/сом|акысыз|ойлонуп/)
  })
})

describe('голосовое из Instagram (03.10): тип файла по первым байтам', () => {
  it('MP4-контейнер, ogg, mp3 и «octet-stream»', async () => {
    const { mediaMime } = await import('@/lib/assistant/media-mime')
    const mp4 = Buffer.from('\x00\x00\x00\x18ftypM4A \x00\x00', 'latin1')
    expect(mediaMime('audio', 'application/octet-stream', mp4)).toBe('video/mp4')
    expect(mediaMime('audio', 'audio/mp4', mp4)).toBe('video/mp4')
    expect(mediaMime('audio', 'audio/ogg', Buffer.from('OggS'))).toBe('audio/ogg')
    expect(mediaMime('audio', '', Buffer.from('ID3\x03', 'latin1'))).toBe('audio/mpeg')
    expect(mediaMime('image', 'application/octet-stream', Buffer.from('x'))).toBe('image/jpeg')
  })
})

describe('кэш Gemini (04.10): постоянная часть промпта одна на всех', () => {
  it('до «СЕЙЧАС» — одинаково у разных каналов, языков, покупателей и вопросов', async () => {
    const { NOW_MARK } = await import('@/lib/assistant/gemini')
    const fixed = (s: string) => s.slice(0, s.indexOf(NOW_MARK))
    const a = systemInstruction('ru', null, 'ky', products, 'кир машина', '', null, null, 'Азамат', true, [], 'whatsapp')
    const b = systemInstruction('ru', null, 'uz', products, 'пылесос до 10000', '', 10000, products[0], undefined, false, [products[1].id], 'instagram')
    expect(a.split(NOW_MARK).length).toBe(2)
    expect(fixed(a)).toBe(fixed(b))
    expect(fixed(a).length).toBeGreaterThan(8000)
    // Канал, язык, покупатель — только после границы.
    expect(fixed(a)).not.toMatch(/Ты отвечаешь в WhatsApp|ЯЗЫК ОТВЕТА: |Имя известно/)
    expect(b.slice(b.indexOf(NOW_MARK))).toMatch(/ТОЛЬКО кириллицей/)
  })
})

describe('расход Gemini (04.10): считаем, показываем, бережём', () => {
  it('цена дня: ввод, кэш вдесятеро дешевле, ответ, хранение; с 2027 — вдвое дороже', async () => {
    const { costOf } = await import('@/lib/assistant/usage')
    const u = { calls: 1, input: 1_000_000, cached: 500_000, output: 100_000, caches: 0, storage: 0 }
    // 0,5 млн × 0,75 + 0,5 млн × 0,075 + 0,1 млн × 3,75 = 0,375 + 0,0375 + 0,375
    expect(costOf(u, '2026-10-04')).toBeCloseTo(0.7875, 6)
    expect(costOf(u, '2027-01-02')).toBeCloseTo(1.575, 6)
  })
  it('строка сводки и пустой день', async () => {
    const { recordCall, usageLine, bishkekToday } = await import('@/lib/assistant/usage')
    expect(usageLine('2000-01-01')).toMatch(/запросов не было/)
    recordCall({ promptTokenCount: 15_000, cachedContentTokenCount: 10_538, candidatesTokenCount: 70, thoughtsTokenCount: 100 })
    expect(usageLine(bishkekToday())).toMatch(/💰 Gemini: запросов \d+, .*% из кэша\) — ≈ \$\d+,\d\d\.\n   сайт \$\d+,\d\d \(1\)/)
    // 06.10: на что ушли деньги — «мысли» модели отдельно от ответа, и цена одного запроса
    expect(usageLine(bishkekToday())).toMatch(/\n   На что: .*в среднем \$\d+,\d\d за запрос$/)
  })
  it('«мысли» считаются отдельно от ответа', async () => {
    const { recordCall, usageOf } = await import('@/lib/assistant/usage')
    const day = new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10)
    const before = usageOf(day).thoughts ?? 0
    recordCall({ promptTokenCount: 1000, candidatesTokenCount: 50, thoughtsTokenCount: 300 }, 'instagram')
    expect((usageOf(day).thoughts ?? 0) - before).toBe(300)
  })
  it('утренняя сводка показывает расход', async () => {
    const { dailyDigest } = await import('@/lib/assistant/digest')
    expect(dailyDigest([], '2026-10-04', '💰 Gemini: 3 запросов')).toContain('💰 Gemini: 3 запросов')
  })
  it('сводка разделов — без остатков (кэш не пересоздаётся каждые 10 минут)', async () => {
    const { catalogSections } = await import('@/lib/assistant/knowledge')
    const text = catalogSections(products)
    expect(text).not.toMatch(/в наличии \d/)
    expect(text).toMatch(/обычно \d+–\d+ сом/)
    // Товар ушёл со склада — сводка та же.
    const sold = products.map((p, i) => (i === 0 ? { ...p, variants: p.variants.map((v) => ({ ...v, stock: 0 })) } : p))
    expect(catalogSections(sold)).toBe(text)
  })
  it('первое сообщение — одно приветствие: отвечаем без модели, на языке приветствия', async () => {
    const { respond } = await import('@/lib/assistant/respond')
    const ch = (key: string) => ({ key, orderSource: 'x', leadChannel: 'whatsapp' as const, known: {} })
    const uz = await respond(ch('g1'), [{ role: 'user', text: 'Ассалому алейкум ука яхшимисиз' }], 'ru', null)
    expect(uz).toMatchObject({ source: 'flow', text: 'Ассаламу алейкум. Эшитаман, кандай техника керак?' })
    const ky = await respond(ch('g2'), [{ role: 'user', text: 'Саламатсызбы' }], 'ru', null)
    expect(ky.text).toBe('Ассаламу алейкум. Угуп жатам, кандай техника керек?')
    // Есть вопрос — уже не приветствие: отвечает модель (здесь без ключа — запасной режим).
    const ask = await respond(ch('g3'), [{ role: 'user', text: 'Салам, кир машина барбы' }], 'ru', null)
    expect(ask.source).not.toBe('flow')
    // Разговор уже шёл — приветствие отдаём модели: она помнит, о чём говорили.
    const mid = await respond(ch('g4'), [{ role: 'user', text: 'кир машина' }, { role: 'assistant', text: 'Бар.' }, { role: 'user', text: 'Салам' }], 'ru', null)
    expect(mid.text).not.toBe('Ассаламу алейкум. Слушаю вас — что подобрать?')
  })
})

describe('расход по каналам', () => {
  it('WhatsApp, Instagram и голосовые — отдельно, дорогие первыми', async () => {
    const { recordCall, usageOf, usageLine, bishkekToday } = await import('@/lib/assistant/usage')
    const before = usageOf(bishkekToday()).ch ?? {}
    recordCall({ promptTokenCount: 20_000, cachedContentTokenCount: 10_000, candidatesTokenCount: 100 }, 'whatsapp')
    recordCall({ promptTokenCount: 20_000, cachedContentTokenCount: 10_000, candidatesTokenCount: 100 }, 'whatsapp')
    recordCall({ promptTokenCount: 15_000, cachedContentTokenCount: 10_000, candidatesTokenCount: 80 }, 'instagram')
    recordCall({ promptTokenCount: 1_000, candidatesTokenCount: 40 }, 'media')
    const ch = usageOf(bishkekToday()).ch!
    expect(ch.whatsapp.calls - (before.whatsapp?.calls ?? 0)).toBe(2)
    expect(ch.instagram.calls - (before.instagram?.calls ?? 0)).toBe(1)
    const line = usageLine(bishkekToday())
    expect(line).toMatch(/WhatsApp \$\d+,\d\d \(2\)/)
    expect(line.indexOf('WhatsApp')).toBeLessThan(line.indexOf('Instagram'))
    expect(line).toMatch(/голосовые и фото/)
  })
})
