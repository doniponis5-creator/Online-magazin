import { existsSync, mkdtempSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { hideDigits } from '@/lib/assistant/log'
import { authorIdOf } from '@/lib/gallery/author'
import { imageSize, stripExif, stripMeta } from '@/lib/gallery/image'
import { DEFAULT_STATE, queryFromState } from '@/lib/kitchen/share'
import {
  authorNameOf,
  canonicalQuery,
  checkQuery,
  cleanComment,
  firstName,
  rankScore,
  PAGE_SIZE,
  sizeBand,
  thumbOf,
  titleOf,
  wallLength,
  validateComment,
  validateTitle,
} from '@/lib/gallery/rules'
import {
  addComment,
  addRealPhotos,
  allKitchens,
  getKitchen,
  hideComment,
  hideKitchen,
  hidePhoto,
  listKitchens,
  publishKitchen,
  publishedIndex,
  rateKitchen,
  readImage,
  removeOwn,
  reportItem,
  viewerOf,
} from '@/lib/gallery/store'

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

describe('размер картинки по заголовку и EXIF', () => {
  it('JPEG, PNG, WebP: ширина и высота; мусор — null', () => {
    expect(imageSize(jpeg(1200, 750))).toEqual({ width: 1200, height: 750 })
    expect(imageSize(jpeg(5000, 300, true))).toEqual({ width: 5000, height: 300 })
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0x04, 0xb0, 0, 0, 0x02, 0xee, 8, 2, 0, 0, 0])
    expect(imageSize(png)).toEqual({ width: 1200, height: 750 })
    const vp8x = new Uint8Array([...new TextEncoder().encode('RIFF'), 30, 0, 0, 0, ...new TextEncoder().encode('WEBPVP8X'), 10, 0, 0, 0, 0, 0, 0, 0, 0xaf, 0x04, 0, 0xed, 0x02, 0])
    expect(imageSize(vp8x)).toEqual({ width: 1200, height: 750 })
    expect(imageSize(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]))).toBeNull()
  })

  it('EXIF (APP1) срезается, остальное на месте', () => {
    const clean = stripExif(jpeg(1200, 750, true))!
    expect(new TextDecoder().decode(clean)).not.toContain('Exif')
    expect(clean).toEqual(jpeg(1200, 750))
    expect(stripExif(jpeg(10, 10))).toEqual(jpeg(10, 10))
    expect(stripMeta(jpeg(1200, 750, true), 'jpg')).toEqual(jpeg(1200, 750))
  })

  it('PNG: текстовые чанки и eXIf срезаются; WebP: EXIF и XMP, флаги и размер RIFF поправлены', () => {
    const enc = (s: string) => [...new TextEncoder().encode(s)]
    const chunk = (type: string, data: number[]) => [0, 0, data.length >> 8, data.length & 255, ...enc(type), ...data, 1, 2, 3, 4]
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    const ihdr = chunk('IHDR', [0, 0, 0x04, 0xb0, 0, 0, 0x02, 0xee, 8, 2, 0, 0, 0])
    const idat = chunk('IDAT', [9, 9, 9])
    const iend = chunk('IEND', [])
    const dirty = new Uint8Array([...sig, ...ihdr, ...chunk('tEXt', enc('Author\0Azamat +996555123456')), ...chunk('eXIf', enc('GPS')), ...idat, ...chunk('iTXt', enc('x')), ...chunk('zTXt', enc('y')), ...iend])
    expect(stripMeta(dirty, 'png')).toEqual(new Uint8Array([...sig, ...ihdr, ...idat, ...iend]))

    const le32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255]
    const riff = (chunks: number[][]) => {
      const body = [...enc('WEBP'), ...chunks.flat()]
      return new Uint8Array([...enc('RIFF'), ...le32(body.length), ...body])
    }
    const wchunk = (type: string, data: number[]) => [...enc(type), ...le32(data.length), ...data, ...(data.length % 2 ? [0] : [])]
    const vp8x = (flags: number) => wchunk('VP8X', [flags, 0, 0, 0, 0xaf, 0x04, 0, 0xed, 0x02, 0])
    const image = wchunk('VP8L', [0x2f, 1, 2, 3, 4])
    const cleanWebp = stripMeta(riff([vp8x(0x0c), image, wchunk('EXIF', enc('GPS 42')), wchunk('XMP ', enc('<x/>'))]), 'webp')
    expect(cleanWebp).toEqual(riff([vp8x(0), image]))
    expect(imageSize(cleanWebp!)).toEqual({ width: 1200, height: 750 })
  })
})

describe('правила галереи', () => {
  afterEach(() => {
    delete process.env.SHOP_API_SECRET
  })

  it('лучшие: байесовское среднее, одна пятёрка не выстреливает', () => {
    // посчитано вручную: (3,5·5 + avg·count) / (5 + count)
    expect(rankScore(0, 0)).toBeCloseTo(3.5)
    expect(rankScore(5, 1)).toBeCloseTo(3.75)
    expect(rankScore(4.5, 20)).toBeCloseTo(4.3)
    expect(rankScore(5, 1)).toBeLessThan(rankScore(4.5, 20))
  })

  it('автор — непрозрачный id из телефона, 12 hex, зависит от секрета', () => {
    const plain = authorIdOf('+996555123456')
    expect(plain).toMatch(/^[a-f0-9]{12}$/)
    expect(authorIdOf('+996555123456')).toBe(plain)
    expect(authorIdOf('+996555000000')).not.toBe(plain)
    process.env.SHOP_API_SECRET = 'test-secret-a'
    const a = authorIdOf('+996555123456')
    expect(a).toMatch(/^[a-f0-9]{12}$/)
    expect(a).not.toBe(plain)
    process.env.SHOP_API_SECRET = 'test-secret-b'
    expect(authorIdOf('+996555123456')).not.toBe(a)
  })

  it('подпись — только имя, без фамилии', () => {
    expect(firstName('Азамат Абдыкадыров')).toBe('Азамат')
    expect(firstName('  Айгерим  ')).toBe('Айгерим')
    expect(firstName('')).toBe('')
    expect(firstName('Б'.repeat(40))).toHaveLength(30)
  })

  it('комментарий: телефоны и ссылки прячутся', () => {
    const text = cleanComment('Звоните +996 555 123 456, сайт https://spam.kg/x, www.a.ru и t.me/foo, ещё shop.kg')
    expect(text).not.toMatch(/\d{3}/)
    expect(text).not.toMatch(/https?:|www\.|t\.me|spam\.kg|shop\.kg/)
    expect(text).toContain('Звоните')
    // телефоны — тем же правилом, что журнал чата
    const phone = 'мой номер 0555 12 34 56, звоните'
    expect(cleanComment(phone)).toBe(hideDigits(phone))
    expect(cleanComment('Кухня 300 см, 4 шкафа')).toBe('Кухня 300 см, 4 шкафа')
  })

  it('комментарий: 2–500 знаков после очистки', () => {
    expect(validateComment('')).toEqual({ ok: false, error: 'bad-input' })
    expect(validateComment(' а ')).toEqual({ ok: false, error: 'bad-input' })
    expect(validateComment(42)).toEqual({ ok: false, error: 'bad-input' })
    expect(validateComment('x'.repeat(501))).toEqual({ ok: false, error: 'bad-input' })
    expect(validateComment('  Класс\u0007  ')).toEqual({ ok: true, value: 'Класс' })
  })

  it('название: необязательно, до 80 знаков, одной строкой', () => {
    expect(validateTitle(undefined)).toEqual({ ok: true, value: null })
    expect(validateTitle('   ')).toEqual({ ok: true, value: null })
    expect(validateTitle('  Моя\nкухня  ')).toEqual({ ok: true, value: 'Моя кухня' })
    expect(validateTitle('x'.repeat(81))).toEqual({ ok: false, error: 'bad-input' })
  })

  it('название по умолчанию — форма, размеры, стиль', () => {
    expect(titleOf('f=corner&a=300&b=240&s=neoclassic')).toBe('Угловая 300 × 240 · Неоклассика')
    expect(titleOf('f=corner&a=300&b=240&s=neoclassic', 'ky')).toBe('Бурчтук 300 × 240 · Неоклассика')
    expect(titleOf('f=straight&a=360&s=neoclassic')).toBe('Прямая 360 · Неоклассика')
  })

  it('проект хранится каноничным: чужие ключи и мусор в id техники выбрасываются', () => {
    const own = queryFromState({ ...DEFAULT_STATE, picks: { oven: 'ef6c5df7-0a5e-11f1-abea-6834219981b1', hob: 'cb-00002489', hood: null } })
    expect(canonicalQuery(own)).toBe(own)
    const dirty = canonicalQuery(
      'f=corner&a=300&b=240&s=neoclassic&x=<script>&ov=%2B996555123456&mw=996555123456&fr=whatsapp-0555123456&dw=aura-x5&hb=cb-00002489&t="',
    )!
    expect(dirty).toContain('hb=cb-00002489')
    expect(dirty).not.toMatch(/whatsapp|aura|fr=|dw=/)
    expect(dirty).not.toMatch(/script|<|"|996|x=/)
    expect(canonicalQuery('мусор')).toBeNull()
  })

  it('размер кухни: сумма стен без острова → до 2,7 м / 2,7–4 м / больше 4 м', () => {
    expect(wallLength({ shape: 'corner', a: 300, b: 240, c: 220 })).toBe(540)
    expect(wallLength({ shape: 'island', a: 300, b: 240, c: 220 })).toBe(300)
    expect(wallLength({ shape: 'u', a: 300, b: 240, c: 220 })).toBe(760)
    expect([270, 271, 400, 401].map(sizeBand)).toEqual(['small', 'mid', 'mid', 'big'])
  })

  it('имя автора: только имя, телефоны и ссылки не проходят', () => {
    expect(authorNameOf('Азамат Абдыкадыров')).toBe('Азамат')
    expect(authorNameOf('+996555123456')).toBe('')
    expect(authorNameOf('spam.kg Азамат')).toBe('')
    expect(authorNameOf('')).toBe('')
  })

  it('без секрета в продакшене authorId не считается', () => {
    vi.stubEnv('NODE_ENV', 'production')
    try {
      expect(() => authorIdOf('+996555123456')).toThrow()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('проект: строка до 4000 знаков, форма из неё', () => {
    expect(checkQuery('f=straight&a=300')).toEqual({ shape: 'straight' })
    expect(checkQuery('f=u&a=300&b=240&c=220')).toEqual({ shape: 'u' })
    expect(checkQuery('x'.repeat(4001))).toBeNull()
    expect(checkQuery('')).toBeNull()
    expect(checkQuery(undefined)).toBeNull()
    expect(checkQuery('f=corner\u0000')).toBeNull()
  })
})

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46])
const AZAMAT = '+996555123456'
const BOLOT = '+996700111222'

let seq = 0
/** Свой телефон на каждую публикацию — чтобы не упереться в 5 в сутки, где это не проверяем. */
const nextPhone = () => `+996777${String(++seq).padStart(6, '0')}`

function input(over: Partial<Parameters<typeof publishKitchen>[0]> = {}) {
  return {
    q: 'f=corner&a=300&b=240&s=neoclassic',
    title: null,
    role: 'buyer' as const,
    phone: AZAMAT,
    name: 'Азамат Абдыкадыров',
    image: { bytes: JPEG, ext: 'jpg' as const },
    thumb: { bytes: JPEG, ext: 'jpg' as const },
    ...over,
  }
}

async function publish(over: Partial<Parameters<typeof publishKitchen>[0]> = {}): Promise<string> {
  const res = await publishKitchen(input(over))
  if (typeof res === 'string') throw new Error(`не опубликовано: ${res}`)
  return res.id
}

describe('хранилище галереи', () => {
  let dir = ''

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gallery-'))
    process.env.GALLERY_DIR = dir
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.GALLERY_DIR
    delete process.env.GALLERY_MAX
    delete process.env.GALLERY_IMAGE_BUDGET
    rmSync(dir, { recursive: true, force: true })
  })

  it('публикация: кухня сразу видна, название собрано из проекта, подпись — только имя', async () => {
    const id = await publish()
    expect(id).toMatch(/^[a-f0-9]{16}$/)
    const k = await getKitchen(id)
    expect(k).toMatchObject({
      id,
      title: 'Угловая 300 × 240 · Неоклассика',
      shape: 'corner',
      role: 'buyer',
      authorName: 'Азамат',
      avg: 0,
      count: 0,
      comments: [],
      realPhotos: [],
      hasReal: false,
      autoTitle: true,
    })
    expect(k!.authorId).toMatch(/^[a-f0-9]{12}$/)
    const list = await listKitchens({ sort: 'new' })
    expect(list.items.map((x) => x.id)).toEqual([id])
    expect(await readImage(k!.image)).toMatchObject({ type: 'image/jpeg' })
    expect(await readImage(k!.thumb)).not.toBeNull()
    expect(await readImage('../kitchens.json')).toBeNull()
  })

  it('битый проект и лишнее название не принимаются', async () => {
    expect(await publishKitchen(input({ q: 'x'.repeat(4001) }))).toBe('bad-input')
    expect(await publishKitchen(input({ title: 'x'.repeat(81) }))).toBe('bad-input')
    const named = await publishKitchen(input({ title: 'Моя кухня' }))
    if (typeof named === 'string') throw new Error(named)
    expect(await getKitchen(named.id)).toMatchObject({ title: 'Моя кухня', autoTitle: false })
  })

  it('телефоны не утекают ни в список, ни в кухню', async () => {
    const id = await publish()
    const guest = `+996700${String(++seq).padStart(6, '0')}` // свой комментатор: предел 30 с общий на файл
    await rateKitchen(id, guest, 4)
    await addComment(id, guest, 'Болот Исаков', 'Красиво, мой номер 0700 111 222')
    await reportItem(id, guest)
    const out = JSON.stringify([await getKitchen(id), await listKitchens({ sort: 'top' })])
    expect(out).not.toContain('+996')
    expect(out).not.toContain('555123456')
    expect(out).not.toContain(guest.slice(4))
    expect(out).not.toContain('111 222')
    expect(out).not.toMatch(/phone|ratings|reporters/)
    expect(out).toContain('Болот')
    expect(out).not.toContain('Исаков')
  })

  it('скрытая кухня пропадает везде, её картинки не отдаются', async () => {
    const id = await publish()
    const k = (await getKitchen(id))!
    expect(await hideKitchen(id)).toBe(true)
    expect(await getKitchen(id)).toBeNull()
    expect((await listKitchens({ sort: 'new' })).total).toBe(0)
    expect(await readImage(k.image)).toBeNull()
    expect(await readImage(k.thumb)).toBeNull()
    expect(await rateKitchen(id, BOLOT, 5)).toBe('not-found')
    expect((await allKitchens()).find((x) => x.id === id)?.status).toBe('hidden')
  })

  it('убрать может только автор', async () => {
    const id = await publish()
    expect(await removeOwn(id, BOLOT)).toBe('forbidden')
    expect(await getKitchen(id)).not.toBeNull()
    expect(await viewerOf(id, AZAMAT)).toEqual({ mine: true, stars: null })
    expect(await viewerOf(id, BOLOT)).toEqual({ mine: false, stars: null })
    expect(await removeOwn(id, AZAMAT)).toBe('ok')
    expect(await getKitchen(id)).toBeNull()
    expect(readdirSync(join(dir, 'images'))).toEqual([])
    expect(await removeOwn(id, AZAMAT)).toBe('not-found')
  })

  it('оценка: одна от человека, можно поменять, свою нельзя', async () => {
    const id = await publish()
    expect(await rateKitchen(id, BOLOT, 5)).toEqual({ avg: 5, count: 1 })
    expect(await rateKitchen(id, BOLOT, 3)).toEqual({ avg: 3, count: 1 })
    expect(await rateKitchen(id, nextPhone(), 4)).toEqual({ avg: 3.5, count: 2 })
    expect(await rateKitchen(id, AZAMAT, 5)).toBe('forbidden')
    expect(await rateKitchen(id, BOLOT, 6)).toBe('bad-input')
    expect(await viewerOf(id, BOLOT)).toEqual({ mine: false, stars: 3 })
  })

  it('не больше 5 кухонь в сутки с одного телефона', async () => {
    for (let i = 0; i < 5; i += 1) await publish()
    expect(await publishKitchen(input())).toBe('too-many')
    expect(await publishKitchen(input({ phone: BOLOT }))).toMatchObject({ id: expect.any(String) })
  })

  it('лучшие — по взвешенной оценке, новые — по дате, фильтры и страницы', async () => {
    const one = await publish({ phone: nextPhone() })
    const many = await publish({ phone: nextPhone(), q: 'f=straight&a=360&s=neoclassic' })
    const plain = await publish({ phone: nextPhone(), role: 'master' })
    await rateKitchen(one, nextPhone(), 5)
    for (let i = 0; i < 4; i += 1) await rateKitchen(many, nextPhone(), 5)
    expect((await listKitchens({ sort: 'top' })).items.map((x) => x.id)).toEqual([many, one, plain])
    expect((await listKitchens({ sort: 'new' })).items.map((x) => x.id)).toEqual([plain, many, one])
    expect((await listKitchens({ sort: 'new', shape: 'straight' })).items.map((x) => x.id)).toEqual([many])
    const master = (await getKitchen(plain))!
    expect((await listKitchens({ sort: 'new', authorId: master.authorId })).items.map((x) => x.id)).toEqual([plain])

    for (let i = 0; i < PAGE_SIZE; i += 1) await publish({ phone: nextPhone() })
    const first = await listKitchens({ sort: 'new', page: 1 })
    const second = await listKitchens({ sort: 'new', page: 2 })
    expect(first.items).toHaveLength(PAGE_SIZE)
    expect(second.items).toHaveLength(3)
    expect(first.total).toBe(PAGE_SIZE + 3)
  })

  it('фильтр размера и число на странице — в хранилище, за один запрос', async () => {
    const small = await publish({ phone: nextPhone(), q: 'f=straight&a=240&s=neoclassic' })
    const mid = await publish({ phone: nextPhone(), q: 'f=island&a=360&i=180&s=neoclassic' })
    const big = await publish({ phone: nextPhone() })
    expect((await listKitchens({ sort: 'new', size: 'small' })).items.map((x) => x.id)).toEqual([small])
    expect((await listKitchens({ sort: 'new', size: 'mid' })).items.map((x) => x.id)).toEqual([mid])
    expect((await listKitchens({ sort: 'new', size: 'big' })).items.map((x) => x.id)).toEqual([big])
    const two = await listKitchens({ sort: 'new', limit: 2 })
    expect(two.items.map((x) => x.id)).toEqual([big, mid])
    expect(two.total).toBe(3)
  })

  it('указатель для карты сайта: только видимые, id и дата', async () => {
    const shown = await publish({ phone: nextPhone() })
    const hidden = await publish({ phone: nextPhone() })
    await hideKitchen(hidden)
    const index = await publishedIndex()
    expect(index).toEqual([{ id: shown, createdAt: (await getKitchen(shown))!.createdAt }])
  })

  it('«мои» — по телефону', async () => {
    const mine = await publish()
    await publish({ phone: BOLOT })
    expect((await listKitchens({ sort: 'new', phone: AZAMAT })).items.map((x) => x.id)).toEqual([mine])
  })

  it('параллельные записи не теряются', async () => {
    const ids = await Promise.all(Array.from({ length: 10 }, () => publish({ phone: nextPhone() })))
    const id = ids[0]
    await Promise.all(Array.from({ length: 10 }, () => rateKitchen(id, nextPhone(), 4)))
    expect((await listKitchens({ sort: 'new' })).total).toBe(10)
    expect((await getKitchen(id))!.count).toBe(10)
  })

  it('битый kitchens.json не превращается в пустую галерею', async () => {
    writeFileSync(join(dir, 'kitchens.json'), '[{"id": "обрыв')
    await expect(listKitchens({ sort: 'new' })).rejects.toThrow()
    await expect(publishKitchen(input())).rejects.toThrow()
    expect(existsSync(join(dir, 'kitchens.json'))).toBe(true)
    expect(readdirSync(dir)).toContain('kitchens.json')
    const { readFileSync } = await import('node:fs')
    expect(readFileSync(join(dir, 'kitchens.json'), 'utf8')).toBe('[{"id": "обрыв')
  })

  it('сверх предела вычищаются сначала скрытые, потом старые без оценок', async () => {
    process.env.GALLERY_MAX = '3'
    const hidden = await publish({ phone: nextPhone() })
    const oldRated = await publish({ phone: nextPhone() })
    const oldPlain = await publish({ phone: nextPhone() })
    await rateKitchen(oldRated, nextPhone(), 4)
    await hideKitchen(hidden)
    const fresh = await publish({ phone: nextPhone() })
    expect((await allKitchens()).map((x) => x.id).sort()).toEqual([oldRated, oldPlain, fresh].sort())
    const gone = (await allKitchens()).find((x) => x.id === oldPlain)!
    const newer = await publish({ phone: nextPhone() })
    expect((await allKitchens()).map((x) => x.id).sort()).toEqual([oldRated, fresh, newer].sort())
    const left = readdirSync(join(dir, 'images'))
    expect(left).not.toContain(gone.image)
    expect(left).not.toContain(gone.thumb)
    expect(left).toHaveLength(3 * 2)
  })

  it('комментарии: имя, телефоны прячутся, владелец скрывает', async () => {
    const id = await publish()
    const guest = `+996700${String(++seq).padStart(6, '0')}` // свой комментатор: предел 30 с общий на файл
    const c = await addComment(id, guest, 'Болот Исаков', 'Звоните 0700 111 222, классная кухня')
    if (typeof c === 'string') throw new Error(c)
    expect(c).toMatchObject({ authorName: 'Болот', text: 'Звоните …, классная кухня' })
    expect(await addComment(id, guest, 'Болот', 'x')).toBe('bad-input')
    expect(await addComment('0000000000000000', guest, 'Болот', 'Хорошо')).toBe('not-found')
    expect((await getKitchen(id))!.comments).toHaveLength(1)
    expect((await getKitchen(id))!.commentCount).toBe(1)
    expect(await hideComment(id, c.id)).toBe(true)
    expect((await getKitchen(id))!.comments).toEqual([])
  })

  it('жалоба: одна от человека на запись, поднимает счётчик для панели', async () => {
    const id = await publish()
    const guest = `+996700${String(++seq).padStart(6, '0')}` // свой комментатор: предел 30 с общий на файл
    const c = await addComment(id, guest, 'Болот', 'Не нравится')
    if (typeof c === 'string') throw new Error(c)
    expect(await reportItem(id, guest)).toBe('ok')
    expect(await reportItem(id, guest)).toBe('already')
    expect(await reportItem(id, guest, c.id)).toBe('ok')
    expect(await reportItem(id, guest, 'ffffffffffffffff')).toBe('not-found')
    const row = (await allKitchens()).find((x) => x.id === id)!
    expect(row.reports).toBe(1)
    expect(row.comments[0].reports).toBe(1)
    expect(await getKitchen(id)).not.toBeNull()
  })

  it('«я сделал такую»: фото добавляет только автор, до 5', async () => {
    const id = await publish()
    const photo = { bytes: JPEG, ext: 'jpg' as const, thumb: JPEG }
    expect(await addRealPhotos(id, BOLOT, [photo])).toBe('forbidden')
    const names = await addRealPhotos(id, AZAMAT, [photo, photo, photo])
    if (typeof names === 'string') throw new Error(names)
    expect(names).toHaveLength(3)
    expect(await addRealPhotos(id, AZAMAT, [photo, photo, photo])).toBe('too-many')
    expect((await getKitchen(id))!.realPhotos).toEqual(names)
    expect((await getKitchen(id))!.hasReal).toBe(true)
    expect((await listKitchens({ sort: 'new' })).items[0].realThumb).toBe(thumbOf(names[0]))
    expect(await readImage(names[0])).not.toBeNull()
    expect(await hidePhoto(id, names[0])).toBe(true)
    expect((await getKitchen(id))!.realPhotos).toEqual(names.slice(1))
    expect(await readImage(names[0])).toBeNull()
  })

  it('фото вживую: фильтр «только с фото» и выше при равной оценке', async () => {
    const photo = { bytes: JPEG, ext: 'jpg' as const, thumb: JPEG }
    const realPhone = nextPhone()
    const real = await publish({ phone: realPhone })
    const plain = await publish({ phone: nextPhone() })
    await addRealPhotos(real, realPhone, [photo])
    expect((await listKitchens({ sort: 'top' })).items.map((x) => [x.id, x.hasReal])).toEqual([
      [real, true],
      [plain, false],
    ])
    expect((await listKitchens({ sort: 'new', real: true })).items.map((x) => x.id)).toEqual([real])
    // оценка всё равно главнее фото
    await rateKitchen(plain, nextPhone(), 5)
    expect((await listKitchens({ sort: 'top' })).items.map((x) => x.id)).toEqual([plain, real])
  })

  it('отказ и повтор той же оценки не переписывают файл', async () => {
    const id = await publish()
    await rateKitchen(id, BOLOT, 4)
    await reportItem(id, BOLOT)
    const file = join(dir, 'kitchens.json')
    const old = new Date('2020-01-01T00:00:00Z')
    utimesSync(file, old, old)
    expect(await rateKitchen(id, AZAMAT, 5)).toBe('forbidden')
    expect(await rateKitchen(id, BOLOT, 4)).toEqual({ avg: 4, count: 1 })
    expect(await reportItem(id, BOLOT)).toBe('already')
    expect(await removeOwn(id, BOLOT)).toBe('forbidden')
    expect(await addRealPhotos(id, BOLOT, [{ bytes: JPEG, ext: 'jpg' }])).toBe('forbidden')
    expect(await hideComment(id, 'ffffffffffffffff')).toBe(false)
    expect(await addComment(id, BOLOT, 'Болот', 'x')).toBe('bad-input')
    expect(statSync(file).mtimeMs).toBe(old.getTime())
  })

  it('5 в сутки считаются по журналу: убранная кухня лимит не возвращает', async () => {
    const ids = []
    for (let i = 0; i < 5; i += 1) ids.push(await publish())
    expect(await removeOwn(ids[0], AZAMAT)).toBe('ok')
    expect(await publishKitchen(input())).toBe('too-many')
  })

  it('комментарии: раз в 30 с, 20 в сутки от человека; отказ слот не тратит', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const start = Date.parse('2030-01-01T10:00:00Z')
    const who = nextPhone()
    vi.setSystemTime(start)
    const id = await publish()
    expect(await addComment(id, who, 'Болот', 'x')).toBe('bad-input')
    expect(await addComment(id, who, 'Болот', 'Первый')).toMatchObject({ text: 'Первый' })
    expect(await addComment(id, who, 'Болот', 'Сразу второй')).toBe('too-many')
    for (let i = 1; i < 20; i += 1) {
      vi.setSystemTime(start + i * 31_000)
      expect(await addComment(id, who, 'Болот', `Комментарий ${i}`)).toMatchObject({ authorName: 'Болот' })
    }
    vi.setSystemTime(start + 21 * 31_000)
    expect(await addComment(id, who, 'Болот', 'Двадцать первый')).toBe('too-many')
    vi.setSystemTime(start + 24 * 3600_000 + 60_000)
    expect(await addComment(id, who, 'Болот', 'Новый день')).toMatchObject({ text: 'Новый день' })
  })

  it('на одной кухне не больше 300 комментариев', async () => {
    const id = await publish()
    for (let i = 0; i < 300; i += 1) await addComment(id, nextPhone(), 'Гость', `Отлично ${i}`)
    expect((await getKitchen(id))!.commentCount).toBe(300)
    expect(await addComment(id, nextPhone(), 'Гость', 'Ещё один')).toBe('full')
  })

  it('место под картинки: публикация вытесняет старые без оценок, фото вживую — no-space', async () => {
    process.env.GALLERY_IMAGE_BUDGET = String(JPEG.length * 2 * 3)
    const rated = await publish({ phone: nextPhone() })
    const plain = await publish({ phone: nextPhone() })
    await publish({ phone: nextPhone() })
    await rateKitchen(rated, nextPhone(), 5)
    const fresh = await publish({ phone: nextPhone() })
    const ids = (await allKitchens()).map((x) => x.id)
    expect(ids).toHaveLength(3)
    expect(ids).toContain(rated)
    expect(ids).toContain(fresh)
    expect(ids).not.toContain(plain)
    const owner = (await allKitchens()).find((x) => x.id === fresh)!
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await addRealPhotos(fresh, owner.phone, [{ bytes: JPEG, ext: 'jpg' }])).toBe('no-space')
    expect(log.mock.calls.flat().join(' ')).toContain('место под картинки кончилось')
    log.mockRestore()
  })
})
