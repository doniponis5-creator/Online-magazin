'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { Product } from '@/data/products'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { comboVariant, defaultColorKey, defaultMemoryKey } from '@/data/products'
import { Gallery } from './Gallery'
import { ProductPurchase } from './ProductPurchase'

/**
 * Единственный источник выбранного SKU: цвет + память → конкретная комбинация.
 * Fallback на чужой SKU запрещён: если комбинации нет — явное состояние
 * «недоступно в этой комбинации» с предложением доступных вариантов,
 * которое пользователь выбирает сам (никаких молчаливых подмен).
 */
export function ProductDetail({ product, kitchenHref = null }: { product: Product; kitchenHref?: string | null }) {
  const { t } = useI18n()
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

  const purchase = (
    <ProductPurchase
      product={product}
      variant={variant ?? null}
      colorKey={colorKey}
      memoryKey={memoryKey}
      onColorChange={onColorChange}
      onMemoryChange={onMemoryChange}
    />
  )

  return (
    <div className="product-page">
      <Gallery product={product} colorKey={colorKey} onColorChange={onColorChange} />
      {kitchenHref ? (
        <div>
          {purchase}
          {/* Духовка, плита, холодильник… — сразу в 3D-конструктор кухни с этой моделью */}
          <Link className="btn purchase__ask" href={kitchenHref}>
            <KitchenIcon />
            {t.product.tryInKitchen}
          </Link>
        </div>
      ) : (
        purchase
      )}
    </div>
  )
}

/** Кухонный гарнитур: верхние шкафы и нижние с ящиками. */
function KitchenIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="6" rx="1" />
      <rect x="3" y="12" width="18" height="9" rx="1" />
      <path d="M12 12v9M7 15.5h2M15 15.5h2M9 6h1M14 6h1" />
    </svg>
  )
}
