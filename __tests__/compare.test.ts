import { describe, expect, it } from 'vitest'
import { products, type Product } from '@/data/products'
import { cleanCompare, COMPARE_MAX } from '@/lib/compare/CompareProvider'
import { bestOf, compareRows, leadOf, shortNames, type CompareWords } from '@/lib/compare/table'

const words: CompareWords = {
  price: 'Цена',
  installment: 'Рассрочка',
  perMonth: (sum) => `${sum} в месяц`,
  warranty: 'Гарантия',
  warrantyOf: (m) => `${m} мес.`,
  stock: 'Наличие',
  inStock: 'В наличии',
  outOfStock: 'Нет',
  preorder: 'Предзаказ',
  brand: 'Бренд',
}

function item(id: string, price: number, specs: Record<string, string>, extra: Partial<Product> = {}): Product {
  return {
    id,
    brand: 'LG',
    categoryId: 'washers',
    nameRu: id,
    nameKy: id,
    price,
    art: 'washer',
    baseColor: '#fff',
    descRu: '',
    descKy: '',
    specs: Object.entries(specs).map(([labelRu, valueRu]) => ({ labelRu, labelKy: labelRu, valueRu, valueKy: valueRu })),
    warrantyMonths: 36,
    variants: [{ id: 'std', stock: 1 }],
    ...extra,
  } as Product
}

describe('таблица сравнения', () => {
  const a = item('a', 34900, { 'Загрузка для стирки': '8 кг', Цвет: 'Белый', 'Код товара': 'ЦБ-1' })
  const b = item('b', 52000, { 'Максимальная загрузка': '8 кг', Сушка: 'Есть' }, { brand: 'TOSHIBA', warrantyMonths: 0 })
  const rows = compareRows([a, b], 'ru', words)
  const byLabel = (label: string) => rows.find((r) => r.label === label)

  it('сначала цена, рассрочка, гарантия, наличие, бренд; служебные строки 1С не показываем', () => {
    expect(rows.slice(0, 5).map((r) => r.key)).toEqual(['price', 'installment', 'warranty', 'stock', 'brand'])
    expect(rows.some((r) => /код товара/i.test(r.label))).toBe(false)
  })

  it('чего нет — null, рассрочка только в лимите «Адал»', () => {
    // formatSom ставит неразрывный пробел между тысячами
    expect(byLabel('Рассрочка')?.values.map((v) => v?.replace(/\s/g, ' ') ?? null)).toEqual(['8 725 сом в месяц', null])
    expect(byLabel('Гарантия')?.values).toEqual(['36 мес.', null])
    expect(byLabel('Сушка')?.values).toEqual([null, 'Есть'])
  })

  it('синонимы 1С — одна строка, одинаковое не отличие', () => {
    const load = byLabel('Загрузка для стирки')
    expect(load?.values).toEqual(['8 кг', '8 кг'])
    expect(load?.differ).toBe(false)
    expect(byLabel('Максимальная загрузка')).toBeUndefined()
    expect(byLabel('Бренд')?.differ).toBe(true)
  })
})

describe('лучшее значение', () => {
  it('цена и платёж — меньше, гарантия — дольше; равные лучшие — все; одно известное — не отмечаем', () => {
    expect(bestOf([34900, 52000, 24800], true)).toEqual([2])
    expect(bestOf([12, 36, 36], false)).toEqual([1, 2])
    expect(bestOf([36, 36], false)).toEqual([])
    expect(bestOf([8725, null], true)).toEqual([])
    expect(bestOf([0, 12000, 15000], true)).toEqual([1])
  })

  it('разница — до ближайшего другого значения, без лучшего — null', () => {
    expect(leadOf([34900, 52000, 31000], true)).toBe(3900)
    expect(leadOf([12, 36, 36], false)).toBe(24)
    expect(leadOf([36, 36], false)).toBeNull()
    expect(leadOf([8725, null], true)).toBeNull()
  })

  it('в таблице — только цена, рассрочка и гарантия', () => {
    const a = item('a', 34900, { Шум: '52 дБ' }, { warrantyMonths: 12 })
    const b = item('b', 31000, { Шум: '60 дБ' }, { warrantyMonths: 36 })
    const rows = compareRows([a, b], 'ru', words)
    const best = Object.fromEntries(rows.map((r) => [r.key, r.best]))
    expect(best.price).toEqual([1])
    expect(best.installment).toEqual([1])
    expect(best.warranty).toEqual([1])
    expect(rows.filter((r) => r.best.length).map((r) => r.key)).toEqual(['price', 'installment', 'warranty'])
    expect(rows.find((r) => r.key === 'price')?.lead).toBe(3900)
    expect(rows.find((r) => r.key === 'warranty')?.lead).toBe(24)
    expect(rows.find((r) => r.key === 'spec:шум')?.group).toBe('specs')
  })
})

describe('список сравнения', () => {
  it('только существующие товары, без повторов, не больше четырёх', () => {
    const ids = products.slice(0, 6).map((p) => p.id)
    expect(cleanCompare([ids[0], ids[0], 'нет-такого', 5, ...ids.slice(1)])).toEqual(ids.slice(0, COMPARE_MAX))
    expect(cleanCompare('мусор')).toEqual([])
  })
})

describe('короткие названия', () => {
  it('общие слова в начале убираем, целыми словами; не с чем сравнить — как есть', () => {
    expect(shortNames(['Стиральная машина LG F2V3PS6J', 'Стиральная машина MIDEA MFM05'])).toEqual(['LG F2V3PS6J', 'MIDEA MFM05'])
    expect(shortNames(['Холодильник LG', 'Стиральная машина LG'])).toEqual(['Холодильник LG', 'Стиральная машина LG'])
    expect(shortNames(['Телевизор LG', 'Телевизор LG'])).toEqual(['LG', 'LG'])
    expect(shortNames(['Чайник'])).toEqual(['Чайник'])
  })
})
