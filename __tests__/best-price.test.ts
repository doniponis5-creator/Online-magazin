import { describe, expect, it } from 'vitest'
import { BEST_PRICE, bestPriceProducts, inBestPrice, isBestPrice } from '@/data/best-price'
import type { Product } from '@/data/products'

const item = (id: string, price: number, extra: Partial<Product> = {}): Product =>
  ({ id, price, variants: [{ id: `${id}-v`, stock: 3 }], ...extra }) as unknown as Product

describe('«Лучшая цена» (09.10)', () => {
  const tv = BEST_PRICE[0]

  it('метка — только пока мы не дороже других магазинов', () => {
    expect(isBestPrice({ id: tv.id, price: tv.beat - 1 })).toBe(true)
    expect(isBestPrice({ id: tv.id, price: tv.beat })).toBe(true)
    // подняли цену в 1С — метка сама пропала, сайт не обещает неправды
    expect(isBestPrice({ id: tv.id, price: tv.beat + 1 })).toBe(false)
    expect(isBestPrice({ id: tv.id, price: 0 })).toBe(false)
    expect(isBestPrice({ id: 'нет-в-списке', price: 1 })).toBe(false)
  })

  it('раздел: сначала список в его порядке, потом скидки; без остатка — нет', () => {
    const [a, b] = BEST_PRICE
    const list = [
      item('sale-1', 900, { oldPrice: 1000 }),
      item(b.id, b.beat),
      item(a.id, a.beat),
      item('plain', 500),
      item('sale-gone', 900, { oldPrice: 1000, variants: [{ id: 'x', stock: 0 }] } as Partial<Product>),
      item(BEST_PRICE[2].id, BEST_PRICE[2].beat + 100),
    ]
    expect(bestPriceProducts(list).map((p) => p.id)).toEqual([a.id, b.id, 'sale-1'])
    expect(inBestPrice(list[0])).toBe(true)
    expect(inBestPrice(list[3])).toBe(false)
    expect(inBestPrice(list[5])).toBe(false)
  })

  it('в списке нет повторов', () => {
    expect(new Set(BEST_PRICE.map((x) => x.id)).size).toBe(BEST_PRICE.length)
  })
})
