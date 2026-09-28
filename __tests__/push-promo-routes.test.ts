import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

/**
 * Согласие на уведомления «Новинки и скидки»: «Кабинет» спрашивает сайт, сайт — сервер SBonus.
 * Это отдельное согласие, не то же, что напоминания о корзине. Проверяем снаружи: что пришло
 * в маршрут сайта и что ушло на сервер. Сервер подменён записью запросов; адрес, секрет и номера выдуманы.
 */
const session = vi.hoisted(() => ({ current: null as { phone: string; name: string; exp: number } | null }))
vi.mock('@/app/api/customer/route-helpers', () => ({
  currentSession: async () => session.current,
  clientIp: () => '',
}))

const SERVER = 'http://sbonus.test'
const PHONE = '+996700111222'
const sent: { url: string; body: Record<string, unknown> }[] = []
// Что ответит сервер: объект — ответ 200, 'down' — сервер недоступен.
let reply: Record<string, unknown> | 'down' = { ok: true }
let promo: typeof import('@/app/api/push/promo-consent/route')
let cartConsent: typeof import('@/app/api/push/consent/route')

beforeAll(async () => {
  vi.stubEnv('SHOP_API_URL', SERVER)
  vi.stubEnv('SHOP_API_SECRET', randomBytes(16).toString('hex'))
  vi.stubEnv('SHOP_PAYMENT_MODE', '')
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init?.body ?? '{}')) })
    if (reply === 'down') throw new Error('connect ECONNREFUSED')
    return Response.json(reply)
  })
  // Адрес сервера читается при загрузке модуля — грузим после настройки.
  vi.resetModules()
  promo = await import('@/app/api/push/promo-consent/route')
  cartConsent = await import('@/app/api/push/consent/route')
})

afterAll(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  sent.length = 0
  reply = { ok: true }
  session.current = { phone: PHONE, name: 'Азиз', exp: Date.now() + 1e9 }
})

const request = (url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method: body === undefined ? 'GET' : 'POST',
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as never

const URL_PROMO = '/api/push/promo-consent'

describe('/api/push/promo-consent', () => {
  it('чтение: ещё не спрашивали — consent: null, на сервер только номер из сессии', async () => {
    reply = { ok: true, consent: null }
    const res = await promo.GET(request(URL_PROMO))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, consent: null })
    expect(sent).toEqual([{ url: `${SERVER}/api/v1/webhook/site/promo-consent`, body: { phone: PHONE } }])
  })

  it('чтение: покупатель уже согласился — consent: true', async () => {
    reply = { ok: true, consent: true }
    const res = await promo.GET(request(URL_PROMO))
    expect(await res.json()).toEqual({ ok: true, consent: true })
  })

  it('чтение: сервер прислал не да/нет — считаем, что ещё не спрашивали', async () => {
    reply = { ok: true, consent: 'yes' }
    const res = await promo.GET(request(URL_PROMO))
    expect(await res.json()).toEqual({ ok: true, consent: null })
  })

  it('ответ «Да, сообщать» уходит на сервер с номером из сессии', async () => {
    const res = await promo.POST(request(URL_PROMO, { consent: true }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, consent: true })
    expect(sent).toEqual([
      { url: `${SERVER}/api/v1/webhook/site/promo-consent`, body: { phone: PHONE, consent: true } },
    ])
  })

  it('ответ «Нет» — тоже сохраняется', async () => {
    await promo.POST(request(URL_PROMO, { consent: false }))
    expect(sent.map((s) => s.body)).toEqual([{ phone: PHONE, consent: false }])
  })

  it('номер в теле не принимается — только из сессии', async () => {
    await promo.POST(request(URL_PROMO, { phone: '+996555000999', consent: true }))
    expect(sent.map((s) => s.body)).toEqual([{ phone: PHONE, consent: true }])
  })

  it.each([['строка', { consent: 'yes' }], ['число', { consent: 1 }], ['нет поля', {}], ['null', { consent: null }]])(
    'согласие не да/нет (%s) — 400',
    async (_, body) => {
      const res = await promo.POST(request(URL_PROMO, body))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ ok: false, error: 'consent' })
      expect(sent).toHaveLength(0)
    },
  )

  it('битый JSON — 400', async () => {
    const res = await promo.POST(request(URL_PROMO, '{не json'))
    expect(res.status).toBe(400)
    expect(sent).toHaveLength(0)
  })

  it('без входа — 401 и на чтение, и на запись', async () => {
    session.current = null
    expect((await promo.GET(request(URL_PROMO))).status).toBe(401)
    expect((await promo.POST(request(URL_PROMO, { consent: true }))).status).toBe(401)
    expect(sent).toHaveLength(0)
  })

  it('сервер недоступен — 502: «Кабинет» покажет, что не сохранилось', async () => {
    reply = 'down'
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const res = await promo.POST(request(URL_PROMO, { consent: true }))
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ ok: false, error: 'server-unavailable' })
  })

  it('сервер ответил 200, но {ok:false} на запись — 502, а не «Выключены»', async () => {
    reply = { ok: false, error: 'db' }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const res = await promo.POST(request(URL_PROMO, { consent: false }))
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ ok: false, error: 'server-unavailable' })
  })

  it('сервер ответил 200, но {ok:false} на чтение — 502, а не «ещё не спрашивали»', async () => {
    reply = { ok: false, error: 'phone' }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const res = await promo.GET(request(URL_PROMO))
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ ok: false, error: 'server-unavailable' })
  })

  it('тестовый режим: согласие помнит сам сайт, отдельно от корзины, в сеть ничего не уходит', async () => {
    vi.stubEnv('SHOP_PAYMENT_MODE', 'mock')
    session.current = { phone: '+996700999777', name: 'Тест', exp: Date.now() + 1e9 }
    try {
      expect(await (await promo.GET(request(URL_PROMO))).json()).toEqual({ ok: true, consent: null })
      // «Да» напоминаниям о корзине не включает «Новинки и скидки».
      await cartConsent.POST(request('/api/push/consent', { consent: true }))
      expect(await (await promo.GET(request(URL_PROMO))).json()).toEqual({ ok: true, consent: null })
      await promo.POST(request(URL_PROMO, { consent: false }))
      expect(await (await promo.GET(request(URL_PROMO))).json()).toEqual({ ok: true, consent: false })
      expect(await (await cartConsent.GET(request('/api/push/consent'))).json()).toEqual({ ok: true, consent: true })
      expect(sent).toHaveLength(0)
    } finally {
      vi.stubEnv('SHOP_PAYMENT_MODE', '')
    }
  })
})
