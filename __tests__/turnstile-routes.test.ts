import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

/**
 * «Я не робот» на маршрутах, которые стоят денег: запрос кода, начало входа через WhatsApp
 * и заказ без входа. Проверяем снаружи: что пришло в маршрут, что спросили у Cloudflare
 * и дошло ли дело до сервера SBonus. Cloudflare и сервер подменены записью запросов;
 * адреса, ключи, секрет и номера выдуманы.
 */
const session = vi.hoisted(() => ({ current: null as { phone: string; name: string; exp: number } | null }))
vi.mock('@/app/api/customer/route-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/api/customer/route-helpers')>()),
  currentSession: async () => session.current,
}))
// Заказ проверяется по каталогу — берём демо-товар, чтобы не зависеть от выгрузки из 1С.
vi.mock('@/data/products', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/products')>()
  return { ...actual, getProduct: (id: string) => actual.demoProducts.find((p) => p.id === id) }
})

const SERVER = 'http://sbonus.test'
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const SITE_KEY = '1x00000000000000000000AA'
const SECRET = '1x0000000000000000000000000000000AA'
const TOKEN = 'XXXX.DUMMY.TOKEN.XXXX'
const IP = '203.0.113.7'
const PHONE = '+996700111222'

// Что сервер SBonus отвечает на каждый адрес
const SERVER_REPLIES: Record<string, unknown> = {
  '/api/v1/webhook/site/customer/send-code': { channel: 'telegram' },
  '/api/v1/webhook/site/customer/wa-login/start': { code: '482913', waPhone: '996557100505', ttl: 300 },
  '/api/v1/webhook/site/settings': { guestCheckout: true, bonusMaxPct: 10, bonusMaxOrder: 0, welcomeBonus: 1000 },
  '/api/v1/webhook/site/orders': { order_id: 'SC-1', token: 'order-token', pay_url: 'https://pay.test/SC-1' },
}

const server: { path: string; body: Record<string, unknown> }[] = []
const cloudflare: Record<string, string>[] = []
// Что ответит Cloudflare о токене
let human = true

let sendCode: typeof import('@/app/api/customer/send-code/route')
let waStart: typeof import('@/app/api/customer/wa-login/start/route')
let orders: typeof import('@/app/api/orders/route')
let siteSettings: typeof import('@/app/api/site-settings/route')

beforeAll(async () => {
  vi.stubEnv('SHOP_API_URL', SERVER)
  vi.stubEnv('SHOP_API_SECRET', randomBytes(16).toString('hex'))
  vi.stubEnv('SHOP_PAYMENT_MODE', '')
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url === VERIFY_URL) {
      cloudflare.push(Object.fromEntries(new URLSearchParams(String(init?.body ?? ''))))
      return Response.json(human ? { success: true } : { success: false, 'error-codes': ['invalid-input-response'] })
    }
    const path = url.slice(SERVER.length)
    server.push({ path, body: JSON.parse(String(init?.body ?? '{}')) })
    return Response.json(SERVER_REPLIES[path] ?? { ok: true })
  })
  // Адрес сервера читается при загрузке модуля — грузим после настройки.
  vi.resetModules()
  sendCode = await import('@/app/api/customer/send-code/route')
  waStart = await import('@/app/api/customer/wa-login/start/route')
  orders = await import('@/app/api/orders/route')
  siteSettings = await import('@/app/api/site-settings/route')
})

afterAll(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  server.length = 0
  cloudflare.length = 0
  human = true
  session.current = null
  // По умолчанию проверка выключена — как на сайте сейчас
  vi.stubEnv('TURNSTILE_SITE_KEY', '')
  vi.stubEnv('TURNSTILE_SECRET_KEY', '')
})

const captchaOn = () => {
  vi.stubEnv('TURNSTILE_SITE_KEY', SITE_KEY)
  vi.stubEnv('TURNSTILE_SECRET_KEY', SECRET)
}

const post = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, {
    method: 'POST',
    body: JSON.stringify(body),
    // nginx передаёт IP покупателя первым в X-Forwarded-For
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `${IP}, 10.0.0.1` },
  })

const paths = () => server.map((s) => s.path)

describe('POST /api/customer/send-code', () => {
  const send = (body: unknown) => sendCode.POST(post('/api/customer/send-code', body))

  it('проверка выключена — код уходит как раньше, Cloudflare не спрашиваем', async () => {
    const res = await send({ phone: '0700 123 456' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, phone: '+996700123456', channel: 'telegram' })
    expect(server).toEqual([{ path: '/api/v1/webhook/site/customer/send-code', body: { phone: '+996700123456', ip: IP } }])
    expect(cloudflare).toHaveLength(0)
  })

  it('проверка включена, токена нет — 403 captcha, код не отправляется', async () => {
    captchaOn()
    const res = await send({ phone: '0700 123 456' })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ ok: false, error: 'captcha' })
    expect(server).toHaveLength(0)
  })

  it('проверка включена, Cloudflare токен не принял — 403 captcha, код не отправляется', async () => {
    captchaOn()
    human = false
    const res = await send({ phone: '0700 123 456', turnstile: TOKEN })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ ok: false, error: 'captcha' })
    expect(cloudflare).toHaveLength(1)
    expect(server).toHaveLength(0)
  })

  it('проверка включена, токен настоящий — код уходит; Cloudflare получил токен и IP покупателя', async () => {
    captchaOn()
    const res = await send({ phone: '0700 123 456', turnstile: TOKEN })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, phone: '+996700123456', channel: 'telegram' })
    expect(cloudflare).toEqual([{ secret: SECRET, response: TOKEN, remoteip: IP }])
    expect(paths()).toEqual(['/api/v1/webhook/site/customer/send-code'])
  })

  it('неверный номер — 422 до всякой проверки: токен не тратим', async () => {
    captchaOn()
    const res = await send({ phone: '12345', turnstile: TOKEN })
    expect(res.status).toBe(422)
    expect(cloudflare).toHaveLength(0)
    expect(server).toHaveLength(0)
  })
})

describe('POST /api/customer/wa-login/start', () => {
  const start = (body: unknown) => waStart.POST(post('/api/customer/wa-login/start', body))

  it('проверка выключена — код для WhatsApp выдаётся как раньше', async () => {
    const res = await start({})
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, code: '482913', waPhone: '996557100505', ttl: 300 })
    expect(server).toEqual([{ path: '/api/v1/webhook/site/customer/wa-login/start', body: { ip: IP } }])
    expect(cloudflare).toHaveLength(0)
  })

  it('проверка включена, токена нет — 403 captcha, сервер не спрашиваем', async () => {
    captchaOn()
    const res = await start({})
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ ok: false, error: 'captcha' })
    expect(server).toHaveLength(0)
  })

  it('проверка включена, Cloudflare токен не принял — 403 captcha', async () => {
    captchaOn()
    human = false
    const res = await start({ turnstile: TOKEN })
    expect(res.status).toBe(403)
    expect(server).toHaveLength(0)
  })

  it('проверка включена, токен настоящий — код выдаётся', async () => {
    captchaOn()
    const res = await start({ turnstile: TOKEN })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, code: '482913' })
    expect(cloudflare).toEqual([{ secret: SECRET, response: TOKEN, remoteip: IP }])
    expect(paths()).toEqual(['/api/v1/webhook/site/customer/wa-login/start'])
  })
})

describe('POST /api/orders', () => {
  const ORDER = {
    customer: { name: 'Азизов Азиз', phone: '0700 123 456' },
    delivery: { method: 'pickup' },
    lines: [{ productId: 'smartview-55', variantId: 'std', qty: 1 }],
    lang: 'ru',
  }
  const order = (extra: Record<string, unknown> = {}) => orders.POST(post('/api/orders', { ...ORDER, ...extra }))
  const ORDERS_PATH = '/api/v1/webhook/site/orders'

  it('гость, проверка выключена — заказ создаётся как раньше', async () => {
    const res = await order()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, orderId: 'SC-1', payUrl: 'https://pay.test/SC-1' })
    expect(paths()).toContain(ORDERS_PATH)
    expect(cloudflare).toHaveLength(0)
  })

  it('гость, проверка включена, токена нет — 403 captcha, заказ не создаётся', async () => {
    captchaOn()
    const res = await order()
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ ok: false, errors: ['captcha'] })
    expect(paths()).not.toContain(ORDERS_PATH)
  })

  it('гость, проверка включена, Cloudflare токен не принял — 403 captcha, заказ не создаётся', async () => {
    captchaOn()
    human = false
    const res = await order({ turnstile: TOKEN })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ ok: false, errors: ['captcha'] })
    expect(cloudflare).toHaveLength(1)
    expect(paths()).not.toContain(ORDERS_PATH)
  })

  it('гость, проверка включена, токен настоящий — заказ создаётся, токен на сервер заказов не уходит', async () => {
    captchaOn()
    const res = await order({ turnstile: TOKEN })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, orderId: 'SC-1' })
    expect(cloudflare).toEqual([{ secret: SECRET, response: TOKEN, remoteip: IP }])
    const created = server.find((s) => s.path === ORDERS_PATH)
    expect(created?.body).not.toHaveProperty('turnstile')
    expect(JSON.stringify(created?.body)).not.toContain(TOKEN)
  })

  it('вошедший покупатель — проверку не спрашиваем даже при включённой: телефон уже подтверждён кодом', async () => {
    captchaOn()
    session.current = { phone: PHONE, name: 'Азиз', exp: Date.now() + 1e9 }
    const res = await order()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, orderId: 'SC-1' })
    expect(cloudflare).toHaveLength(0)
    expect(server.find((s) => s.path === ORDERS_PATH)?.body).toMatchObject({ customer: { phone: PHONE } })
  })
})

describe('GET /api/site-settings', () => {
  it('проверка выключена — turnstileSiteKey: null', async () => {
    const res = await siteSettings.GET()
    expect(await res.json()).toEqual({
      ok: true,
      welcomeBonus: 1000,
      bonusMaxPct: 10,
      bonusMaxOrder: 0,
      guestCheckout: true,
      turnstileSiteKey: null,
    })
  })

  it('проверка включена — отдаём открытый ключ, секрет — никогда', async () => {
    captchaOn()
    const res = await siteSettings.GET()
    const text = await res.text()
    expect(JSON.parse(text)).toMatchObject({ ok: true, turnstileSiteKey: SITE_KEY })
    expect(text).not.toContain(SECRET)
  })

  it('задан только открытый ключ — проверка выключена: null', async () => {
    vi.stubEnv('TURNSTILE_SITE_KEY', SITE_KEY)
    const res = await siteSettings.GET()
    expect(await res.json()).toMatchObject({ turnstileSiteKey: null })
  })
})
