'use client'

import { useI18n } from '@/lib/i18n/I18nProvider'
import type { Product, ProductVariant } from '@/data/products'
import { unitPrice } from '@/lib/cart/logic'
import { formatSom } from '@/lib/format'
import { suggestCombos, variantLabel } from '@/lib/cart/sku'
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
  /** Комбинация выбрана точно; null — выбранной комбинации нет в каталоге */
  variant: ProductVariant | null
  colorKey: string | null
  memoryKey: string | null
  onColorChange: (colorKey: string | null) => void
  onMemoryChange: (memoryKey: string | null) => void
}) {
  const { t, lang } = useI18n()
  const name = lang === 'ky' ? product.nameKy : product.nameRu
  const price = variant ? (unitPrice(product, variant.id) ?? product.price) : null
  const colorOptions = product.colorOptions ?? []
  const memoryOptions = product.memoryOptions ?? []
  const label = variant ? variantLabel(product, variant, lang) : null
  const suggestions = variant ? [] : suggestCombos(product, colorKey, memoryKey)
  const chosenColorLabel = colorOptions.find((c) => c.key === colorKey)
  const chosenMemoryLabel = memoryOptions.find((m) => m.key === memoryKey)

  return (
    <div className="purchase">
      <span className="purchase__cat">
        {categoryName(product.categoryId, lang)}
      </span>
      <h1 className="purchase__name">{name}</h1>

      {label && (
        <span className="purchase__variant" aria-label={t.a11y.currentVariant}>
          {t.product.option}: {label}
        </span>
      )}

      {variant && price !== null && product.price <= 0 ? (
        <div className="purchase__prices">
          <span className="purchase__price purchase__price--request">{t.catalog.priceOnRequest}</span>
        </div>
      ) : variant && price !== null ? (
        <div className="purchase__prices">
          <span className="purchase__price">{formatSom(price)}</span>
          {product.oldPrice && <span className="purchase__old">{formatSom(product.oldPrice)}</span>}
        </div>
      ) : null}

      {variant ? (
        <div>
          <StockLine stock={variant.stock} />
          <p className="stock-note">{t.product.stockNote}</p>
        </div>
      ) : (
        <div className="combo-missing" role="status">
          <strong>{t.product.comboMissing}</strong>
          <p>{t.product.comboMissingNote}</p>
          <div className="combo-missing__list">
            {suggestions.map((v) => (
              <button
                key={v.id}
                type="button"
                className="swatch"
                onClick={() => {
                  if (product.colorOptions && v.colorKey) onColorChange(v.colorKey)
                  if (product.memoryOptions && v.memoryKey) onMemoryChange(v.memoryKey)
                }}
              >
                {variantLabel(product, v, lang)}
                {v.priceDelta ? ` · +${formatSom(v.priceDelta)}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {colorOptions.length > 1 && (
        <div className="option-group">
          <span className="option-group__label">
            {t.product.color}
            {': '}
            <span>{chosenColorLabel ? (lang === 'ky' ? chosenColorLabel.labelKy : chosenColorLabel.labelRu) : '—'}</span>
          </span>
          <div className="swatch-row">
            {colorOptions.map((c) => {
              const exists = product.variants.some((v) => v.colorKey === c.key)
              return (
                <button
                  key={c.key}
                  type="button"
                  className="swatch"
                  aria-pressed={colorKey === c.key}
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
          <span className="option-group__label">
            {t.product.memory}
            {': '}
            <span>{chosenMemoryLabel ? (lang === 'ky' ? chosenMemoryLabel.labelKy : chosenMemoryLabel.labelRu) : '—'}</span>
          </span>
          <div className="swatch-row">
            {memoryOptions.map((m) => {
              const exists = product.variants.some((v) => v.memoryKey === m.key)
              return (
                <button
                  key={m.key}
                  type="button"
                  className="swatch"
                  aria-pressed={memoryKey === m.key}
                  disabled={!exists}
                  onClick={() => onMemoryChange(m.key)}
                >
                  {lang === 'ky' ? m.labelKy : m.labelRu}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="purchase__actions">
        {variant ? (
          <AddToCartButton
            productId={product.id}
            variantId={variant.id}
            disabled={variant.stock <= 0}
          />
        ) : (
          <button type="button" className="btn btn--primary" disabled aria-live="polite">
            {t.product.comboMissing}
          </button>
        )}
        <FavoriteButton productId={product.id} variant="floating" />
      </div>

      <span className="bonus-hint">{t.checkout.sbonusNote}</span>
    </div>
  )
}
