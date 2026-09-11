'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import type { Product } from '@/data/products'
import { colorHexOfKey } from '@/data/products'
import { productPhotos } from '@/data/photos'
import { ProductArt } from './ProductArt'

/**
 * Галерея показывает выбранный цвет того же SKU, что и блок покупки.
 * Если у товара есть фото — крупный снимок + зум в нативном <dialog>
 * (фон инертен, Tab остаётся в диалоге, Escape закрывает, фокус
 * возвращается, прокрутка фона блокируется). Без фото — цветные
 * схематичные плейсхолдеры ProductArt с явной демо-маркировкой.
 */
export function Gallery({
  product,
  colorKey,
  onColorChange,
}: {
  product: Product
  colorKey: string | null
  onColorChange?: (colorKey: string) => void
}) {
  const { t, lang } = useI18n()
  const [zoomOpen, setZoomOpen] = useState(false)
  const openerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const name = lang === 'ky' ? product.nameKy : product.nameRu
  const photo = productPhotos[product.id]
  const colorViews = photo ? [] : (product.colorOptions ?? [])
  const currentHex = colorHexOfKey(product, colorKey)
  const alt = lang === 'ky' ? (photo?.altKy ?? name) : (photo?.altRu ?? name)

  // нативный модальный режим + блокировка прокрутки фона
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (zoomOpen && !dialog.open) {
      dialog.showModal()
      document.documentElement.classList.add('dialog-open')
    }
    if (!zoomOpen && dialog.open) {
      dialog.close()
    }
    return () => {
      if (dialog.open) dialog.close()
      document.documentElement.classList.remove('dialog-open')
    }
  }, [zoomOpen])

  const onDialogClose = () => {
    // синхронно снимаем блокировку прокрутки (эффект — страховка)
    document.documentElement.classList.remove('dialog-open')
    setZoomOpen(false)
    openerRef.current?.focus()
  }

  return (
    <div className="gallery">
      <button
        type="button"
        ref={openerRef}
        className="gallery__main gallery__main--zoom"
        onClick={() => setZoomOpen(true)}
        aria-label={`${t.product.zoomOpen}: ${name}`}
        title={t.product.zoomOpen}
      >
        {photo ? (
          <Image
            src={photo.src}
            alt={alt}
            fill
            sizes="(max-width: 960px) 92vw, 46vw"
            priority
            className="product-photo gallery-photo"
          />
        ) : (
          <ProductArt kind={product.art} color={currentHex} />
        )}
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
                aria-pressed={c.key === colorKey}
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

      {/* нативный модальный dialog: backdrop и inert-фон обеспечивает браузер */}
      <dialog
        ref={dialogRef}
        className="zoom-overlay"
        aria-label={t.a11y.mainGallery}
        onClose={onDialogClose}
      >
        <div className="zoom-overlay__stage">
          {photo ? (
            <Image
              src={photo.src}
              alt={alt}
              fill
              sizes="92vw"
              className="product-photo gallery-photo"
            />
          ) : (
            <ProductArt kind={product.art} color={currentHex} />
          )}
        </div>
        <button
          type="button"
          className="zoom-overlay__close"
          onClick={() => dialogRef.current?.close()}
          aria-label={t.product.zoomClose}
        >
          ✕
        </button>
      </dialog>
    </div>
  )
}
