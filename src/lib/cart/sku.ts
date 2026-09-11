import type { Product, ProductVariant } from '@/data/products'
import type { Lang } from '@/lib/i18n/config'

/**
 * Чистые помощники выбора SKU (без React) — покрываются тестами.
 * Галерея, цена, остаток и добавление в корзину читают один и тот же
 * выбранный вариант; fallback на невыбранный SKU запрещён.
 */

export function colorOptionsOf(product: Product) {
  return product.colorOptions ?? []
}

export function memoryOptionsOf(product: Product) {
  return product.memoryOptions ?? []
}

/** Доступна ли комбинация к покупке: вариант существует и есть демо-остаток. */
export function isComboPurchasable(
  product: Product,
  colorKey: string | null,
  memoryKey: string | null,
): boolean {
  const variant = product.variants.find((v) => {
    if (product.colorOptions && v.colorKey !== colorKey) return false
    if (product.memoryOptions && v.memoryKey !== memoryKey) return false
    return true
  })
  return Boolean(variant && variant.stock > 0)
}

/** При смене цвета подбираем память: сначала желаемая в наличии, затем любая в наличии. */
export function pickMemoryForColor(
  product: Product,
  colorKey: string | null,
  preferredMemory: string | null,
): string | null {
  if (!product.memoryOptions) return null
  const pool = product.variants.filter((v) => !product.colorOptions || v.colorKey === colorKey)
  if (pool.length === 0) return null
  const preferred = pool.find((v) => v.memoryKey === preferredMemory && v.stock > 0)
  if (preferred) return preferred.memoryKey ?? null
  const inStock = pool.find((v) => v.stock > 0)
  return (inStock ?? pool[0]).memoryKey ?? null
}

/** При смене памяти подбираем цвет: сначала желаемый в наличии, затем любой в наличии. */
export function pickColorForMemory(
  product: Product,
  memoryKey: string | null,
  preferredColor: string | null,
): string | null {
  if (!product.colorOptions) return null
  const pool = product.variants.filter((v) => !product.memoryOptions || v.memoryKey === memoryKey)
  if (pool.length === 0) return null
  const preferred = pool.find((v) => v.colorKey === preferredColor && v.stock > 0)
  if (preferred) return preferred.colorKey ?? null
  const inStock = pool.find((v) => v.stock > 0)
  return (inStock ?? pool[0]).colorKey ?? null
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