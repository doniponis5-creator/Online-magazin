/**
 * Заказ с сайта: проверка корзины и расчёт суммы.
 *
 * Сумма всегда считается на сервере сайта по каталогу (цены из 1С), а не берётся
 * из браузера — иначе покупатель мог бы подменить цену перед оплатой.
 * Доставка: у каждого товара в 1С своя стоимость доставки (0 = бесплатно).
 * Для заказа берётся самая дорогая доставка среди товаров — машина одна.
 */

import type { Product } from '@/data/products'

export type DeliveryMethod = 'pickup' | 'delivery'

export type OrderRequest = {
  customer: { name: string; phone: string }
  delivery: { method: DeliveryMethod; city?: string; address?: string }
  comment?: string
  lines: { productId: string; variantId: string; qty: number }[]
  lang?: 'ru' | 'ky'
}

export type OrderLine = {
  productId: string
  /** ссылка на товар в 1С (GUID), по ней 1С найдёт номенклатуру */
  oneCId: string
  code: string
  name: string
  price: number
  qty: number
  sum: number
}

export type ValidatedOrder = {
  customer: { name: string; phone: string }
  delivery: { method: DeliveryMethod; city: string; address: string; price: number }
  comment: string
  lines: OrderLine[]
  goodsTotal: number
  total: number
  lang: 'ru' | 'ky'
}

export type OrderError =
  | 'name'
  | 'phone'
  | 'city'
  | 'address'
  | 'cart-empty'
  | 'product-missing'
  | 'price-missing'
  | 'out-of-stock'

const MAX_QTY = 99

/** +996 XXX XXX XXX → +996XXXXXXXXX; null, если номер не кыргызский мобильный/городской. */
export function normalizePhone(value: string): string | null {
  const digits = value.replace(/[^\d+]/g, '')
  const local = digits.startsWith('+996') ? digits.slice(4) : digits.startsWith('996') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : null
  if (!local || !/^\d{9}$/.test(local)) return null
  return `+996${local}`
}

/** Стоимость доставки заказа: самая дорогая доставка среди товаров. */
export function deliveryPriceFor(products: Product[], method: DeliveryMethod): number {
  if (method !== 'delivery') return 0
  return products.reduce((max, p) => Math.max(max, p.deliveryPrice ?? 0), 0)
}

export function validateOrder(
  request: OrderRequest,
  findProduct: (id: string) => Product | undefined,
): { ok: true; order: ValidatedOrder } | { ok: false; errors: OrderError[]; details?: string[] } {
  const errors: OrderError[] = []
  const details: string[] = []

  const name = (request.customer?.name ?? '').replace(/\s+/g, ' ').trim()
  if (name.length < 2 || name.length > 120) errors.push('name')
  const phone = normalizePhone(request.customer?.phone ?? '')
  if (!phone) errors.push('phone')

  const method: DeliveryMethod = request.delivery?.method === 'delivery' ? 'delivery' : 'pickup'
  const city = (request.delivery?.city ?? '').trim().slice(0, 80)
  const address = (request.delivery?.address ?? '').trim().slice(0, 300)
  if (method === 'delivery' && city.length < 2) errors.push('city')
  if (method === 'delivery' && address.length < 4) errors.push('address')

  const lines: OrderLine[] = []
  const products: Product[] = []
  const merged = new Map<string, { productId: string; variantId: string; qty: number }>()
  for (const line of request.lines ?? []) {
    const qty = Math.floor(Number(line.qty))
    if (!line?.productId || !Number.isFinite(qty) || qty < 1) continue
    const key = `${line.productId}:${line.variantId}`
    const prev = merged.get(key)
    merged.set(key, { productId: line.productId, variantId: line.variantId, qty: Math.min(MAX_QTY, (prev?.qty ?? 0) + qty) })
  }
  if (merged.size === 0) errors.push('cart-empty')

  for (const line of merged.values()) {
    const product = findProduct(line.productId)
    const variant = product?.variants.find((v) => v.id === line.variantId)
    if (!product || !variant) {
      errors.push('product-missing')
      details.push(line.productId)
      continue
    }
    const price = product.price + (variant.priceDelta ?? 0)
    if (price <= 0) {
      errors.push('price-missing')
      details.push(product.nameRu)
      continue
    }
    if (variant.stock < line.qty) {
      errors.push('out-of-stock')
      details.push(product.nameRu)
      continue
    }
    products.push(product)
    lines.push({
      productId: product.id,
      oneCId: product.oneCId ?? '',
      code: product.oneCCode ?? product.id,
      name: product.nameRu,
      price,
      qty: line.qty,
      sum: price * line.qty,
    })
  }

  if (errors.length > 0) return { ok: false, errors: [...new Set(errors)], details }

  const goodsTotal = lines.reduce((s, l) => s + l.sum, 0)
  const deliveryPrice = deliveryPriceFor(products, method)
  return {
    ok: true,
    order: {
      customer: { name, phone: phone! },
      delivery: { method, city, address, price: deliveryPrice },
      comment: (request.comment ?? '').trim().slice(0, 500),
      lines,
      goodsTotal,
      total: goodsTotal + deliveryPrice,
      lang: request.lang === 'ky' ? 'ky' : 'ru',
    },
  }
}
