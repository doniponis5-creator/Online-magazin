import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { MAX_PHOTOS, MAX_SHOWN, PHOTO_NAME, checkReview, cleanText, displayName, imageType, isBought, thumbOf } from '@/lib/reviews/rules'
import { addReview, hideReview, publishedReviews, readPhoto, reviewedOrders } from '@/lib/reviews/store'

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46])

describe('правила отзыва', () => {
  it('имя: имя и первая буква фамилии', () => {
    expect(displayName('Азамат Абдыкадыров')).toBe('Азамат А.')
    expect(displayName('  Айгерим  ')).toBe('Айгерим')
    expect(displayName('')).toBe('')
  })

  it('отзыв можно писать только по оплаченному заказу', () => {
    expect(isBought('paid')).toBe(true)
    expect(isBought('in_1c')).toBe(true)
    expect(isBought('awaiting_payment')).toBe(false)
    expect(isBought('cancelled')).toBe(false)
  })

  it('проверка формы', () => {
    const good = { orderId: 'SC-260917-7K3QF', rating: '5', text: 'Всё отлично' }
    expect(checkReview(good, 0)).toEqual({ ok: true, value: { orderId: 'SC-260917-7K3QF', rating: 5, text: 'Всё отлично' } })
    expect(checkReview({ ...good, rating: '0' }, 0)).toEqual({ ok: false, error: 'rating' })
    expect(checkReview({ ...good, rating: '4.5' }, 0)).toEqual({ ok: false, error: 'rating' })
    expect(checkReview({ ...good, text: '  ' }, 0)).toEqual({ ok: false, error: 'text' })
    expect(checkReview({ ...good, text: 'x'.repeat(1001) }, 0)).toEqual({ ok: false, error: 'text' })
    expect(checkReview({ ...good, orderId: '../etc' }, 0)).toEqual({ ok: false, error: 'order' })
    expect(checkReview(good, MAX_PHOTOS + 1)).toEqual({ ok: false, error: 'photos' })
  })

  it('текст: без мусора и лишних пустых строк', () => {
    expect(cleanText('  Хорошо\r\n\r\n\r\n\r\nбыстро\u0007  ')).toBe('Хорошо\n\nбыстро')
  })

  it('фото узнаём по байтам, SVG не принимаем', () => {
    expect(imageType(JPEG)).toBe('jpg')
    expect(imageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('png')
    expect(imageType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp')
    expect(imageType(new TextEncoder().encode('<svg onload="alert(1)"></svg>'))).toBeNull()
  })
})

describe('хранилище отзывов', () => {
  let dir = ''

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'reviews-'))
    process.env.REVIEWS_DIR = dir
  })

  afterEach(() => {
    delete process.env.REVIEWS_DIR
    rmSync(dir, { recursive: true, force: true })
  })

  const review = (orderId: string) => ({ orderId, name: 'Азамат А.', rating: 5, text: 'Хорошо', products: ['Холодильник'] })

  it('один заказ — один отзыв', async () => {
    expect(await addReview(review('SC-1'), [])).not.toBe('duplicate')
    expect(await addReview(review('SC-1'), [])).toBe('duplicate')
    expect(await reviewedOrders(['SC-1', 'SC-2'])).toEqual(['SC-1'])
  })

  it('на главной 20 последних, у вытесненных фото стёрты', async () => {
    const first = await addReview(review('SC-first'), [{ bytes: JPEG, ext: 'jpg' }])
    if (first === 'duplicate') throw new Error('не сохранился')
    expect(await readPhoto(first.photos[0])).not.toBeNull()

    for (let i = 0; i < MAX_SHOWN; i += 1) await addReview(review(`SC-${i}`), [])

    const shown = await publishedReviews()
    expect(shown).toHaveLength(MAX_SHOWN)
    expect(shown[0].text).toBe('Хорошо')
    expect(shown.some((r) => r.id === first.id)).toBe(false)
    expect(await readPhoto(first.photos[0])).toBeNull()
    expect(readdirSync(join(dir, 'photos'))).toEqual([])
    // Вытесненный заказ второй раз не отзовётся
    expect(await addReview(review('SC-first'), [])).toBe('duplicate')
  })

  it('скрытый владельцем отзыв пропадает вместе с фото', async () => {
    const saved = await addReview(review('SC-bad'), [{ bytes: JPEG, ext: 'jpg' }])
    if (saved === 'duplicate') throw new Error('не сохранился')
    expect(await hideReview(saved.id)).toBe(true)
    expect(await publishedReviews()).toEqual([])
    expect(await readPhoto(saved.photos[0])).toBeNull()
  })

  it('маленькая копия: хранится, отдаётся, стирается вместе с фото', async () => {
    const small = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 1, 2])
    const saved = await addReview(review('SC-thumb'), [{ bytes: JPEG, ext: 'jpg', thumb: small }, { bytes: JPEG, ext: 'jpg' }])
    if (saved === 'duplicate') throw new Error('не сохранился')
    const [withThumb, withoutThumb] = saved.photos
    expect(thumbOf(withThumb)).toMatch(PHOTO_NAME)
    expect([...(await readPhoto(thumbOf(withThumb)))!.bytes]).toEqual([...small])
    // Копии нет — отдаётся большое фото
    expect([...(await readPhoto(thumbOf(withoutThumb)))!.bytes]).toEqual([...JPEG])
    await hideReview(saved.id)
    expect(readdirSync(join(dir, 'photos'))).toEqual([])
  })

  it('чужой путь вместо имени фото не читается', async () => {
    expect(await readPhoto('../reviews.json')).toBeNull()
    expect(await readPhoto('..%2Freviews.json')).toBeNull()
  })

  it('отзывы, отправленные одновременно, не теряются', async () => {
    await Promise.all(Array.from({ length: 8 }, (_, i) => addReview(review(`SC-p${i}`), [])))
    expect(await publishedReviews()).toHaveLength(8)
  })
})
