import { describe, expect, it } from 'vitest'
import type { Product } from '@/data/products'
import { saleDeck } from '@/lib/hero-sale'

const p = (id: string, price: number, oldPrice: number | undefined, stock = 1, image: string | undefined = `/${id}.jpg`) =>
  ({ id, nameRu: id, nameKy: id, price, oldPrice, image, variants: [{ stock }] }) as unknown as Product

describe('баннер «Скидки» из каталога 1С', () => {
  it('берёт только настоящие скидки с фото и на складе', () => {
    const deck = saleDeck([
      p('ok', 900, 1000),
      p('no-old', 900, undefined),
      p('old-lower', 900, 800),
      p('no-photo', 900, 1000, 1, ''),
      p('no-stock', 900, 1000, 0),
      p('no-price', 0, 1000),
    ])
    expect(deck.map((c) => c.id)).toEqual(['ok'])
  })
  it('самая большая скидка первой, не больше семи', () => {
    const deck = saleDeck(Array.from({ length: 10 }, (_, i) => p(`p${i}`, 1000 - i * 50, 1000 + 0 * i + 100)))
    expect(deck).toHaveLength(7)
    expect(deck[0].id).toBe('p9')
  })
})
