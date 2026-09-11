'use client'

import { useMemo, useState } from 'react'
import type { Product } from '@/data/products'
import { comboVariant, defaultColorKey, defaultMemoryKey } from '@/data/products'
import {
  pickColorForMemory,
  pickMemoryForColor,
} from '@/lib/cart/sku'
import { Gallery } from './Gallery'
import { ProductPurchase } from './ProductPurchase'

/**
 * Единственный источник выбранного SKU: цвет + память → конкретная
 * комбинация. Галерея, цена, остаток и добавление в корзину читают
 * один и тот же вариант; несуществующие комбинации отключены.
 */
export function ProductDetail({ product }: { product: Product }) {
  const [colorKey, setColorKey] = useState<string | null>(() => defaultColorKey(product))
  const [memoryKey, setMemoryKey] = useState<string | null>(() =>
    defaultMemoryKey(product, defaultColorKey(product)),
  )

  const variant = useMemo(
    () => comboVariant(product, colorKey, memoryKey) ?? product.variants[0],
    [product, colorKey, memoryKey],
  )

  const onColorChange = (nextColor: string | null) => {
    setColorKey(nextColor)
    setMemoryKey((prevMemory) => pickMemoryForColor(product, nextColor, prevMemory))
  }

  const onMemoryChange = (nextMemory: string | null) => {
    setMemoryKey(nextMemory)
    setColorKey((prevColor) => pickColorForMemory(product, nextMemory, prevColor))
  }

  return (
    <div className="product-page">
      <Gallery product={product} variant={variant} onColorChange={onColorChange} />
      <ProductPurchase
        product={product}
        variant={variant}
        colorKey={colorKey}
        memoryKey={memoryKey}
        onColorChange={onColorChange}
        onMemoryChange={onMemoryChange}
      />
    </div>
  )
}
