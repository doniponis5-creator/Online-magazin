'use client'

import { useI18n } from '@/lib/i18n/I18nProvider'
import type { Product, ProductVariant } from '@/data/products'
import { unitPrice } from '@/lib/cart/logic'
import { formatSom } from '@/lib/format'
import { variantLabel } from '@/lib/cart/sku'
import { categoryName } from '@/data/categories'
import { AddToCartButton } from './AddToCartButton'
import { FavoriteButton } from './FavoriteButton'

function StockLine({ stock }: { stock: number }) {
  const { t } = useI18n()
  if (stock <= 0) {
    return (
      <span className="stock-line">
        <span className="stock-dot stock-dot--out" />
        {t.catalog.outOfStock}
      </span>
    )
  }
  if (stock <= 3) {
    return (
      <span className="stock-line">
        <span className="stock-dot stock-dot--low" />
        {t.product.lowStock}: {stock}
      </span>
    )
  }
  return (
    <span className="stock-line">
      <span className="stock-dot" />
      {t.product.inStock}: {stock}
    </span>
  )
}

export function ProductPurchase({
  product,
  variant,
  colorKey,
  memoryKey,
  onColorChange,
  onMemoryChange,
}: {
  product: Product
  variant: ProductVariant
  colorKey: string | null
  memoryKey: string | null
  onColorChange: (colorKey: string | null) => void
  onMemoryChange: (memoryKey: string | null) => void
}) {
  const { t, lang } = useI18n()
  const name = lang === 'ky' ? product.nameKy : product.nameRu
  const price = unitPrice(product, variant.id) ?? product.price
  const colorOptions = product.colorOptions ?? []
  const memoryOptions = product.memoryOptions ?? []
  const label = variantLabel(product, variant, lang)

  return (
    <div className="purchase">
      <span className="purchase__cat">
        {categoryName(product.categoryId, lang)}
        <span className="badge badge--demo">{t.product.demoBadge}</span>
      </span>
      <h1 className="purchase__name">{name}</h1>

      {label && (
        <span className="purchase__variant" aria-label={t.a11y.currentVariant}>
          {t.product.option}: {label}
        </span>
      )}

      <div className="purchase__prices">
        <span className="purchase__price">{formatSom(price)}</span>
        {product.oldPrice && <span className="purchase__old">{formatSom(product.oldPrice)}</span>}
      </div>

      <div>
        <StockLine stock={variant.stock} />
        <p className="stock-note">{t.product.stockNote}</p>
      </div>

      {colorOptions.length > 1 && (
        <div className="option-group">
          <span className="option-group__label">
            {t.product.color}
            {': '}
            <span>
              {variant.colorKey
                ? (() => {
                    const c = colorOptions.find((o) => o.key === variant.colorKey)
                    return c ? (lang === 'ky' ? c.labelKy : c.labelRu) : ''
                  })()
                : ''}
            </span>
          </span>
          <div className="swatch-row">
            {colorOptions.map((c) => {
              const exists = product.variants.some((v) => v.colorKey === c.key)
              const active = colorKey === c.key
              return (
                <button
                  key={c.key}
                  type="button"
                  className="swatch"
                  aria-pressed={active}
                  disabled={!exists}
                  onClick={() => onColorChange(c.key)}
                >
                  <span className="swatch__dot" style={{ background: c.hex }} />
                  {lang === 'ky' ? c.labelKy : c.labelRu}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {memoryOptions.length > 1 && (
        <div className="option-group">
          <span className="option-group__label">{t.product.memory}</span>
          <div className="swatch-row">
            {memoryOptions.map((m) => {
              const exists = product.variants.some((v) => v.memoryKey === m.key)
              const active = memoryKey === m.key
              const comboVariantRow = product.variants.find(
                (v) =>
                  v.memoryKey === m.key &&
                  (!product.colorOptions || v.colorKey === colorKey),
              )
              const delta = comboVariantRow?.priceDelta
              return (
                <button
                  key={m.key}
                  type="button"
                  className="swatch"
                  aria-pressed={active}
                  disabled={!exists}
                  onClick={() => onMemoryChange(m.key)}
                >
                  {lang === 'ky' ? m.labelKy : m.labelRu}
                  {delta ? ` · +${formatSom(delta)}` : ''}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="purchase__actions">
        <AddToCartButton
          productId={product.id}
          variantId={variant.id}
          disabled={variant.stock <= 0}
        />
        <FavoriteButton productId={product.id} variant="floating" />
      </div>

      <span className="demo-strip">{t.checkout.sbonusNote}</span>
    </div>
  )
}
