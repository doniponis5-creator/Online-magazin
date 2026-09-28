import { createHmac, randomBytes } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

/**
 * Покупатель отменяет неоплаченный заказ: тестовый режим, живой режим (сервер
 * SBonus подменён записью запросов) и маршрут сайта. Номера и токены выдуманы.
 */
const SERVER = 'http://sbonus.test'

const ORDER = {
  customer: { name: 'Тест', phone: '+996700111222' },
  delivery: { method: 'pickup' as const, city: '', address: '', price: 0 },
  comment: '',
  lines: [{ productId: 'p1', variantId: 'std', oneCId: '', code: '', name: 'Чайник', price: 1300, qty: 1, sum: 1300 }],
  goodsTotal: 1300,
  total: 1300,
  bonus: 0,
  lang: 'ru' as const,
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('тестовый режим', () => {
  it('отменяет неоплаченный, повторное нажатие — не ошибка, оплаченный не отменить', async () => {
    vi.stubEnv('SHOP_PAYMENT_MODE', 'mock')
    const gateway = await import('@/lib/orders/gateway')
    const first = await gateway.createOrder(ORDER)
    const cancelled = await gateway.cancelOrder(first.orderId, first.token)
    expect(cancelled).toMatchObject({ ok: true, order: { status: 'cancelled', payUrl: null } })
    expect(await gateway.cancelOrder(first.orderId, first.token)).toMatchObject({ ok: true })
    // чужой токен — как будто заказа нет
    expect(await gateway.cancelOrder(first.orderId, 'wrong')).toEqual({ ok: false, reason: 'failed' })

    const second = await gateway.createOrder(ORDER)
    gateway.mockPay(second.orderId, second.token)
    expect(await gateway.cancelOrder(second.orderId, second.token)).toEqual({ ok: false, reason: 'paid' })
  })
})

describe('живой режим', () => {
  const secret = randomBytes(16).toString('hex')
  const calls: { url: string; body: string; signature: string }[] = []

  async function live(status: number, reply: unknown) {
    calls.length = 0
    vi.stubEnv('SHOP_API_URL', SERVER)
    vi.stubEnv('SHOP_API_SECRET', secret)
    vi.stubEnv('SHOP_PAYMENT_MODE', '')
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push({ url, body: String(init?.body ?? ''), signature: new Headers(init?.headers).get('X-Signature') ?? '' })
      return new Response(JSON.stringify(reply), { status, headers: { 'Content-Type': 'application/json' } })
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    return import('@/lib/orders/gateway')
  }

  it('отправляет подписанный токен на /cancel и отдаёт отменённый заказ', async () => {
    const gateway = await live(200, { orderId: 'SC-1', status: 'cancelled', payUrl: null })
    const result = await gateway.cancelOrder('SC-1', 'order-token')
    expect(result).toMatchObject({ ok: true, order: { status: 'cancelled' } })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${SERVER}/api/v1/webhook/site/orders/SC-1/cancel`)
    expect(JSON.parse(calls[0].body)).toEqual({ token: 'order-token' })
    expect(calls[0].signature).toBe(createHmac('sha256', secret).update(calls[0].body, 'utf8').digest('hex'))
  })

  it('409 от сервера — заказ уже оплачен', async () => {
    const gateway = await live(409, { detail: 'заказ уже оплачен или в работе' })
    expect(await gateway.cancelOrder('SC-1', 'order-token')).toEqual({ ok: false, reason: 'paid' })
  })

  it('сервер не знает заказ или ещё не обновлён — «не получилось», а не падение', async () => {
    const gateway = await live(404, { detail: 'Not Found' })
    expect(await gateway.cancelOrder('SC-1', 'order-token')).toEqual({ ok: false, reason: 'failed' })
  })

  it('маршрут сайта: без токена — 400, оплаченный — 409', async () => {
    await live(409, { detail: 'заказ уже оплачен' })
    const route = await import('@/app/api/orders/[id]/cancel/route')
    const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as unknown as RouteContext<'/api/orders/[id]/cancel'>
    const post = (body: unknown) =>
      new Request('http://site.test/api/orders/SC-1/cancel', { method: 'POST', body: JSON.stringify(body) }) as never

    expect((await route.POST(post({}), ctx('SC-1'))).status).toBe(400)
    const paid = await route.POST(post({ token: 'order-token' }), ctx('SC-1'))
    expect(paid.status).toBe(409)
    expect(await paid.json()).toEqual({ ok: false, error: 'paid' })
  })
})
