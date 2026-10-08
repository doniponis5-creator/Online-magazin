import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))

// 08.10, перед рекламой: SBonus пускает с одного адреса 200 запросов за 10 с, а сайт ходит к нему за всех.
// Настройки сайта — один запрос в минуту на всех; посещения — пачкой раз в 5 с, а не запросом на каждый экран.
async function live() {
  vi.resetModules()
  vi.stubEnv('SHOP_PAYMENT_MODE', '')
  vi.stubEnv('SHOP_API_URL', 'http://sbonus.test')
  vi.stubEnv('SHOP_API_SECRET', 'secret')
  delete (globalThis as { __scSiteSettings?: unknown }).__scSiteSettings
  delete (globalThis as { __scVisits?: unknown }).__scVisits
  const calls: { url: string; body: string }[] = []
  const fetchMock = vi.fn(async (url: string, init: { body?: string }) => {
    calls.push({ url, body: init.body ?? '' })
    if (url.endsWith('/visits') && process.env.TEST_OLD_SERVER === '1') return new Response('nf', { status: 404 })
    if (url.endsWith('/settings')) return Response.json({ guestCheckout: true, bonusMaxPct: 10, bonusMaxOrder: 400, welcomeBonus: 1000 })
    return Response.json({ ok: true })
  })
  vi.stubGlobal('fetch', fetchMock)
  const gateway = await import('@/lib/customer/gateway')
  return { gateway, calls }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('нагрузка на SBonus', () => {
  it('настройки сайта: 300 одновременных экранов — один запрос, и минуту без новых', async () => {
    const { gateway, calls } = await live()
    const all = await Promise.all(Array.from({ length: 300 }, () => gateway.getSiteSettings()))
    expect(all.every((s) => s.bonusMaxOrder === 400)).toBe(true)
    expect(calls.filter((c) => c.url.endsWith('/settings'))).toHaveLength(1)
    await gateway.getSiteSettings()
    expect(calls.filter((c) => c.url.endsWith('/settings'))).toHaveLength(1)
  })

  it('посещения: 100 экранов разных людей — одна пачка через 5 с; повтор той же страницы не считается', async () => {
    vi.useFakeTimers()
    const { gateway, calls } = await live()
    for (let i = 0; i < 100; i++) await gateway.recordVisit(`v${i}`, '/ru')
    await gateway.recordVisit('v1', '/ru') // тот же человек, та же страница
    expect(calls).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(5_000)
    const batches = calls.filter((c) => c.url.endsWith('/visits'))
    expect(batches).toHaveLength(1)
    expect(JSON.parse(batches[0].body).items).toHaveLength(100)
  })

  it('старый сервер без пачек (404) — посещения по одному, не больше 20 за раз', async () => {
    vi.useFakeTimers()
    vi.stubEnv('TEST_OLD_SERVER', '1')
    const { gateway, calls } = await live()
    vi.stubEnv('TEST_OLD_SERVER', '1')
    for (let i = 0; i < 50; i++) await gateway.recordVisit(`w${i}`, '/ky')
    await vi.advanceTimersByTimeAsync(5_000)
    expect(calls.filter((c) => c.url.endsWith('/visit'))).toHaveLength(20)
  })
})

describe('фото через сайт (Cloudflare)', () => {
  it('фото SBonus в браузере — /p/…, остальное как было', async () => {
    const { photoSrc } = await import('@/lib/photoSrc')
    expect(photoSrc('https://api.smartcentr.store/api/v1/shop/photos/abc-1-ff.jpg')).toBe('/p/abc-1-ff.jpg')
    expect(photoSrc('https://api.smartcentr.store/api/v1/shop/photos/banner/b1.webp')).toBe('/p/banner/b1.webp')
    expect(photoSrc('/img/categories/care.webp')).toBe('/img/categories/care.webp')
    expect(photoSrc(undefined)).toBeUndefined()
  })
})
