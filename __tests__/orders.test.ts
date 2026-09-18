import { describe, expect, it } from 'vitest'
import { demoProducts, type Product } from '@/data/products'
import { normalizePhone, validateOrder, type OrderRequest } from '@/lib/orders/order'

const withDelivery = (p: Product, deliveryPrice: number): Product => ({ ...p, deliveryPrice })
const catalog = new Map<string, Product>(
  demoProducts.map((p) => [p.id, p.id === 'smartview-55' ? withDelivery(p, 500) : p.id === 'aerochef-5' ? withDelivery(p, 200) : p]),
)
const find = (id: string) => catalog.get(id)

const base: OrderRequest = {
  customer: { name: 'Азизов Азиз', phone: '0700 123 456' },
  delivery: { method: 'pickup' },
  lines: [{ productId: 'smartview-55', variantId: 'std', qty: 1 }],
}

describe('normalizePhone — кыргызские и российские номера', () => {
  it('приводит разные записи к +996XXXXXXXXX', () => {
    expect(normalizePhone('0700 123 456')).toBe('+996700123456')
    expect(normalizePhone('+996 (700) 12-34-56')).toBe('+996700123456')
    expect(normalizePhone('996700123456')).toBe('+996700123456')
  })
  // Сотня действующих клиентов SBonus записана с российскими номерами
  it('приводит российские записи к +7XXXXXXXXXX', () => {
    expect(normalizePhone('+7 900 123 45 67')).toBe('+79001234567')
    expect(normalizePhone('8 (900) 123-45-67')).toBe('+79001234567')
    expect(normalizePhone('79001234567')).toBe('+79001234567')
  })
  it('отклоняет короткие, длинные и чужие номера', () => {
    expect(normalizePhone('12345')).toBeNull()
    expect(normalizePhone('+996 700 12-34-5')).toBeNull()
    expect(normalizePhone('+7 900 123 45')).toBeNull()
    expect(normalizePhone('+44 20 7946 0958')).toBeNull()
  })
})

describe('validateOrder — сумма считается по каталогу, а не из браузера', () => {
  it('самовывоз: доставка 0, итог = товары', () => {
    const result = validateOrder(base, find)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.order.goodsTotal).toBe(42300)
    expect(result.order.delivery.price).toBe(0)
    expect(result.order.total).toBe(42300)
    expect(result.order.customer.phone).toBe('+996700123456')
  })

  it('доставка: берётся самая дорогая доставка среди товаров', () => {
    const result = validateOrder(
      {
        ...base,
        delivery: { method: 'delivery', city: 'Бишкек', address: 'ул. Киевская 1' },
        lines: [
          { productId: 'smartview-55', variantId: 'std', qty: 1 },
          { productId: 'aerochef-5', variantId: 'white', qty: 2 },
        ],
      },
      find,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.order.delivery.price).toBe(500)
    expect(result.order.total).toBe(42300 + 7400 * 2 + 500)
  })

  it('доставка без адреса — ошибка полей', () => {
    const result = validateOrder({ ...base, delivery: { method: 'delivery' } }, find)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toEqual(expect.arrayContaining(['city', 'address']))
  })

  it('больше, чем на складе, — отказ', () => {
    const result = validateOrder({ ...base, lines: [{ productId: 'smartview-55', variantId: 'std', qty: 50 }] }, find)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toContain('out-of-stock')
  })

  it('неизвестный товар и пустая корзина — отказ', () => {
    const missing = validateOrder({ ...base, lines: [{ productId: 'nope', variantId: 'std', qty: 1 }] }, find)
    expect(missing.ok).toBe(false)
    const empty = validateOrder({ ...base, lines: [] }, find)
    expect(empty.ok).toBe(false)
    if (!empty.ok) expect(empty.errors).toContain('cart-empty')
  })

  it('товар без цены (цена по запросу) не продаётся', () => {
    const free = new Map(catalog)
    free.set('smartview-55', { ...catalog.get('smartview-55')!, price: 0 })
    const result = validateOrder(base, (id) => free.get(id))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toContain('price-missing')
  })
})
