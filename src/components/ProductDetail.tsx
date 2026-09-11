'use client'

import { useMemo, useState } from 'react'
import type { Product } from '@/data/products'
import { comboVariant, defaultColorKey, defaultMemoryKey } from '@/data/products'
import { Gallery } from './Gallery'
import { ProductPurchase } from './ProductPurchase'

/**
 * Единственный источник выбранного SKU: цвет + память → конкретная комбинация.
 * Fallback на чужой SKU запрещён: если комбинации нет — явное состояние
 * «недоступно в этой комбинации» с предложением доступных вариантов,
 * которое пользователь выбирает сам (никаких молчаливых подмен).
 */
export function ProductDetail({ product }: { product: Product }) {
  const [colorKey, setColorKey] = useState<string | null>(() => defaultColorKey(product))
  const [memoryKey, setMemoryKey] = useState<string | null>(() =>
    defaultMemoryKey(product, defaultColorKey(product)),
  )

  const variant = useMemo(
    () => comboVariant(product, colorKey, memoryKey),
    [product, colorKey, memoryKey],
  )

  // Меняем только выбранную характеристику — вторую не трогаем молча.
  const onColorChange = (nextColor: string | null) => setColorKey(nextColor)
  const onMemoryChange = (nextMemory: string | null) => setMemoryKey(nextMemory)

  return (
    <div className="product-page">
      <Gallery product={product} colorKey={colorKey} onColorChange={onColorChange} />
      <ProductPurchase
        product={product}
        variant={variant ?? null}
        colorKey={colorKey}
        memoryKey={memoryKey}
        onColorChange={onColorChange}
        onMemoryChange={onMemoryChange}
      />
    </div>
  )
}
