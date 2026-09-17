'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import type { Product } from '@/data/products'

import type { ProductPhoto } from '@/data/photos'
import { ProductArt } from './ProductArt'
import { ProductImage } from './ProductImage'

/**
 * Галерея товара. Решение владельца 12.09: реальных фотографий моделей в
 * витрине пока нет — показываем единый нейтральный плейсхолдер
 * («Фото скоро появится») и НЕ открываем фотозум без снимка.
 *
 * Доступный зум в нативном <dialog> (фон инертен, Tab внутри, Escape
 * закрывает, фокус возвращается, прокрутка фона блокируется) сохранён для
 * будущих реальных фото и проверяется отдельной фикстурой
 * (/dev/gallery?fixture=zoom), не входящей в публичную витрину:
 * свойство photo намеренно передаётся только фикстурой.
 */
export function Gallery({
  product,
  colorKey,
  onColorChange,
  photo,
}: {
  product: Product
  colorKey: string | null
  onColorChange?: (colorKey: string) => void
  /** реальный снимок; в публичной витрине не передаётся (только фикстура) */
  photo?: ProductPhoto
}) {
  const { t, lang } = useI18n()
  const [zoomOpen, setZoomOpen] = useState(false)
  // Несколько фото из 1С: выбранное показывается крупно, остальные — миниатюрами.
  const images = product.images ?? []
  const [imageIndex, setImageIndex] = useState(0)
  const currentImage = images[imageIndex] ?? product.image
  const openerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const name = lang === 'ky' ? product.nameKy : product.nameRu
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

  const mainView = photo ? (
    <Image
      src={photo.src}
      alt={alt}
      fill
      sizes="(max-width: 960px) 92vw, 46vw"
      priority
      className="product-photo gallery-photo"
    />
  ) : (
    <ProductImage kind={product.art} variant="gallery" image={currentImage} alt={name} />
  )

  return (
    <div className="gallery">
      {photo ? (
        <button
          type="button"
          ref={openerRef}
          className="gallery__main gallery__main--zoom"
          onClick={() => setZoomOpen(true)}
          aria-label={`${t.product.zoomOpen}: ${name}`}
          title={t.product.zoomOpen}
        >
          {mainView}
        </button>
      ) : (
        <div className="gallery__main">{mainView}</div>
      )}

      {images.length > 1 && (
        <div className="gallery__thumbs" role="group" aria-label={t.a11y.mainGallery}>
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              className="gallery__thumb gallery__thumb--photo"
              aria-pressed={i === imageIndex}
              aria-label={`${name}: ${i + 1} / ${images.length}`}
              onClick={() => setImageIndex(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {(product.colorOptions ?? []).length > 1 && onColorChange && (
        <div className="gallery__thumbs" role="group" aria-label={t.product.color}>
          {(product.colorOptions ?? []).map((c) => {
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
      {photo && (
        <dialog
          ref={dialogRef}
          className="zoom-overlay"
          aria-label={t.a11y.mainGallery}
          onClose={onDialogClose}
        >
          <div className="zoom-overlay__stage">
            <Image
              src={photo.src}
              alt={alt}
              fill
              sizes="92vw"
              className="product-photo gallery-photo"
            />
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
      )}
    </div>
  )
}
