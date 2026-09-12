'use client'

import { useI18n } from '@/lib/i18n/I18nProvider'
import type { ArtKind } from '@/data/products'
import { ProductArt } from './ProductArt'

/**
 * Единый нейтральный плейсхолдер товара (решение владельца 12.09):
 * реальных фотографий моделей в витрине нет, пока владелец не предоставит
 * свой каталог. Схематичная иконка — декоративная, не изображает точный
 * внешний вид/цвет модели; подпись локализована («Фото скоро появится»).
 */
export function ProductImage({
  kind,
  colorHex,
  variant = 'card',
}: {
  kind: ArtKind
  colorHex?: string
  /** card — квадратная зона в карточке/корзине, gallery — крупная зона товара */
  variant?: 'card' | 'gallery'
}) {
  const { t } = useI18n()
  return (
    <div
      className={variant === 'gallery' ? 'product-placeholder product-placeholder--gallery' : 'product-placeholder'}
      role="img"
      aria-label={t.product.photoPending}
    >
      <ProductArt kind={kind} color={colorHex ?? '#245BEB'} className="product-placeholder__icon" />
      <span className="product-placeholder__label">{t.product.photoPending}</span>
    </div>
  )
}
