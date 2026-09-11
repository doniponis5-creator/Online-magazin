import { describe, expect, it } from 'vitest'
import { buildCatalogHref, buildLangHref } from '@/lib/links'

describe('buildLangHref — переключение языка без смены хоста', () => {
  it('never produces protocol-relative // links', () => {
    expect(buildLangHref('/ru', '', 'ky')).toBe('/ky')
    expect(buildLangHref('/ru/cart', '', 'ky')).toBe('/ky/cart')
    expect(buildLangHref('/ky/product/aura-x5', '', 'ru')).toBe('/ru/product/aura-x5')
    for (const href of [
      buildLangHref('/ru', '', 'ky'),
      buildLangHref('/ru/catalog?cat=laptops', '?cat=laptops', 'ky'),
    ]) {
      expect(href.startsWith('//')).toBe(false)
    }
  })

  it('preserves query string (filters/search) across language switch', () => {
    expect(buildLangHref('/ru/catalog', '?q=Aura&cat=smartphones', 'ky')).toBe(
      '/ky/catalog?q=Aura&cat=smartphones',
    )
  })

  it('keeps trailing deep paths intact in both directions', () => {
    expect(buildLangHref('/ky/checkout', '', 'ru')).toBe('/ru/checkout')
    expect(buildLangHref('/ru/product/tabslate-10', '', 'ky')).toBe('/ky/product/tabslate-10')
  })

  it('handles root pathname', () => {
    expect(buildLangHref('/', '', 'ru')).toBe('/ru')
  })
})

describe('buildCatalogHref — URL как источник состояния каталога', () => {
  it('omits default values', () => {
    expect(buildCatalogHref('ru', {})).toBe('/ru/catalog')
    expect(buildCatalogHref('ru', { cat: 'all', brand: 'all', sort: 'popular', q: '  ' })).toBe(
      '/ru/catalog',
    )
  })

  it('writes meaningful filters into the URL', () => {
    expect(buildCatalogHref('ky', { q: 'Aura', cat: 'smartphones', sort: 'price-asc' })).toBe(
      '/ky/catalog?q=Aura&cat=smartphones&sort=price-asc',
    )
  })

  it('supports the search → category → back/forward transitions via plain string state', () => {
    // цепочка: поиск Aura → поиск AirSound → категория ноутбуков → назад
    const step1 = buildCatalogHref('ru', { q: 'Aura' })
    const step2 = buildCatalogHref('ru', { q: 'AirSound' })
    const step3 = buildCatalogHref('ru', { cat: 'laptops' })
    expect([step1, step2, step3]).toEqual([
      '/ru/catalog?q=Aura',
      '/ru/catalog?q=AirSound',
      '/ru/catalog?cat=laptops',
    ])
  })
})
