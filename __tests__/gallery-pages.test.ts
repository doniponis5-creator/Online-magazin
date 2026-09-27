import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
// страница рендерится без приложения Next: роутер (router.refresh после входа) — заглушка
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }))

import { READY } from '@/data/kitchen-ready'
import { thumbOf } from '@/lib/gallery/rules'
import { errorText, galleryTexts } from '@/lib/gallery/texts'
import { addComment, addRealPhotos, hideKitchen, publishKitchen } from '@/lib/gallery/store'
import { galleryTiles, kitchenPage } from '@/components/gallery/data'
import { KitchenTile } from '@/components/gallery/KitchenTile'
import { KitchenView } from '@/components/gallery/KitchenView'
import sitemap from '@/app/sitemap'

/**
 * Страницы галереи: что видит посетитель. Телефонов и фамилий в разметке нет —
 * ни у автора, ни у комментария; скрытой кухни нет ни на странице, ни в карте сайта.
 */

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46])
const AUTHOR = '+996555123456'
const GUEST = '+996700987654'

async function publish(over: Partial<Parameters<typeof publishKitchen>[0]> = {}): Promise<string> {
  const res = await publishKitchen({
    q: 'f=corner&a=300&b=240&s=neoclassic',
    title: null,
    role: 'master',
    phone: AUTHOR,
    name: 'Азамат Абдыкадыров',
    image: { bytes: JPEG, ext: 'jpg' },
    thumb: { bytes: JPEG, ext: 'jpg' },
    ...over,
  })
  if (typeof res === 'string') throw new Error(`не опубликовано: ${res}`)
  return res.id
}

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el)

describe('страницы галереи', () => {
  let dir = ''

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gallery-pages-'))
    process.env.GALLERY_DIR = dir
  })

  afterEach(() => {
    delete process.env.GALLERY_DIR
    rmSync(dir, { recursive: true, force: true })
  })

  it('страница кухни: имя без фамилии, метка «Мастер», ни одного телефона; «Хочу такую же» — проект в конструкторе', async () => {
    const id = await publish()
    expect(await addComment(id, GUEST, 'Бекзат Усонов', 'Красиво! Звоните 0700 987 654')).toMatchObject({ id: expect.any(String) })

    const page = await kitchenPage(id, 'ru')
    expect(page).not.toBeNull()
    const out = html(createElement(KitchenView, { page: page!, lang: 'ru', viewer: null }))

    expect(out).toContain('Азамат')
    expect(out).toContain('Бекзат')
    expect(out).toContain('Мастер')
    expect(out).toContain('Угловая 300 × 240 · Неоклассика')
    expect(out).not.toContain('Абдыкадыров')
    expect(out).not.toContain('Усонов')
    const digits = out.replace(/\D/g, '')
    expect(digits).not.toContain('555123456')
    expect(digits).not.toContain('700987654')
    expect(out).toContain('href="/ru/kitchen?f=corner&amp;a=300&amp;b=240&amp;s=neoclassic"')
  })

  it('скрытой и чужой кухни нет; готовая — по ready-<id>', async () => {
    const id = await publish()
    await hideKitchen(id)
    expect(await kitchenPage(id, 'ru')).toBeNull()
    expect(await kitchenPage('ready-nope', 'ru')).toBeNull()
    expect(await kitchenPage('../etc', 'ru')).toBeNull()

    const ready = await kitchenPage(`ready-${READY[0].id}`, 'ky')
    expect(ready).toMatchObject({ title: READY[0].ky, social: false, card: READY[0].card })
  })

  it('карточка с фото вживую: метка и маленькое фото поверх кадра; фильтр «только с фото»', async () => {
    const plain = await publish({ phone: '+996555000111' })
    const real = await publish()
    const photos = await addRealPhotos(real, AUTHOR, [{ bytes: JPEG, ext: 'jpg', thumb: JPEG }])
    expect(Array.isArray(photos)).toBe(true)

    const all = await galleryTiles({ lang: 'ru', sort: 'new' })
    expect(all.items.map((t) => t.id)).toEqual([real, plain])
    const out = html(createElement(KitchenTile, { tile: all.items[0], lang: 'ru' }))
    expect(out).toContain('Есть фото вживую')
    expect(out).toContain(`/api/gallery/image/${thumbOf((photos as string[])[0])}`)
    expect(out.replace(/\D/g, '')).not.toContain('555123456')

    const onlyReal = await galleryTiles({ lang: 'ru', sort: 'new', real: true })
    expect(onlyReal.items.map((t) => t.id)).toEqual([real])
  })

  it('фильтр размера — из хранилища, «Ещё» не больше 5 страниц', async () => {
    const small = await publish({ phone: '+996555000333', q: 'f=straight&a=240&s=neoclassic' })
    await publish({ phone: '+996555000444' })
    const res = await galleryTiles({ lang: 'ru', sort: 'new', size: 'small' })
    expect(res.items.map((t) => t.id)).toEqual([small])
    expect(res).toMatchObject({ total: 1, more: false })
    const many = await galleryTiles({ lang: 'ru', sort: 'new', upto: 50 })
    expect(many.total).toBe(2)
  })

  it('ошибки: no-space и уточнения too-many на обоих языках; вход — кодом в Telegram', () => {
    expect(errorText('ru', 'no-space')).toBe('Место под фото закончилось — владелец уже знает.')
    expect(errorText('ru', 'too-many', 'photos')).toBe('Не больше 5 фото.')
    expect(errorText('ru', 'too-many', 'comments')).toBe('Комментариев слишком много.')
    expect(errorText('ru', 'too-many', 'often')).toBe('Слишком часто — подождите.')
    expect(errorText('ru', 'too-many')).toBe(galleryTexts('ru').errors['too-many'])
    for (const lang of ['ru', 'ky'] as const) {
      const t = galleryTexts(lang)
      expect(t.errors['no-space']).toBeTruthy()
      expect(Object.values(t.tooMany).every(Boolean)).toBe(true)
      expect(t.loginLead.indexOf('Telegram')).toBeLessThan(t.loginLead.indexOf('WhatsApp'))
    }
  })

  it('карта сайта: галерея, готовые кухни и опубликованные — скрытых нет', async () => {
    const shown = await publish()
    const hidden = await publish({ phone: '+996555000222' })
    await hideKitchen(hidden)

    const urls = (await sitemap()).map((e) => e.url)
    expect(urls).toContain('https://smarket.kg/ru/kitchen/gallery')
    expect(urls).toContain(`https://smarket.kg/ru/kitchen/gallery/ready-${READY[0].id}`)
    expect(urls).toContain(`https://smarket.kg/ru/kitchen/gallery/${shown}`)
    expect(urls.join(' ')).not.toContain(hidden)
    expect(urls).toContain('https://smarket.kg/ru/kitchen')
  })
})
