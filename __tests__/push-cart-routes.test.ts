import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

/**
 * Напоминание о корзине: приложение отдаёт сайту снимок корзины и согласие покупателя,
 * сайт — серверу SBonus. Проверяем снаружи: что пришло в маршруты сайта и что ушло на сервер.
 * Сервер подменён записью запросов; адрес сервера, секрет и номера выдуманы.
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
let cart: typeof import('@/app/api/push/cart/route')
let consent: typeof import('@/app/api/push/consent/route')

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
  cart = await import('@/app/api/push/cart/route')
  consent = await import('@/app/api/push/consent/route')
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

const postCart = (body: unknown) => cart.POST(request('/api/push/cart', body))

describe('POST /api/push/cart', () => {
  it('снимок корзины уходит на сервер с номером из сессии', async () => {
    const res = await postCart({ items: ['Смартфон Aura X5', 'Чехол'], count: 2, total: 26980 })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(sent).toEqual([
      {
        url: `${SERVER}/api/v1/webhook/site/push-cart`,
        body: { phone: PHONE, items: ['Смартфон Aura X5', 'Чехол'], count: 2, total: 26980 },
      },
    ])
  })

  it('пустая корзина — тоже снимок: сервер должен узнать, что напоминать не о чем', async () => {
    const res = await postCart({ items: [], count: 0, total: 0 })
    expect(res.status).toBe(200)
    expect(sent.map((s) => s.body)).toEqual([{ phone: PHONE, items: [], count: 0, total: 0 }])
  })

  it('без входа — 401, на сервер ничего не уходит', async () => {
    session.current = null
    const res = await postCart({ items: ['Чехол'], count: 1, total: 990 })
    expect(res.status).toBe(401)
    expect(sent).toHaveLength(0)
  })

  it('номер в теле не принимается — только из сессии', async () => {
    await postCart({ phone: '+996555000999', items: ['Чехол'], count: 1, total: 990 })
    expect(sent.map((s) => s.body.phone)).toEqual([PHONE])
  })

  it.each([
    ['больше трёх названий', { items: ['a', 'b', 'c', 'd'], count: 4, total: 4 }, 'items'],
    ['название не строка', { items: [42], count: 1, total: 1 }, 'items'],
    ['пустое название', { items: ['  '], count: 1, total: 1 }, 'items'],
    ['нет списка', { count: 1, total: 1 }, 'items'],
    ['дробное число позиций', { items: [], count: 1.5, total: 1 }, 'count'],
    ['отрицательное число позиций', { items: [], count: -1, total: 0 }, 'count'],
    ['сумма строкой', { items: [], count: 0, total: '0' }, 'total'],
    ['отрицательная сумма', { items: [], count: 0, total: -5 }, 'total'],
  ])('%s — 400, на сервер ничего не уходит', async (_, body, error) => {
    const res = await postCart(body)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false, error })
    expect(sent).toHaveLength(0)
  })

  it('битый JSON — 400', async () => {
    const res = await postCart('{не json')
    expect(res.status).toBe(400)
    expect(sent).toHaveLength(0)
  })

  it('сервер недоступен — приложение не ломаем: 200 и saved:false', async () => {
    reply = 'down'
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const res = await postCart({ items: [], count: 0, total: 0 })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, saved: false })
  })
})

describe('/api/push/consent', () => {
  it('чтение: сервер ещё не спрашивал — consent: null', async () => {
    reply = { consent: null }
    const res = await consent.GET(request('/api/push/consent'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, consent: null })
    expect(sent).toEqual([{ url: `${SERVER}/api/v1/webhook/site/cart-consent`, body: { phone: PHONE } }])
  })

  it('чтение: покупатель уже согласился — consent: true', async () => {
    reply = { consent: true }
    const res = await consent.GET(request('/api/push/consent'))
    expect(await res.json()).toEqual({ ok: true, consent: true })
  })

  it('ответ «Да, напоминать» уходит на сервер с номером из сессии', async () => {
    const res = await consent.POST(request('/api/push/consent', { consent: true }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, consent: true })
    expect(sent).toEqual([
      { url: `${SERVER}/api/v1/webhook/site/cart-consent`, body: { phone: PHONE, consent: true } },
    ])
  })

  it('ответ «Нет» — тоже сохраняется', async () => {
    await consent.POST(request('/api/push/consent', { consent: false }))
    expect(sent.map((s) => s.body)).toEqual([{ phone: PHONE, consent: false }])
  })

  it.each([['строка', { consent: 'yes' }], ['нет поля', {}], ['null', { consent: null }]])(
    'согласие не да/нет (%s) — 400',
    async (_, body) => {
      const res = await consent.POST(request('/api/push/consent', body))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ ok: false, error: 'consent' })
      expect(sent).toHaveLength(0)
    },
  )

  it('без входа — 401 и на чтение, и на запись', async () => {
    session.current = null
    expect((await consent.GET(request('/api/push/consent'))).status).toBe(401)
    expect((await consent.POST(request('/api/push/consent', { consent: true }))).status).toBe(401)
    expect(sent).toHaveLength(0)
  })

  it('сервер недоступен — 502: «Кабинет» покажет, что не сохранилось', async () => {
    reply = 'down'
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const res = await consent.POST(request('/api/push/consent', { consent: true }))
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ ok: false, error: 'server-unavailable' })
  })

  it('сервер ответил 200, но {ok:false} на запись — это не сохранилось: 502, а не «Выключены»', async () => {
    reply = { ok: false, error: 'db' }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const res = await consent.POST(request('/api/push/consent', { consent: false }))
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ ok: false, error: 'server-unavailable' })
  })

  it('сервер ответил 200, но {ok:false} на чтение — 502, а не «ещё не спрашивали»', async () => {
    reply = { ok: false, error: 'phone' }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const res = await consent.GET(request('/api/push/consent'))
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ ok: false, error: 'server-unavailable' })
  })

  it('снимок корзины: сервер ответил {ok:false} — приложение не ломаем, но saved:false', async () => {
    reply = { ok: false, error: 'db' }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const res = await postCart({ items: [], count: 0, total: 0 })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, saved: false })
  })

  it('тестовый режим: сервера нет — согласие помнит сам сайт, в сеть ничего не уходит', async () => {
    vi.stubEnv('SHOP_PAYMENT_MODE', 'mock')
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    session.current = { phone: '+996700999888', name: 'Тест', exp: Date.now() + 1e9 }
    try {
      expect(await (await consent.GET(request('/api/push/consent'))).json()).toEqual({ ok: true, consent: null })
      await consent.POST(request('/api/push/consent', { consent: true }))
      expect(await (await consent.GET(request('/api/push/consent'))).json()).toEqual({ ok: true, consent: true })
      expect((await postCart({ items: ['Чехол'], count: 1, total: 990 })).status).toBe(200)
      expect(sent).toHaveLength(0)
    } finally {
      vi.stubEnv('SHOP_PAYMENT_MODE', '')
    }
  })
})
