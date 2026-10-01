import { describe, expect, it } from 'vitest'
import { asHeroVariant, HERO_FALLBACK, HERO_VARIANTS } from '@/lib/hero'

describe('анимация баннера из 1С', () => {
  it('знакомый код проходит как есть', () => {
    for (const v of HERO_VARIANTS) expect(asHeroVariant(v)).toBe(v)
  })
  it('пусто, мусор или старый сервер — прежняя сцена', () => {
    expect(HERO_FALLBACK).toBe('classic')
    for (const v of [undefined, null, '', 'Утро → вечер', 'REVEAL', 1]) expect(asHeroVariant(v)).toBe('classic')
  })
  it('коды сервера совпадают с сайтом', async () => {
    const { readFileSync } = await import('node:fs')
    const py = readFileSync('integrations/sbonus-server/shop/shop_admin.py', 'utf8')
    const m = /"key": "SITE_HERO_VARIANT"[\s\S]*?"choices": \[([^\]]*)\][\s\S]*?"default": "(\w+)"/.exec(py)
    expect(m).not.toBeNull()
    expect(m![1].split(',').map((s) => s.trim().replace(/"/g, ''))).toEqual([...HERO_VARIANTS])
    expect(m![2]).toBe(HERO_FALLBACK)
  })
})
