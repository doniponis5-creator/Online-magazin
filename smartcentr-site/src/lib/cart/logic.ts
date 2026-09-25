/**
 * Pure cart logic — no React, no browser APIs.
 * Money is integer som so totals are exact. Lines reference demo product/variant ids.
 */

export type CartLine = {
  productId: string
  variantId: string
  qty: number
}

export type ProductRef = {
  id: string
  price: number
  variants: { id: string; priceDelta?: number; stock: number }[]
}

export function variantOf(product: ProductRef, variantId: string) {
  return product.variants.find((v) => v.id === variantId)
}

export function unitPrice(product: ProductRef, variantId: string): number | null {
  const variant = variantOf(product, variantId)
  if (!variant) return null
  return product.price + (variant.priceDelta ?? 0)
}

export function clampQty(qty: number, stock: number): number {
  const safeStock = Math.max(0, Math.floor(stock))
  const safeQty = Math.floor(qty)
  if (!Number.isFinite(safeQty) || safeQty < 1) return safeStock >= 1 ? 1 : 0
  return Math.min(safeQty, safeStock)
}

export function addItem(
  lines: CartLine[],
  item: { productId: string; variantId: string; qty?: number },
  products: ProductRef[],
): CartLine[] {
  const product = products.find((p) => p.id === item.productId)
  if (!product) return lines
  const variant = variantOf(product, item.variantId)
  if (!variant || variant.stock < 1) return lines

  const step = Math.max(1, Math.floor(item.qty ?? 1))
  const existing = lines.find(
    (l) => l.productId === item.productId && l.variantId === item.variantId,
  )
  if (!existing) {
    return [...lines, { ...item, qty: clampQty(step, variant.stock) }]
  }
  return lines.map((l) =>
    l === existing ? { ...l, qty: clampQty(l.qty + step, variant.stock) } : l,
  )
}

export function setQty(
  lines: CartLine[],
  key: { productId: string; variantId: string },
  qty: number,
  products: ProductRef[],
): CartLine[] {
  // qty <= 0 — явное намерение убрать строку (минус-кнопка в UI отключена на min=1)
  if (!Number.isFinite(qty) || qty <= 0) {
    return removeLine(lines, key)
  }
  const product = products.find((p) => p.id === key.productId)
  if (!product) return lines
  const variant = variantOf(product, key.variantId)
  if (!variant) return lines

  const next = clampQty(qty, variant.stock)
  if (next < 1) {
    // stock became 0 — drop the line instead of keeping qty 0
    return removeLine(lines, key)
  }
  return lines.map((l) =>
    l.productId === key.productId && l.variantId === key.variantId ? { ...l, qty: next } : l,
  )
}

export function removeLine(lines: CartLine[], key: { productId: string; variantId: string }): CartLine[] {
  return lines.filter(
    (l) => !(l.productId === key.productId && l.variantId === key.variantId),
  )
}

export function cartTotals(
  lines: CartLine[],
  products: ProductRef[],
): { itemsCount: number; subtotal: number } {
  let itemsCount = 0
  let subtotal = 0
  for (const line of lines) {
    const product = products.find((p) => p.id === line.productId)
    if (!product) continue
    const price = unitPrice(product, line.variantId)
    if (price === null) continue
    itemsCount += line.qty
    subtotal += price * line.qty
  }
  return { itemsCount, subtotal }
}

export function lineKey(line: { productId: string; variantId: string }): string {
  return `${line.productId}:${line.variantId}`
}

/**
 * Клиентская защита (демо): восстановленные из localStorage данные приводим
 * к валидному виду — известный товар/вариант, целое qty > 0, предел демо-остатка,
 * слияние повторяющихся SKU, отбрасывание мусора. Реальный сервер обязан
 * пересчитать цену/остаток/резерв независимо.
 */
export function normalizeLines(
  raw: unknown,
  products: ProductRef[],
): { lines: CartLine[]; changed: boolean } {
  let changed = false
  if (!Array.isArray(raw)) {
    return { lines: [], changed: raw !== undefined && raw !== null }
  }
  const merged = new Map<string, CartLine>()
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) {
      changed = true
      continue
    }
    const { productId, variantId, qty } = entry as Record<string, unknown>
    if (typeof productId !== 'string' || typeof variantId !== 'string') {
      changed = true
      continue
    }
    const product = products.find((p) => p.id === productId)
    const variant = product?.variants.find((v) => v.id === variantId)
    if (!product || !variant) {
      changed = true
      continue
    }
    if (typeof qty !== 'number' || !Number.isFinite(qty) || !Number.isInteger(qty) || qty < 1) {
      changed = true
      continue
    }
    const key = lineKey({ productId, variantId })
    const prev = merged.get(key)
    if (prev) {
      changed = true // повторяющийся SKU — объединяем
      prev.qty += qty
    } else {
      merged.set(key, { productId, variantId, qty })
    }
  }
  const lines: CartLine[] = []
  for (const line of merged.values()) {
    const product = products.find((p) => p.id === line.productId)!
    const variant = variantOf(product, line.variantId)!
    const clamped = clampQty(line.qty, variant.stock)
    if (clamped !== line.qty) changed = true
    if (clamped >= 1) lines.push({ ...line, qty: clamped })
  }
  return { lines, changed }
}
