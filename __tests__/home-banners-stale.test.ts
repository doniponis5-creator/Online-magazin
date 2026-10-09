import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))

// 09.10: сервер на секунды не ответил (502 при выкладке) — главная минуту показывала автоматические слайды
// вместо баннеров владельца. Теперь до 10 минут — последние полученные баннеры и анимация.
const IMAGE_PREFIX = 'https://api.smartcentr.store/api/v1/shop/photos/banner/'
const banner = { id: 1, title: 'Скидки', link: '', desktop: { url: IMAGE_PREFIX + '1-desktop.jpg', w: 2400, h: 1000 } }

async function live(reply: { status: number; body?: unknown }) {
  vi.resetModules()
  vi.stubEnv('SHOP_PAYMENT_MODE', '')
  vi.stubEnv('SHOP_API_URL', 'http://sbonus.test')
  vi.stubEnv('SHOP_API_SECRET', 'secret')
  delete (globalThis as { __scLastBanners?: unknown }).__scLastBanners
  delete (globalThis as { __scLastHero?: unknown }).__scLastHero
  vi.stubGlobal('fetch', vi.fn(async () => (reply.status === 200 ? Response.json(reply.body) : new Response('bad', { status: reply.status }))))
  return await import('@/lib/customer/gateway')
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('баннеры главной при сбое сервера', () => {
  it('502 после удачного ответа — те же баннеры; через 10 минут — пусто', async () => {
    vi.useFakeTimers()
    const reply: { status: number; body?: unknown } = { status: 200, body: { banners: [banner] } }
    const gateway = await live(reply)
    expect((await gateway.getHomeBanners()).map((b) => b.id)).toEqual([1])
    reply.status = 502
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await gateway.getHomeBanners()).map((b) => b.id)).toEqual([1])
    vi.advanceTimersByTime(10 * 60_000 + 1)
    expect(await gateway.getHomeBanners()).toEqual([])
  })

  it('владелец убрал все баннеры — пустой список запоминается, старые не возвращаются', async () => {
    const reply: { status: number; body?: unknown } = { status: 200, body: { banners: [banner] } }
    const gateway = await live(reply)
    await gateway.getHomeBanners()
    reply.body = { banners: [] }
    expect(await gateway.getHomeBanners()).toEqual([])
    reply.status = 502
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await gateway.getHomeBanners()).toEqual([])
  })

  it('404 (сервер без баннеров) — пусто, без шума в журнале', async () => {
    const gateway = await live({ status: 404 })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await gateway.getHomeBanners()).toEqual([])
    expect(err).not.toHaveBeenCalled()
  })

  it('анимация баннера: сбой — прежний выбор, а не запасной', async () => {
    const reply: { status: number; body?: unknown } = { status: 200, body: { heroVariant: 'kitchens' } }
    const gateway = await live(reply)
    expect(await gateway.getHeroVariant()).toBe('kitchens')
    reply.status = 502
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await gateway.getHeroVariant()).toBe('kitchens')
  })
})
