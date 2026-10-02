import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

/**
 * Маршрут /api/channel/instagram: сюда стучится сервер SBonus с разговором из
 * Direct. Мозг (respond) подменён — проверяем только вход: подпись, id, канал.
 * Секрет и id выдуманы.
 */
const respond = vi.fn()
vi.mock('@/lib/assistant/respond', async (original) => ({
  ...(await original<typeof import('@/lib/assistant/respond')>()),
  respond: (...args: unknown[]) => respond(...args),
}))
vi.mock('@/lib/assistant/log', () => ({ logQuestion: vi.fn(async () => undefined) }))

const SECRET = 'test-secret'

function request(body: unknown, secret = SECRET) {
  const text = JSON.stringify(body)
  const signature = createHmac('sha256', secret).update(text, 'utf8').digest('hex')
  return new Request('http://site.test/api/channel/instagram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Signature': signature },
    body: text,
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
  respond.mockReset()
})

describe('/api/channel/instagram', () => {
  it('без верной подписи — 404, как будто адреса нет', async () => {
    vi.stubEnv('SHOP_API_SECRET', SECRET)
    const { POST } = await import('@/app/api/channel/instagram/route')
    const response = await POST(request({ id: '1234567890', messages: [{ role: 'user', text: 'Салам' }] }, 'wrong'))
    expect(response.status).toBe(404)
    expect(respond).not.toHaveBeenCalled()
  })

  it('id не из цифр или пустой разговор — 400', async () => {
    vi.stubEnv('SHOP_API_SECRET', SECRET)
    const { POST } = await import('@/app/api/channel/instagram/route')
    expect((await POST(request({ id: '+996555', messages: [{ role: 'user', text: 'Салам' }] }))).status).toBe(400)
    expect((await POST(request({ id: '1234567890', messages: [] }))).status).toBe(400)
    expect(respond).not.toHaveBeenCalled()
  })

  it('канал instagram, без телефона и без данных покупателя', async () => {
    vi.stubEnv('SHOP_API_SECRET', SECRET)
    respond.mockResolvedValue({ text: 'Есть, 32 900 сом.', products: [], source: 'gemini' })
    const { POST } = await import('@/app/api/channel/instagram/route')
    const response = await POST(request({ id: '1234567890', name: 'Айбек', messages: [{ role: 'user', text: 'Холодильник барбы?' }], shown: ['p1'] }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, text: 'Есть, 32 900 сом.', source: 'gemini', silent: false, handoff: false })
    const [channel, turns, , customer, buy, shown] = respond.mock.calls[0]
    expect(channel).toEqual({ key: 'ig:1234567890', orderSource: 'Заказ из Instagram', leadChannel: 'instagram', known: { name: 'Айбек' } })
    expect(turns).toEqual([{ role: 'user', text: 'Холодильник барбы?' }])
    expect(customer).toBeNull()
    expect(buy).toBeUndefined()
    expect(shown).toEqual(['p1'])
  })
})
