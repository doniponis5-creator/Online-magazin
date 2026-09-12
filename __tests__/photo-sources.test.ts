import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { photoSources } from '@/data/photo-sources'

/**
 * TASK 03A REVIEW FIXES + brief LG: активных фотографий в витрине нет —
 * hero построен как авторская CSS-сцена, товары занимает плейсхолдер.
 * Все прежние снимки (включая баннерные) — архив; файлы сохранены.
 */
describe('photo sources contract (owner decision 12.09, LG brief)', () => {
  it('no active photo sources — hero is author CSS scene', () => {
    expect(photoSources.filter((s) => s.inUse)).toHaveLength(0)
  })

  it('archive keeps all previous materials on disk', () => {
    const archived = photoSources.filter((s) => !s.inUse)
    expect(archived.length).toBeGreaterThanOrEqual(14)
    for (const s of archived) {
      expect(existsSync(join(process.cwd(), s.file)), `файл ${s.file} не найден`).toBe(true)
    }
  })

  it('each record carries a verification method and source page', () => {
    for (const s of photoSources) {
      expect(['page', 'page+mirrors']).toContain(s.verify)
      expect(s.pexelsId).toBeGreaterThan(0)
      expect(s.page).toMatch(/^https:\/\/www\.pexels\.com\/photo\//)
    }
  })

  it('archived entries are clearly marked in their role text', () => {
    for (const s of photoSources.filter((x) => !x.inUse)) {
      expect(s.roleRu, s.file).toMatch(/^Архив:/)
      expect(s.roleKy, s.file).toMatch(/^Архив:/)
    }
  })
})
