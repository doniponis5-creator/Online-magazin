import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { turnstileSiteKey, verifyTurnstile } from '@/lib/security/turnstile'

/**
 * «Я не робот» (Cloudflare Turnstile): что сайт спрашивает у Cloudflare и как понимает ответ.
 * Cloudflare подменён записью запросов; ключи — выдуманные, в духе тестовых ключей Cloudflare.
 */
const SITE_KEY = '1x00000000000000000000AA'
const SECRET = '1x0000000000000000000000000000000AA'
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const TOKEN = 'XXXX.DUMMY.TOKEN.XXXX'

const sent: { url: string; method?: string; type: string | null; form: URLSearchParams }[] = []
// Что ответит Cloudflare: объект — JSON 200, число — пустой ответ с этим кодом,
// 'down' — сеть, 'html' — страница вместо JSON.
let reply: Record<string, unknown> | number | 'down' | 'html' = { success: true }

const recordingFetch = async (url: string, init?: RequestInit) => {
  sent.push({
    url,
    method: init?.method,
    type: new Headers(init?.headers).get('content-type'),
    form: new URLSearchParams(String(init?.body ?? '')),
  })
  if (reply === 'down') throw new TypeError('fetch failed')
  if (reply === 'html') return new Response('<html>Bad gateway</html>', { status: 200 })
  if (typeof reply === 'number') return new Response('', { status: reply })
  return Response.json(reply)
}
vi.stubGlobal('fetch', recordingFetch)

afterAll(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  sent.length = 0
  reply = { success: true }
  vi.stubEnv('TURNSTILE_SITE_KEY', SITE_KEY)
  vi.stubEnv('TURNSTILE_SECRET_KEY', SECRET)
  vi.restoreAllMocks()
})

describe('turnstileSiteKey — выключатель', () => {
  it('оба ключа заданы — отдаём открытый ключ', () => {
    expect(turnstileSiteKey()).toBe(SITE_KEY)
  })

  it.each([
    ['нет ни одного', '', ''],
    ['только открытый', SITE_KEY, ''],
    ['только секрет', '', SECRET],
    ['пробелы вместо ключей', '  ', '  '],
  ])('%s — проверка выключена', (_, site, secret) => {
    vi.stubEnv('TURNSTILE_SITE_KEY', site)
    vi.stubEnv('TURNSTILE_SECRET_KEY', secret)
    expect(turnstileSiteKey()).toBeNull()
  })

  it('ключи читаются при каждом вызове — пересборка не нужна', () => {
    vi.stubEnv('TURNSTILE_SITE_KEY', '')
    expect(turnstileSiteKey()).toBeNull()
    vi.stubEnv('TURNSTILE_SITE_KEY', SITE_KEY)
    expect(turnstileSiteKey()).toBe(SITE_KEY)
  })
})

describe('verifyTurnstile', () => {
  it('без ключей — off, в Cloudflare ничего не уходит', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    expect(await verifyTurnstile(TOKEN, '203.0.113.7')).toBe('off')
    expect(await verifyTurnstile(undefined)).toBe('off')
    expect(sent).toHaveLength(0)
  })

  it.each([
    ['нет токена', undefined],
    ['пустая строка', ''],
    ['не строка', 12345],
    ['объект', { token: TOKEN }],
    ['длиннее 2048', 'a'.repeat(2049)],
  ])('%s — fail, в Cloudflare ничего не уходит', async (_, token) => {
    expect(await verifyTurnstile(token, '203.0.113.7')).toBe('fail')
    expect(sent).toHaveLength(0)
  })

  it('токен ровно 2048 знаков ещё принимается', async () => {
    expect(await verifyTurnstile('a'.repeat(2048))).toBe('ok')
    expect(sent).toHaveLength(1)
  })

  it('success: true — ok; в запросе секрет, токен и IP покупателя формой', async () => {
    expect(await verifyTurnstile(TOKEN, '203.0.113.7')).toBe('ok')
    expect(sent).toHaveLength(1)
    const [request] = sent
    expect(request.url).toBe(VERIFY_URL)
    expect(request.method).toBe('POST')
    expect(request.type).toBe('application/x-www-form-urlencoded')
    expect(Object.fromEntries(request.form)).toEqual({ secret: SECRET, response: TOKEN, remoteip: '203.0.113.7' })
  })

  it('IP неизвестен — remoteip не отправляем', async () => {
    await verifyTurnstile(TOKEN, '')
    expect(sent[0].form.has('remoteip')).toBe(false)
  })

  it('success: false — fail', async () => {
    reply = { success: false, 'error-codes': ['invalid-input-response'] }
    expect(await verifyTurnstile(TOKEN, '203.0.113.7')).toBe('fail')
  })

  it('токен уже потрачен — fail', async () => {
    reply = { success: false, 'error-codes': ['timeout-or-duplicate'] }
    expect(await verifyTurnstile(TOKEN)).toBe('fail')
  })

  it('секрет вписан с ошибкой — не запираем всех покупателей: ok и запись в журнал', async () => {
    reply = { success: false, 'error-codes': ['invalid-input-secret'] }
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await verifyTurnstile(TOKEN)).toBe('ok')
    expect(logged).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(logged.mock.calls)).not.toContain(SECRET)
  })

  it.each([
    ['сеть недоступна', 'down' as const],
    ['Cloudflare ответил 500', 500],
    ['Cloudflare ответил 503', 503],
    ['ответ не JSON', 'html' as const],
    ['JSON без success', { hello: 'world' }],
  ])('%s — пропускаем (ok), в журнал — без токена и секрета', async (_, answer) => {
    reply = answer
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(await verifyTurnstile(TOKEN, '203.0.113.7')).toBe('ok')
    expect(warned).toHaveBeenCalledTimes(1)
    const text = JSON.stringify(warned.mock.calls)
    expect(text).not.toContain(TOKEN)
    expect(text).not.toContain(SECRET)
  })

  it('Cloudflare молчит дольше 5 секунд — обрываем и пропускаем (ok)', async () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const clock = new AbortController()
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(clock.signal)
    // Cloudflare не отвечает: запрос висит, пока сигнал его не оборвёт
    vi.stubGlobal('fetch', (_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      }),
    )
    try {
      const result = verifyTurnstile(TOKEN)
      expect(timeout).toHaveBeenCalledWith(5000)
      clock.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
      expect(await result).toBe('ok')
      expect(warned).toHaveBeenCalledTimes(1)
    } finally {
      vi.stubGlobal('fetch', recordingFetch)
    }
  })
})
