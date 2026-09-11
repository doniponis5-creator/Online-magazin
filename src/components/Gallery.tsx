'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import type { Product, ProductVariant } from '@/data/products'
import { colorHexOf } from '@/data/products'
import { ProductArt } from './ProductArt'

/**
 * Галерея читает тот же выбранный SKU, что и блок покупки.
 * Миниатюры — выбор цвета (клавиатуродоступный), зум — диалог
 * с Escape, кнопкой закрытия и возвратом фокуса.
 */
export function Gallery({
  product,
  variant,
  onColorChange,
}: {
  product: Product
  variant: ProductVariant
  onColorChange?: (colorKey: string) => void
}) {
  const { t, lang } = useI18n()
  const [zoomOpen, setZoomOpen] = useState(false)
  const openerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const name = lang === 'ky' ? product.nameKy : product.nameRu
  const colorViews = product.colorOptions ?? []
  const currentHex = colorHexOf(product, variant)

  useEffect(() => {
    if (!zoomOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomOpen(false)
    }
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      openerRef.current?.focus()
    }
  }, [zoomOpen])

  return (
    <div className="gallery">
      <button
        type="button"
        ref={openerRef}
        className="gallery__main gallery__main--zoom"
        onClick={() => setZoomOpen(true)}
        aria-label={`${t.product.zoomOpen}: ${name} — ${lang === 'ky' ? product.nameKy : product.nameRu}`}
        title={t.product.zoomOpen}
      >
        <ProductArt kind={product.art} color={currentHex} />
      </button>

      {colorViews.length > 1 && onColorChange && (
        <div className="gallery__thumbs" role="group" aria-label={t.product.color}>
          {colorViews.map((c) => {
            const exists = product.variants.some((v) => v.colorKey === c.key)
            return (
              <button
                key={c.key}
                type="button"
                className="gallery__thumb"
                aria-pressed={c.key === variant.colorKey}
                aria-label={`${t.product.color}: ${lang === 'ky' ? c.labelKy : c.labelRu}`}
                title={lang === 'ky' ? c.labelKy : c.labelRu}
                disabled={!exists}
                onClick={() => onColorChange(c.key)}
              >
                <ProductArt kind={product.art} color={c.hex} />
              </button>
            )
          })}
        </div>
      )}

      {zoomOpen && (
        <div className="zoom-overlay" role="dialog" aria-modal="true" aria-label={t.a11y.mainGallery}>
          <button
            type="button"
            ref={closeRef}
            className="zoom-overlay__close"
            onClick={() => setZoomOpen(false)}
            aria-label={t.product.zoomClose}
          >
            ✕
          </button>
          <div className="zoom-overlay__stage">
            <ProductArt kind={product.art} color={currentHex} />
          </div>
        </div>
      )}
    </div>
  )
}
