import { describe, expect, it } from 'vitest'
import type { Product } from '@/data/products'
import { metaFeedCsv } from '@/lib/feed/meta'

const base = {
  id: 'x1',
  brand: 'ARTEL',
  categoryId: 'washers',
  nameRu: 'Стиральная машина ARTEL, 7 кг "Люкс"',
  nameKy: '',
  price: 20000,
  art: 'phone',
  image: 'https://api.smartcentr.store/p/1.jpg',
  images: ['https://api.smartcentr.store/p/1.jpg', '/products/2.jpg'],
  baseColor: '#fff',
  descRu: '',
  descKy: '',
  specs: [],
  warrantyMonths: 12,
  variants: [{ stock: 2 }],
} as unknown as Product

describe('metaFeedCsv', () => {
  it('товар с ценой, фото и страницей попадает в файл', () => {
    const csv = metaFeedCsv([base], 'https://smarket.kg', new Set(['x1']))
    const [head, row] = csv.trim().split('\n')
    expect(head.startsWith('id,title,description,availability')).toBe(true)
    expect(row).toContain('"Стиральная машина ARTEL, 7 кг ""Люкс"""')
    expect(row).toContain('in stock,new,20000 KGS,,https://smarket.kg/ru/product/x1')
    expect(row).toContain('https://smarket.kg/products/2.jpg')
  })
  it('скидка: price — прежняя, sale_price — сегодняшняя', () => {
    const csv = metaFeedCsv([{ ...base, oldPrice: 25000 }], 'https://smarket.kg', new Set(['x1']))
    expect(csv).toContain('25000 KGS,20000 KGS')
  })
  it('без цены, без фото, без страницы и «только для чата» — не попадают', () => {
    const list = [
      { ...base, id: 'a', price: 0 },
      { ...base, id: 'b', image: undefined },
      { ...base, id: 'c' },
      { ...base, id: 'd', chatOnly: true },
    ] as Product[]
    const csv = metaFeedCsv(list, 'https://smarket.kg', new Set(['a', 'b', 'd']))
    expect(csv.trim().split('\n')).toHaveLength(1)
  })
})
