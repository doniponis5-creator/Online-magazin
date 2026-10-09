'use client'

import { useState } from 'react'
import { photoSrc } from '@/lib/photoSrc'
import { useI18n } from '@/lib/i18n/I18nProvider'
import type { ArtKind } from '@/data/products'
import { ProductArt } from './ProductArt'

/**
 * Единый нейтральный плейсхолдер товара (решение владельца 12.09):
 * реальных фотографий моделей в витрине нет, пока владелец не предоставит
 * свой каталог. Схематичная иконка — декоративная, не изображает точный
 * внешний вид/цвет модели; подпись локализована («Фото скоро появится»).
 * Цвет иконки всегда фирменный синий: светлые варианты товаров
 * (#E9EDF5, #F4F6FA) на светлом фоне плейсхолдера исчезают.
 */
export function ProductImage({
  kind,
  variant = 'card',
  image,
  alt,
  eager,
}: {
  kind: ArtKind
  /** card — квадратная зона в карточке/корзине, gallery — крупная зона товара */
  variant?: 'card' | 'gallery'
  image?: string
  alt?: string
  /** грузить сразу: соседнее фото в ленте галереи должно быть готово до свайпа */
  eager?: boolean
}) {
  const { t } = useI18n()
  // Фото удалили на сервере, а каталог ещё ссылается (аудит 09.10: 404 у товара в каталоге) —
  // вместо значка «битая картинка» показываем заглушку «Фото скоро появится».
  const [broken, setBroken] = useState<string | null>(null)

  if (image && broken !== image) {
    return (
      <div
        className={
          variant === 'gallery'
            ? 'product-placeholder product-placeholder--gallery product-placeholder--photo'
            : 'product-placeholder product-placeholder--photo'
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoSrc(image)}
          alt={alt || ''}
          className="product-image-photo"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            padding: variant === 'gallery' ? '1rem' : '0.5rem',
            maxHeight: variant === 'gallery' ? '460px' : '100%',
          }}
          loading={eager ? 'eager' : 'lazy'}
          onError={() => setBroken(image)}
          // ошибка могла случиться до того, как React подключил onError
          ref={(el) => {
            if (el && el.complete && el.naturalWidth === 0 && el.currentSrc) setBroken(image)
          }}
        />
      </div>
    )
  }

  return (
    <div
      className={variant === 'gallery' ? 'product-placeholder product-placeholder--gallery' : 'product-placeholder'}
      role="img"
      aria-label={t.product.photoPending}
    >
      <ProductArt kind={kind} color="#245BEB" className="product-placeholder__icon" />
      <span className="product-placeholder__label">{t.product.photoPending}</span>
    </div>
  )
}
