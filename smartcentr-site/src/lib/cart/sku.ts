import type { Product, ProductVariant } from '@/data/products'
import type { Lang } from '@/lib/i18n/config'

/**
 * Чистые помощники выбора SKU (без React) — покрываются тестами.
 * Галерея, цена, остаток и добавление в корзину читают один и тот же
 * выбранный вариант; fallback на чужой SKU запрещён (см. ProductDetail).
 */

/** Вариант, точно соответствующий выбранной комбинации, или undefined. */
export function comboVariant(
  product: Product,
  colorKey: string | null,
  memoryKey: string | null,
): ProductVariant | undefined {
  return product.variants.find((v) => {
    if (product.colorOptions && v.colorKey !== colorKey) return false
    if (product.memoryOptions && v.memoryKey !== memoryKey) return false
    return true
  })
}

/** Цвет по умолчанию: первый цвет, для которого есть вариант в наличии. */
export function defaultColorKey(product: Product): string | null {
  if (!product.colorOptions) return null
  const inStock = product.variants.find(
    (v) => v.stock > 0 && product.colorOptions!.some((c) => c.key === v.colorKey),
  )
  const fallback = product.variants.find((v) =>
    product.colorOptions!.some((c) => c.key === v.colorKey),
  )
  return (inStock ?? fallback)?.colorKey ?? null
}

/** Память по умолчанию с учётом выбранного цвета (первый доступный, затем любой). */
export function defaultMemoryKey(product: Product, colorKey: string | null): string | null {
  if (!product.memoryOptions) return null
  const pool = product.variants.filter(
    (v) => !product.colorOptions || v.colorKey === colorKey,
  )
  if (pool.length === 0) return null
  const inStock = pool.find((v) => v.stock > 0)
  return (inStock ?? pool[0]).memoryKey ?? null
}

/**
 * Явные предложения при отсутствии выбранной комбинации:
 * доступные (в наличии) комбинации, сначала совпадающие по цвету,
 * затем по памяти. Никаких молчаливых подмен — только предложение,
 * которое пользователь выбирает сам.
 */
export function suggestCombos(
  product: Product,
  colorKey: string | null,
  memoryKey: string | null,
): ProductVariant[] {
  const available = product.variants.filter((v) => v.stock > 0)
  const score = (v: ProductVariant): number => {
    let s = 0
    if (product.colorOptions && v.colorKey === colorKey) s += 2
    if (product.memoryOptions && v.memoryKey === memoryKey) s += 1
    return -s
  }
  return [...available].sort((a, b) => score(a) - score(b)).slice(0, 4)
}

export function colorOptionsOf(product: Product) {
  return product.colorOptions ?? []
}

export function memoryOptionsOf(product: Product) {
  return product.memoryOptions ?? []
}

/** Цвет существует в природе (есть хоть один вариант, даже нулевой остаток). */
export function colorExists(product: Product, colorKey: string): boolean {
  return product.variants.some((v) => v.colorKey === colorKey)
}

export function memoryExists(product: Product, memoryKey: string): boolean {
  return product.variants.some((v) => v.memoryKey === memoryKey)
}

/** Доступна ли комбинация к покупке: вариант существует и есть демо-остаток. */
export function isComboPurchasable(
  product: Product,
  colorKey: string | null,
  memoryKey: string | null,
): boolean {
  const variant = comboVariant(product, colorKey, memoryKey)
  return Boolean(variant && variant.stock > 0)
}

export function variantLabel(product: Product, variant: ProductVariant, lang: Lang): string {
  const parts: string[] = []
  if (variant.colorKey) {
    const c = product.colorOptions?.find((o) => o.key === variant.colorKey)
    if (c) parts.push(lang === 'ky' ? c.labelKy : c.labelRu)
  }
  if (variant.memoryKey) {
    const m = product.memoryOptions?.find((o) => o.key === variant.memoryKey)
    if (m) parts.push(lang === 'ky' ? m.labelKy : m.labelRu)
  }
  return parts.join(' · ')
}
