import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

/** Подмена сессии покупателя: кто «вошёл» — решает тест. */
const session = vi.hoisted(() => ({ current: null as { phone: string; name: string; exp: number } | null }))
vi.mock('@/app/api/customer/route-helpers', () => ({
  currentSession: async () => session.current,
  clientIp: (request: Request) => request.headers.get('x-forwarded-for') ?? '',
}))

import * as list from '@/app/api/gallery/route'
import * as one from '@/app/api/gallery/[id]/route'
import * as rate from '@/app/api/gallery/[id]/rate/route'
import * as comments from '@/app/api/gallery/[id]/comments/route'
import * as report from '@/app/api/gallery/[id]/report/route'
import * as photos from '@/app/api/gallery/[id]/photos/route'
import * as image from '@/app/api/gallery/image/[name]/route'
import * as panel from '@/app/panel/gallery/route'

/** JPEG с настоящим заголовком: APP0, SOF0 (ширина×высота), SOS; EXIF по желанию. */
function jpeg(w: number, h: number, exif = false): Uint8Array {
  const bytes = [0xff, 0xd8]
  if (exif) {
    const payload = [...new TextEncoder().encode('Exif\0\0GPS 42.87 74.59')]
    bytes.push(0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 255, ...payload)
  }
  bytes.push(0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0)
  bytes.push(0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1)
  bytes.push(0xff, 0xda, 0, 12, 3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0, 0x12, 0x34, 0xff, 0xd9)
  return new Uint8Array(bytes)
}
const JPEG = jpeg(1200, 750)
const SVG = new TextEncoder().encode('<svg onload="alert(1)"></svg>')

let seq = 0
const phone = () => `+996888${String(++seq).padStart(6, '0')}`
const login = (p: string, name = 'Азамат Абдыкадыров') => {
  session.current = { phone: p, name, exp: Date.now() + 1e9 }
}
const logout = () => {
  session.current = null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) }) as any
const url = (path: string) => `http://localhost${path}`
const file = (bytes: Uint8Array, name = 'a.jpg') => new File([bytes as BlobPart], name, { type: 'image/jpeg' })

function publishForm(over: { image?: Uint8Array; thumb?: Uint8Array; q?: string; role?: string; title?: string; ip?: string } = {}) {
  const form = new FormData()
  form.set('q', over.q ?? 'f=corner&a=300&b=240&s=neoclassic')
  if (over.title) form.set('title', over.title)
  form.set('role', over.role ?? 'master')
  form.set('image', file(over.image ?? JPEG))
  form.set('thumb', file(over.thumb ?? JPEG))
  return new Request(url('/api/gallery'), { method: 'POST', body: form, headers: over.ip ? { 'x-real-ip': over.ip } : {} })
}

const json = (path: string, body: unknown) =>
  new Request(url(path), { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

async function publishAs(p: string): Promise<string> {
  login(p)
  const res = await list.POST(publishForm())
  expect(res.status).toBe(200)
  return ((await res.json()) as { id: string }).id
}

describe('API галереи', () => {
  let dir = ''

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gallery-api-'))
    process.env.GALLERY_DIR = dir
  })

  afterEach(() => {
    logout()
    delete process.env.GALLERY_DIR
    delete process.env.ASSISTANT_LOG_KEY
    rmSync(dir, { recursive: true, force: true })
  })

  it('поставить в галерею можно только вошедшему', async () => {
    const res = await list.POST(publishForm())
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ ok: false, error: 'login' })
  })

  it('публикация → в списке и на странице, без телефонов', async () => {
    const author = phone()
    const id = await publishAs(author)
    logout()
    const all = await list.GET(new Request(url('/api/gallery?sort=new')) as never)
    const body = (await all.json()) as { ok: boolean; items: { id: string; role: string }[]; total: number }
    expect(body).toMatchObject({ ok: true, total: 1, items: [{ id, role: 'master' }] })

    const page = await one.GET(new Request(url(`/api/gallery/${id}`)), ctx({ id }))
    const text = await page.text()
    expect(JSON.parse(text)).toMatchObject({ ok: true, kitchen: { id, authorName: 'Азамат' }, viewer: null })
    expect(text).not.toContain('+996')
    expect(text).not.toContain(author.slice(4))
    expect(text).not.toMatch(/phone/)

    login(author)
    const mine = await one.GET(new Request(url(`/api/gallery/${id}`)), ctx({ id }))
    expect(await mine.json()).toMatchObject({ viewer: { mine: true, stars: null } })
    const own = await list.GET(new Request(url('/api/gallery?mine=1')) as never)
    expect(await own.json()).toMatchObject({ total: 1 })
  })

  it('картинка: тип по байтам, пределы размера', async () => {
    login(phone())
    expect((await list.POST(publishForm({ image: SVG }))).status).toBe(400)
    expect((await list.POST(publishForm({ image: new Uint8Array(400_001).fill(0xff) }))).status).toBe(400)
    expect((await list.POST(publishForm({ image: jpeg(4001, 750) }))).status).toBe(400)
    expect((await list.POST(publishForm({ thumb: jpeg(480, 4001) }))).status).toBe(400)
    expect((await list.POST(publishForm({ image: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]) }))).status).toBe(400)
    const big = new Uint8Array(80_001)
    big.set(JPEG)
    const res = await list.POST(publishForm({ thumb: big }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false, error: 'bad-input' })
    expect((await list.POST(publishForm({ q: 'мусор' }))).status).toBe(400)
    expect((await list.POST(publishForm({ role: 'admin' }))).status).toBe(400)
  })

  it('не больше 5 публикаций в сутки', async () => {
    const p = phone()
    for (let i = 0; i < 5; i += 1) await publishAs(p)
    const res = await list.POST(publishForm())
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ ok: false, error: 'too-many', reason: 'often' })
  })

  it('оценка: вошедший, не автор, 1–5', async () => {
    const author = phone()
    const id = await publishAs(author)
    logout()
    expect((await rate.POST(json(`/api/gallery/${id}/rate`, { stars: 5 }), ctx({ id }))).status).toBe(401)
    login(author)
    expect((await rate.POST(json(`/api/gallery/${id}/rate`, { stars: 5 }), ctx({ id }))).status).toBe(403)
    login(phone())
    expect((await rate.POST(json(`/api/gallery/${id}/rate`, { stars: 9 }), ctx({ id }))).status).toBe(400)
    const ok = await rate.POST(json(`/api/gallery/${id}/rate`, { stars: 4 }), ctx({ id }))
    expect(await ok.json()).toEqual({ ok: true, avg: 4, count: 1 })
    expect((await rate.POST(json('/api/gallery/0000000000000000/rate', { stars: 4 }), ctx({ id: '0000000000000000' }))).status).toBe(404)
  })

  it('комментарий: 2–500 знаков, не чаще раза в 30 секунд', async () => {
    const id = await publishAs(phone())
    login(phone(), 'Болот Исаков')
    expect((await comments.POST(json(`/api/gallery/${id}/comments`, { text: 'x' }), ctx({ id }))).status).toBe(400)
    const ok = await comments.POST(json(`/api/gallery/${id}/comments`, { text: 'Красиво! Звоните 0700 111 222' }), ctx({ id }))
    expect(await ok.json()).toMatchObject({ ok: true, comment: { authorName: 'Болот', text: 'Красиво! Звоните …' } })
    const again = await comments.POST(json(`/api/gallery/${id}/comments`, { text: 'Ещё раз' }), ctx({ id }))
    expect(again.status).toBe(429)
    expect(await again.json()).toEqual({ ok: false, error: 'too-many', reason: 'often' })
  })

  it('чужую кухню не убрать, свою — можно; убранная и скрытая дают 404 и картинке', async () => {
    const author = phone()
    const id = await publishAs(author)
    const kitchen = ((await (await one.GET(new Request(url(`/api/gallery/${id}`)), ctx({ id }))).json()) as {
      kitchen: { image: string }
    }).kitchen
    const pic = await image.GET(new Request(url(`/api/gallery/image/${kitchen.image}`)), ctx({ name: kitchen.image }))
    expect(pic.status).toBe(200)
    expect(pic.headers.get('x-content-type-options')).toBe('nosniff')
    expect(pic.headers.get('content-type')).toBe('image/jpeg')
    expect((await image.GET(new Request(url('/api/gallery/image/..%2Fkitchens.json')), ctx({ name: '../kitchens.json' }))).status).toBe(404)

    login(phone())
    expect((await one.DELETE(new Request(url(`/api/gallery/${id}`), { method: 'DELETE' }), ctx({ id }))).status).toBe(403)
    login(author)
    expect((await one.DELETE(new Request(url(`/api/gallery/${id}`), { method: 'DELETE' }), ctx({ id }))).status).toBe(200)
    expect((await one.GET(new Request(url(`/api/gallery/${id}`)), ctx({ id }))).status).toBe(404)
    expect((await image.GET(new Request(url(`/api/gallery/image/${kitchen.image}`)), ctx({ name: kitchen.image }))).status).toBe(404)
  })

  it('жалоба — вошедшему, одна от человека', async () => {
    const id = await publishAs(phone())
    logout()
    expect((await report.POST(json(`/api/gallery/${id}/report`, {}), ctx({ id }))).status).toBe(401)
    login(phone())
    expect(await (await report.POST(json(`/api/gallery/${id}/report`, {}), ctx({ id }))).json()).toEqual({ ok: true })
    expect(await (await report.POST(json(`/api/gallery/${id}/report`, {}), ctx({ id }))).json()).toEqual({ ok: true, already: true })
    expect((await report.POST(json(`/api/gallery/${id}/report`, { commentId: 'nope' }), ctx({ id }))).status).toBe(400)
  })

  it('фото «я сделал такую» — только автор', async () => {
    const author = phone()
    const id = await publishAs(author)
    const form = () => {
      const f = new FormData()
      f.append('photos', file(JPEG))
      f.append('thumbs', file(JPEG))
      return new Request(url(`/api/gallery/${id}/photos`), { method: 'POST', body: f })
    }
    login(phone())
    expect((await photos.POST(form(), ctx({ id }))).status).toBe(403)
    login(author)
    const ok = await photos.POST(form(), ctx({ id }))
    const body = (await ok.json()) as { ok: boolean; realPhotos: string[] }
    expect(body.ok).toBe(true)
    expect(body.realPhotos).toHaveLength(1)
    const bad = new FormData()
    bad.append('photos', file(SVG))
    expect((await photos.POST(new Request(url(`/api/gallery/${id}/photos`), { method: 'POST', body: bad }), ctx({ id }))).status).toBe(400)
  })

  it('фильтр «только с фото вживую»', async () => {
    const author = phone()
    const id = await publishAs(author)
    await publishAs(phone())
    const f = new FormData()
    f.append('photos', file(JPEG))
    login(author)
    await photos.POST(new Request(url(`/api/gallery/${id}/photos`), { method: 'POST', body: f }), ctx({ id }))
    const res = await list.GET(new Request(url('/api/gallery?real=1')) as never)
    expect(await res.json()).toMatchObject({ total: 1, items: [{ id, hasReal: true }] })
  })

  it('панель: без ключа 404, с ключом — кухни и «Скрыть»', async () => {
    const id = await publishAs(phone())
    process.env.ASSISTANT_LOG_KEY = 'test-panel-key'
    expect((await panel.GET(new Request(url('/panel/gallery')))).status).toBe(404)
    expect((await panel.GET(new Request(url('/panel/gallery?key=wrong')))).status).toBe(404)
    const page = await panel.GET(new Request(url('/panel/gallery?key=test-panel-key')))
    const html = await page.text()
    expect(page.status).toBe(200)
    expect(html).toContain('noindex')
    expect(html).toContain('Угловая 300 × 240')
    expect(html).not.toContain('+996')

    const form = new FormData()
    form.set('key', 'test-panel-key')
    form.set('kitchen', id)
    const hide = await panel.POST(new Request(url('/panel/gallery'), { method: 'POST', body: form }))
    expect(hide.status).toBe(303)
    expect((await one.GET(new Request(url(`/api/gallery/${id}`)), ctx({ id }))).status).toBe(404)
  })

  it('«мои» без входа — 401', async () => {
    const res = await list.GET(new Request(url('/api/gallery?mine=1')) as never)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ ok: false, error: 'login' })
  })

  it('больше 5 фото вживую — 429', async () => {
    const author = phone()
    const id = await publishAs(author)
    const f = new FormData()
    for (let i = 0; i < 6; i += 1) f.append('photos', file(JPEG))
    const res = await photos.POST(new Request(url(`/api/gallery/${id}/photos`), { method: 'POST', body: f }), ctx({ id }))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ ok: false, error: 'too-many', reason: 'photos' })
  })

  it('кончилось место под картинки — no-space, 507', async () => {
    const author = phone()
    const id = await publishAs(author)
    process.env.GALLERY_IMAGE_BUDGET = '10'
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const f = new FormData()
      f.append('photos', file(JPEG))
      const res = await photos.POST(new Request(url(`/api/gallery/${id}/photos`), { method: 'POST', body: f }), ctx({ id }))
      expect(res.status).toBe(507)
      expect(await res.json()).toEqual({ ok: false, error: 'no-space' })
    } finally {
      log.mockRestore()
      delete process.env.GALLERY_IMAGE_BUDGET
    }
  })

  it('EXIF с координатами срезается до записи на диск', async () => {
    login(phone())
    const res = await list.POST(publishForm({ image: jpeg(1200, 750, true), thumb: jpeg(480, 300, true) }))
    const { id } = (await res.json()) as { id: string }
    const k = ((await (await one.GET(new Request(url(`/api/gallery/${id}`)), ctx({ id }))).json()) as { kitchen: { image: string; thumb: string } }).kitchen
    for (const name of [k.image, k.thumb]) {
      const pic = await image.GET(new Request(url(`/api/gallery/image/${name}`)), ctx({ name }))
      const text = new TextDecoder().decode(new Uint8Array(await pic.arrayBuffer()))
      expect(text).not.toContain('Exif')
      expect(text).not.toContain('GPS')
      expect(pic.headers.get('cache-control')).toBe('public, max-age=300')
    }
  })

  it('мусор в проекте, названии и имени до ответа не доходит, в панели экранирован', async () => {
    login(phone(), '<script>alert(1)</script>')
    const res = await list.POST(
      publishForm({ q: 'f=corner&a=300&b=240&s=neoclassic&x=<script>&ov=%2B996555123456&t="', title: '<script>alert(2)</script>' }),
    )
    const { id } = (await res.json()) as { id: string }
    login(phone(), 'Болот')
    await comments.POST(json(`/api/gallery/${id}/comments`, { text: '<script>alert(3)</script>' }), ctx({ id }))
    const text = await (await one.GET(new Request(url(`/api/gallery/${id}`)), ctx({ id }))).text()
    const kitchen = (JSON.parse(text) as { kitchen: { q: string } }).kitchen
    expect(kitchen.q).not.toMatch(/script|<|"|996|x=/)
    expect(text).not.toContain('+996')

    process.env.ASSISTANT_LOG_KEY = 'test-panel-key'
    const html = await (await panel.GET(new Request(url('/panel/gallery?key=test-panel-key')))).text()
    expect(html).not.toMatch(/<script>alert/)
    expect(html).toContain('&lt;script&gt;alert(2)')
    expect(html).toContain('&lt;script&gt;alert(3)')
  })

  it('оценок не больше 30 в минуту с одного телефона', async () => {
    const voter = phone()
    const ids: string[] = []
    for (let i = 0; i < 7; i += 1) {
      const p = phone()
      for (let j = 0; j < 5; j += 1) ids.push(await publishAs(p))
    }
    login(voter)
    for (let i = 0; i < 30; i += 1) {
      const id = ids[i]
      expect((await rate.POST(json(`/api/gallery/${id}/rate`, { stars: 5 }), ctx({ id }))).status).toBe(200)
    }
    const id = ids[30]
    expect((await rate.POST(json(`/api/gallery/${id}/rate`, { stars: 5 }), ctx({ id }))).status).toBe(429)
  })

  it('предел по адресу — из x-real-ip, X-Forwarded-For не помогает', async () => {
    for (let i = 0; i < 4; i += 1) {
      login(phone())
      for (let j = 0; j < 5; j += 1) expect((await list.POST(publishForm({ ip: '10.0.0.7' }))).status).toBe(200)
    }
    login(phone())
    const form = publishForm({ ip: '10.0.0.7' })
    form.headers.set('x-forwarded-for', `203.0.113.${seq}`)
    expect((await list.POST(form)).status).toBe(429)
  })
})
