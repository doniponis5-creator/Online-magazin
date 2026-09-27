import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

/**
 * Приложение отдаёт сайту «адрес» телефона для уведомлений, сайт — серверу SBonus.
 * Проверяем снаружи: что пришло в POST /api/push/device и что ушло на сервер.
 * Сервер подменён: вместо сети — запись запросов. Адрес сервера и секрет выдуманы.
 */
const session = vi.hoisted(() => ({ current: null as { phone: string; name: string; exp: number } | null }))
vi.mock('@/app/api/customer/route-helpers', () => ({
  currentSession: async () => session.current,
  clientIp: () => '',
}))

const SERVER = 'http://sbonus.test'
const sent: { url: string; body: Record<string, unknown> }[] = []
let route: typeof import('@/app/api/push/device/route')

beforeAll(async () => {
  vi.stubEnv('SHOP_API_URL', SERVER)
  vi.stubEnv('SHOP_API_SECRET', randomBytes(16).toString('hex'))
  vi.stubEnv('SHOP_PAYMENT_MODE', '')
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init?.body ?? '{}')) })
    return Response.json({ saved: true })
  })
  // Адрес сервера читается при загрузке модуля — грузим после настройки.
  vi.resetModules()
  route = await import('@/app/api/push/device/route')
})

afterAll(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  sent.length = 0
  session.current = null
})

const post = (body: unknown) =>
  route.POST(
    new Request('http://localhost/api/push/device', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }) as never,
  )

/** Адрес Android (FCM): вид «идентификатор:APA91b…», около 160 знаков. */
const ANDROID = 'dQw4w9WgXcQ-k3_Lz0pY7e:APA91b' + 'Hk2_x-9Qm'.repeat(15)
/** Адрес iPhone (Apple): 64 шестнадцатеричных знака. */
const IOS = '0f3a'.repeat(16)

describe('POST /api/push/device', () => {
  it('Android: адрес FCM принимается и уходит на сервер с платформой android', async () => {
    session.current = { phone: '+996700111222', name: 'Азиз', exp: Date.now() + 1e9 }
    const res = await post({ token: ANDROID, platform: 'android' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(sent).toHaveLength(1)
    expect(sent[0].url).toBe(`${SERVER}/api/v1/webhook/site/push-device`)
    expect(sent[0].body).toEqual({ token: ANDROID, platform: 'android', phone: '+996700111222' })
  })

  it('iPhone: шестнадцатеричный адрес принимается как раньше, с платформой ios', async () => {
    const res = await post({ token: IOS, platform: 'ios' })
    expect(res.status).toBe(200)
    expect(sent.map((s) => s.body)).toEqual([{ token: IOS, platform: 'ios', phone: null }])
  })

  it('старое приложение на iPhone не присылает платформу — считаем iPhone', async () => {
    const res = await post({ token: IOS })
    expect(res.status).toBe(200)
    expect(sent.map((s) => s.body.platform)).toEqual(['ios'])
  })

  it('чужая платформа — отказ «platform», на сервер ничего не уходит', async () => {
    for (const platform of ['windows', 'web', 'IOS', '', 42]) {
      const res = await post({ token: IOS, platform })
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ ok: false, error: 'platform' })
    }
    expect(sent).toHaveLength(0)
  })

  it('адрес не по правилам своей платформы — отказ «token»', async () => {
    const bad: [unknown, string][] = [
      [ANDROID, 'ios'], // адрес Android под видом iPhone
      [IOS.slice(0, 59), 'ios'], // короче 60
      ['a'.repeat(201), 'ios'], // длиннее 200
      ['a'.repeat(99), 'android'], // короче 100
      ['a'.repeat(1025), 'android'], // длиннее 1024
      [ANDROID.replace(':', '/'), 'android'], // чужой знак
      [`${ANDROID}<script>`, 'android'],
      [12345, 'android'],
      [undefined, 'ios'],
    ]
    for (const [token, platform] of bad) {
      const res = await post({ token, platform })
      expect(res.status, `${String(token).slice(0, 20)} / ${platform}`).toBe(400)
      expect(await res.json()).toEqual({ ok: false, error: 'token' })
    }
    // граница: ровно 1024 знака для Android — ещё можно
    expect((await post({ token: 'a'.repeat(1024), platform: 'android' })).status).toBe(200)
    expect(sent).toHaveLength(1)
  })

  it('мусор вместо JSON — отказ, а не падение', async () => {
    const res = await post('не json {')
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false, error: 'token' })
    expect(sent).toHaveLength(0)
  })
})
