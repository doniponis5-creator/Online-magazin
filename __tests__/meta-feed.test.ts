import { describe, expect, it } from 'vitest'
import type { Product } from '@/data/products'
import { productFromOneC } from '@/data/1c/adapter'
import { feedDescription, metaFeedCsv } from '@/lib/feed/meta'

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
  it('предзаказ — preorder', () => {
    const csv = metaFeedCsv([{ ...base, preorder: true, variants: [{ id: 'std', stock: 99 }] }], 'https://smarket.kg', new Set(['x1']))
    expect(csv).toContain('preorder,new,20000 KGS')
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

describe('описание и бренд для рекламы (06.10)', () => {
  it('нет описания в 1С — собираем из характеристик, служебные строки не берём', () => {
    const p = {
      ...base,
      nameRu: 'Вытяжка MIDEA MH-60T349B',
      specs: [
        { labelRu: 'Бренд', labelKy: '', valueRu: 'MIDEA', valueKy: '' },
        { labelRu: 'Ширина', labelKy: '', valueRu: '60 см', valueKy: '' },
        { labelRu: 'Код товара', labelKy: '', valueRu: 'ЦБ-1', valueKy: '' },
      ],
    } as Product
    expect(feedDescription(p)).toBe('Вытяжка MIDEA MH-60T349B. Ширина: 60 см.')
    expect(feedDescription({ ...p, descRu: 'Своё описание' })).toBe('Своё описание')
    expect(feedDescription({ ...p, specs: [] })).toBe('Вытяжка MIDEA MH-60T349B')
  })

  it('бренд: «Марка» 1С → строка «Бренд» характеристик → слово из названия', () => {
    const item = { id: 'g', code: 'C1', price: 100, stock: 1 }
    expect(productFromOneC({ ...item, name: 'Швейная Машина JASS JS-H1' }).brand).toBe('JASS')
    expect(productFromOneC({ ...item, name: 'Стиральная машина TOSHIBA TW-BN90C4 8 кг' }).brand).toBe('TOSHIBA')
    expect(productFromOneC({ ...item, name: 'Швейная Машина', specs: [{ label: 'Бренд', value: 'Janome' }] }).brand).toBe('JANOME')
    expect(productFromOneC({ ...item, name: 'Комод Колорит 5 секция' }).brand).toBe('')
  })
})
