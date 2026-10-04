import { createHmac } from 'node:crypto'
import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/instagram/post-image/route'
import { discountPct, fitBox, photoAllowed, postName } from '@/lib/instagram/postImage'

const SECRET = 'test-secret'

function call(body: unknown, secret = SECRET) {
  const text = JSON.stringify(body)
  const signature = createHmac('sha256', secret).update(text).digest('hex')
  return POST(new Request('http://site/api/instagram/post-image', { method: 'POST', body: text, headers: { 'x-signature': signature } }))
}

// @vercel/og сам грузит через fetch свои файлы (шрифты, wasm) — их пропускаем к настоящему fetch.
const realFetch = globalThis.fetch
function fakeFetch(photo?: Buffer) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.startsWith('https://')) return Promise.resolve(new Response(photo ? new Uint8Array(photo) : null, { status: photo ? 200 : 404 }))
    return realFetch(input, init)
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('картинка поста Instagram', () => {
  it('чужая подпись — 404, без цены или названия — 400', async () => {
    vi.stubEnv('SHOP_API_SECRET', SECRET)
    expect((await call({ kind: 'sale', name: 'A', price: 100 }, 'other')).status).toBe(404)
    expect((await call({ kind: 'sale', name: 'A', price: 0 })).status).toBe(400)
    expect((await call({ kind: 'sale', name: '', price: 100 })).status).toBe(400)
    expect((await call({ kind: 'ad', name: 'A', price: 100 })).status).toBe(400)
  })

  it('пост — JPEG 1080 × 1350, история — 1080 × 1920; кыргызская «ң» в шрифте есть', async () => {
    vi.stubEnv('SHOP_API_SECRET', SECRET)
    vi.stubGlobal('fetch', fakeFetch())
    for (const [format, height] of [['post', 1350], ['story', 1920]] as const) {
      const response = await call({ format, kind: 'sale', name: 'Жаңы Эндуро WN-A10', price: 15900, oldPrice: 18900 })
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/jpeg')
      const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata()
      expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 1080, height])
    }
  }, 30_000)

  it('фото с чужого адреса не скачиваем; фото не скачалось — 502, а не пост с заглушкой', async () => {
    vi.stubEnv('SHOP_API_SECRET', SECRET)
    const fetched = fakeFetch()
    vi.stubGlobal('fetch', fetched)
    expect((await call({ kind: 'sale', name: 'A', price: 100, oldPrice: 200, photo: 'https://evil.example/p.jpg' })).status).toBe(502)
    expect(fetched.mock.calls.some(([u]) => String(u).includes('evil'))).toBe(false)
    expect((await call({ kind: 'sale', name: 'A', price: 100, photo: 'https://api.smartcentr.store/api/v1/shop/photos/x.jpg' })).status).toBe(502)
  }, 30_000)

  it('фото с нашего сервера встаёт в картинку', async () => {
    vi.stubEnv('SHOP_API_SECRET', SECRET)
    const photo = await sharp({ create: { width: 600, height: 800, channels: 3, background: '#ffffff' } }).jpeg().toBuffer()
    vi.stubGlobal('fetch', fakeFetch(photo))
    const response = await call({ kind: 'new', name: 'Холодильник', price: 52900, photo: 'https://api.smartcentr.store/api/v1/shop/photos/x.jpg' })
    expect(response.headers.get('x-photo')).toBe('1')
  }, 30_000)
})

describe('правила картинки', () => {
  it('скидка — от старой цены вниз до целого, как в подписи поста (shop_ig_rules.discount_pct)', () => {
    expect(discountPct(15900, 18900)).toBe(15)
    expect(discountPct(14200, 20000)).toBe(29) // в дробях было бы 28 — а в подписи 29
    expect(discountPct(100, 100)).toBe(0)
    expect(discountPct(0, 100)).toBe(0)
  })
  it('название без звёздочек; длинное режется по слову', () => {
    expect(postName('**Утюг  Philips**')).toBe('Утюг Philips')
    const long = postName('Холодильник '.repeat(12))
    expect(long.length).toBeLessThanOrEqual(87)
    expect(long.endsWith('Холодильник…')).toBe(true)
  })
  it('фото вписывается без искажений; брать только с нашего сервера и сайта', () => {
    expect(fitBox(600, 800, 840, 516)).toEqual({ w: 387, h: 516 })
    expect(fitBox(0, 0, 840, 516)).toEqual({ w: 840, h: 516 })
    expect(photoAllowed('https://api.smartcentr.store/api/v1/shop/photos/a.jpg')).toBe(true)
    expect(photoAllowed('http://api.smartcentr.store/a.jpg')).toBe(false)
    expect(photoAllowed('https://smartcentr.store.evil.kg/a.jpg')).toBe(false)
  })
})
