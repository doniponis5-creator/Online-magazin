import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { asHeroSetting, HERO_FALLBACK, HERO_SETTINGS, HERO_VARIANTS, HERO_WEEK, heroForDay, resolveHero } from '@/lib/hero'

describe('анимация баннера из 1С', () => {
  it('знакомый вариант проходит как есть', () => {
    for (const v of HERO_VARIANTS) expect(resolveHero(v)).toBe(v)
  })
  it('пусто, мусор или старый сервер — «Скидки»', () => {
    expect(HERO_FALLBACK).toBe('sale')
    for (const v of [undefined, null, '', 'glow', 'Жалюзи', 'REVEAL', 1]) expect(asHeroSetting(v)).toBe('sale')
  })
  it('семь дней — семь разных знакомых вариантов', () => {
    expect(HERO_WEEK).toHaveLength(7)
    expect(new Set(HERO_WEEK).size).toBe(7)
    for (const v of HERO_WEEK) expect(HERO_VARIANTS).toContain(v)
  })
  it('день считается по Бишкеку, а не по времени сервера', () => {
    // 01.10.2026 — четверг. В 20:00 UTC в Бишкеке (UTC+6) уже пятница, 02:00.
    expect(heroForDay(new Date('2026-10-01T12:00:00Z'))).toBe(HERO_WEEK[3])
    expect(heroForDay(new Date('2026-10-01T20:00:00Z'))).toBe(HERO_WEEK[4])
    // 04.10.2026 — воскресенье
    expect(resolveHero('auto', new Date('2026-10-04T08:00:00Z'))).toBe(HERO_WEEK[6])
  })
  it('коды сервера совпадают с сайтом', () => {
    const py = readFileSync('integrations/sbonus-server/shop/shop_admin.py', 'utf8')
    const m = /"key": "SITE_HERO_VARIANT"[\s\S]*?"choices": \[([^\]]*)\][\s\S]*?"default": "(\w+)"/.exec(py)
    expect(m).not.toBeNull()
    expect(m![1].split(',').map((s) => s.trim().replace(/"/g, ''))).toEqual([...HERO_SETTINGS])
    expect(m![2]).toBe(HERO_FALLBACK)
  })
})
