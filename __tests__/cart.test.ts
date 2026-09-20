import { describe, expect, it } from 'vitest'
import {
  addItem,
  cartTotals,
  clampQty,
  normalizeLines,
  removeLine,
  setQty,
  unitPrice,
  type ProductRef,
} from '@/lib/cart/logic'
import { productFromOneC } from '@/data/1c/adapter'

const phone: ProductRef = {
  id: 'phone',
  price: 10000,
  variants: [
    { id: 'blue', stock: 5 },
    { id: 'ink', stock: 0 },
  ],
}

const laptop: ProductRef = {
  id: 'laptop',
  price: 50000,
  variants: [{ id: '16-512', stock: 2, priceDelta: 5000 }],
}

const catalog = [phone, laptop]

describe('unitPrice', () => {
  it('adds variant priceDelta to base price', () => {
    expect(unitPrice(laptop, '16-512')).toBe(55000)
  })

  it('returns null for unknown variant', () => {
    expect(unitPrice(phone, 'red')).toBeNull()
  })
})

describe('clampQty', () => {
  it('clamps to available stock', () => {
    expect(clampQty(99, 5)).toBe(5)
  })

  it('rejects zero, negative, fractional and NaN quantities', () => {
    expect(clampQty(0, 5)).toBe(1)
    expect(clampQty(-3, 5)).toBe(1)
    expect(clampQty(2.7, 5)).toBe(2)
    expect(clampQty(Number.NaN, 5)).toBe(1)
  })

  it('returns 0 when stock is 0', () => {
    expect(clampQty(1, 0)).toBe(0)
    expect(clampQty(0, 0)).toBe(0)
  })
})

describe('addItem', () => {
  it('adds a new line with clamped quantity', () => {
    const lines = addItem([], { productId: 'phone', variantId: 'blue', qty: 2 }, catalog)
    expect(lines).toEqual([{ productId: 'phone', variantId: 'blue', qty: 2 }])
  })

  it('merges same product+variant lines and respects stock', () => {
    let lines = addItem([], { productId: 'phone', variantId: 'blue', qty: 3 }, catalog)
    lines = addItem(lines, { productId: 'phone', variantId: 'blue', qty: 3 }, catalog)
    expect(lines).toHaveLength(1)
    expect(lines[0].qty).toBe(5) // 3 + 3 clamped to stock 5
  })

  it('ignores out-of-stock variants', () => {
    const lines = addItem([], { productId: 'phone', variantId: 'ink' }, catalog)
    expect(lines).toEqual([])
  })

  it('keeps separate lines for separate variants', () => {
    let lines = addItem([], { productId: 'phone', variantId: 'blue' }, catalog)
    lines = addItem(lines, { productId: 'laptop', variantId: '16-512' }, catalog)
    expect(lines).toHaveLength(2)
  })
})

describe('setQty', () => {
  it('updates quantity within stock bounds', () => {
    let lines = addItem([], { productId: 'phone', variantId: 'blue', qty: 1 }, catalog)
    lines = setQty(lines, { productId: 'phone', variantId: 'blue' }, 4, catalog)
    expect(lines[0].qty).toBe(4)
    lines = setQty(lines, { productId: 'phone', variantId: 'blue' }, 50, catalog)
    expect(lines[0].qty).toBe(5)
  })

  it('removes the line when quantity drops below 1', () => {
    let lines = addItem([], { productId: 'phone', variantId: 'blue', qty: 2 }, catalog)
    lines = setQty(lines, { productId: 'phone', variantId: 'blue' }, 0, catalog)
    expect(lines).toEqual([])
  })
})

describe('cartTotals', () => {
  it('sums prices across products and variants exactly (integer som)', () => {
    let lines = addItem([], { productId: 'phone', variantId: 'blue', qty: 2 }, catalog) // 2×10000
    lines = addItem(lines, { productId: 'laptop', variantId: '16-512', qty: 1 }, catalog) // 1×55000
    const { itemsCount, subtotal } = cartTotals(lines, catalog)
    expect(itemsCount).toBe(3)
    expect(subtotal).toBe(75000)
  })

  it('skips lines referencing unknown catalog entries', () => {
    const lines = [
      { productId: 'ghost', variantId: 'x', qty: 2 },
      { productId: 'phone', variantId: 'blue', qty: 1 },
    ]
    const { itemsCount, subtotal } = cartTotals(lines, catalog)
    expect(itemsCount).toBe(1)
    expect(subtotal).toBe(10000)
  })

  it('returns zero for empty cart', () => {
    expect(cartTotals([], catalog)).toEqual({ itemsCount: 0, subtotal: 0 })
  })
})

describe('removeLine', () => {
  it('removes only the matching product+variant line', () => {
    let lines = addItem([], { productId: 'phone', variantId: 'blue', qty: 1 }, catalog)
    lines = addItem(lines, { productId: 'laptop', variantId: '16-512', qty: 1 }, catalog)
    lines = removeLine(lines, { productId: 'phone', variantId: 'blue' })
    expect(lines).toEqual([{ productId: 'laptop', variantId: '16-512', qty: 1 }])
  })
})

describe('normalizeLines — восстановление корзины из localStorage', () => {
  it('drops unknown product/variant ids', () => {
    const { lines, changed } = normalizeLines(
      [
        { productId: 'ghost', variantId: 'x', qty: 2 },
        { productId: 'phone', variantId: 'nope', qty: 1 },
        { productId: 'phone', variantId: 'blue', qty: 2 },
      ],
      catalog,
    )
    expect(lines).toEqual([{ productId: 'phone', variantId: 'blue', qty: 2 }])
    expect(changed).toBe(true)
  })

  it('rejects negative, fractional and non-numeric quantities', () => {
    const { lines, changed } = normalizeLines(
      [
        { productId: 'phone', variantId: 'blue', qty: -2 },
        { productId: 'phone', variantId: 'blue', qty: 1.5 },
        { productId: 'phone', variantId: 'blue', qty: '3' },
        { productId: 'phone', variantId: 'blue', qty: Number.NaN },
        { productId: 'phone', variantId: 'blue', qty: 1 },
      ],
      catalog,
    )
    expect(lines).toEqual([{ productId: 'phone', variantId: 'blue', qty: 1 }])
    expect(changed).toBe(true)
  })

  it('merges duplicate SKU rows before clamping to stock', () => {
    const { lines, changed } = normalizeLines(
      [
        { productId: 'phone', variantId: 'blue', qty: 3 },
        { productId: 'phone', variantId: 'blue', qty: 4 },
      ],
      catalog,
    )
    expect(lines).toEqual([{ productId: 'phone', variantId: 'blue', qty: 5 }]) // stock 5
    expect(changed).toBe(true)
  })

  it('clamps quantities to available demo stock', () => {
    const { lines } = normalizeLines([{ productId: 'laptop', variantId: '16-512', qty: 99 }], catalog)
    expect(lines).toEqual([{ productId: 'laptop', variantId: '16-512', qty: 2 }])
  })

  it('drops lines whose stock became 0 and reports the change', () => {
    const { lines, changed } = normalizeLines([{ productId: 'phone', variantId: 'ink', qty: 1 }], catalog)
    expect(lines).toEqual([])
    expect(changed).toBe(true)
  })

  it('survives corrupted JSON payload (null/garbage)', () => {
    expect(normalizeLines(null, catalog)).toEqual({ lines: [], changed: false })
    expect(normalizeLines(undefined, catalog)).toEqual({ lines: [], changed: false })
    expect(normalizeLines('garbage', catalog).changed).toBe(true)
    expect(normalizeLines([{ broken: true }], catalog).changed).toBe(true)
    const clean = normalizeLines([42, 'x', null, { productId: 'phone', variantId: 'blue', qty: 2 }], catalog)
    expect(clean.lines).toEqual([{ productId: 'phone', variantId: 'blue', qty: 2 }])
    expect(clean.changed).toBe(true)
  })

  it('keeps a valid cart untouched', () => {
    const source = [{ productId: 'phone', variantId: 'blue', qty: 2 }]
    const { lines, changed } = normalizeLines(source, catalog)
    expect(lines).toEqual(source)
    expect(changed).toBe(false)
  })

  it('totals of a normalized cart are never negative or NaN', () => {
    const { lines } = normalizeLines(
      [
        { productId: 'phone', variantId: 'blue', qty: -5 },
        { productId: 'laptop', variantId: '16-512', qty: 1.5 },
      ],
      catalog,
    )
    const { subtotal, itemsCount } = cartTotals(lines, catalog)
    expect(Number.isFinite(subtotal)).toBe(true)
    expect(subtotal).toBeGreaterThanOrEqual(0)
    expect(itemsCount).toBeGreaterThanOrEqual(0)
  })
})

/**
 * Остаток из 1С: «В наличии» — товар продаётся всегда, даже когда в базе ноль.
 * Раньше такой товар получал остаток 1, и вторую штуку положить было нельзя.
 */
describe('остаток из 1С', () => {
  const item = (availability: string, stock: number) =>
    productFromOneC({ id: 'g1', code: 'C1', name: 'Тест', stock, availability, price: 100 })
      .variants[0].stock

  it('«В наличии» не ограничивает корзину остатком базы', () => {
    expect(item('В наличии', 0)).toBeGreaterThanOrEqual(99)
    expect(item('В наличии', 1)).toBeGreaterThanOrEqual(99)
  })

  it('«Нет в наличии» — ноль, «По остатку» — остаток базы', () => {
    expect(item('Нет в наличии', 7)).toBe(0)
    expect(item('По остатку', 3)).toBe(3)
  })
})
