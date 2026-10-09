import { describe, expect, it } from 'vitest'
import { bestPriceProducts, inBestPrice, isBestPrice } from '@/data/best-price'
import { productsFromOneC, type OneCCatalog } from '@/data/1c/adapter'
import type { Product } from '@/data/products'

const item = (id: string, price: number, extra: Partial<Product> = {}): Product =>
  ({ id, price, variants: [{ id: `${id}-v`, stock: 3 }], ...extra }) as unknown as Product

describe('«Лучшая цена» — галочка из 1С (09.10)', () => {
  it('метка — только с галочкой и ценой', () => {
    expect(isBestPrice({ bestPrice: true, price: 9_890 })).toBe(true)
    expect(isBestPrice({ bestPrice: true, price: 0 })).toBe(false)
    expect(isBestPrice({ bestPrice: undefined, price: 9_890 })).toBe(false)
  })

  it('раздел: сначала отмеченные (дорогие вперёд), потом скидки; без остатка — нет', () => {
    const list = [
      item('sale-1', 900, { oldPrice: 1000 }),
      item('kettle', 1_900, { bestPrice: true }),
      item('tv', 72_000, { bestPrice: true }),
      item('plain', 500),
      item('sale-gone', 900, { oldPrice: 1000, variants: [{ id: 'x', stock: 0 }] } as Partial<Product>),
      item('best-gone', 5_000, { bestPrice: true, variants: [{ id: 'y', stock: 0 }] } as Partial<Product>),
    ]
    expect(bestPriceProducts(list).map((p) => p.id)).toEqual(['tv', 'kettle', 'sale-1'])
    expect(inBestPrice(list[0])).toBe(true)
    expect(inBestPrice(list[3])).toBe(false)
    expect(inBestPrice(list[5])).toBe(false)
  })

  it('поле bestPrice каталога 1С доходит до товара', () => {
    const base = { id: 'u1', code: 'ЦБ-1', name: 'Пылесос LG VK69662N', group: 'Пылесосы', stock: 2, price: 6_990, availability: 'По остатку' }
    const catalog = { items: [{ ...base, bestPrice: true }, { ...base, id: 'u2', code: 'ЦБ-2' }] } as unknown as OneCCatalog
    const [a, b] = productsFromOneC(catalog)
    expect(a.bestPrice).toBe(true)
    expect(b.bestPrice).toBeUndefined()
  })
})
