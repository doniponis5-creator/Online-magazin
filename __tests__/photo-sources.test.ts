import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { heroPhoto, productPhotos } from '@/data/photos'
import { photoSources } from '@/data/photo-sources'

/**
 * TASK 03A: единый достоверный список источников. Ошибка ревью — кредиты
 * в photos.ts противоречили странице источника (AbdFams ↔ Zaidan Falaah,
 * Flickr ↔ StockSnap). Тест держит photos.ts и photo-sources.ts в согласии.
 */
describe('photo sources consistency', () => {
  it('every used photo file has exactly one source record (and vice versa)', () => {
    const used = new Set<string>([
      heroPhoto.src,
      ...Object.values(productPhotos).map((p) => p.src),
    ])
    const recorded = new Set(photoSources.map((s) => `/photos/${s.file}`))

    for (const src of used) {
      expect(recorded.has(src), `${src} отсутствует в photo-sources.ts`).toBe(true)
    }
    for (const src of recorded) {
      expect(used.has(src), `${src} записан, но не используется на витрине`).toBe(true)
    }
  })

  it('credit in photos.ts equals the verified author from photo-sources.ts', () => {
    const byFile = new Map(photoSources.map((s) => [s.file, s]))
    const photos = [heroPhoto, ...Object.values(productPhotos)]
    for (const p of photos) {
      const file = p.src.replace('/photos/', '')
      const author = byFile.get(file)!.author
      expect(p.credit, `credit для ${file}`).toBe(`${author} / Pexels`)
    }
  })

  it('every source file exists locally in public/photos', () => {
    for (const s of photoSources) {
      const path = join(process.cwd(), 'public', 'photos', s.file)
      expect(existsSync(path), `файл ${s.file} не найден`).toBe(true)
    }
  })
})
