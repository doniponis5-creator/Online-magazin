import Image from 'next/image'
import { productPhotos } from '@/data/photos'
import type { ArtKind } from '@/data/products'
import { ProductArt } from './ProductArt'
import { useI18n } from '@/lib/i18n/I18nProvider'

/**
 * Единое изображение товара: лицензированное фото (public/photos) либо
 * помеченный схематичный плейсхолдер ProductArt, если фото пока нет.
 * Фото — категорийные/декоративные, не снимки конкретных моделей; это видно
 * в явной подписи (см. словарь product.photoCategory*) и в ASSET_SOURCES.md.
 * alt выбирается по текущей локали интерфейса.
 */
export function ProductImage({
  productId,
  kind,
  colorHex,
  altRu,
  altKy,
  sizes = '(max-width: 640px) 50vw, (max-width: 960px) 33vw, 25vw',
  priority = false,
}: {
  productId: string
  kind: ArtKind
  colorHex: string
  altRu: string
  altKy: string
  sizes?: string
  priority?: boolean
}) {
  const { lang } = useI18n()
  const photo = productPhotos[productId]
  if (photo) {
    return (
      <Image
        src={photo.src}
        alt={lang === 'ky' ? altKy : altRu}
        fill
        sizes={sizes}
        priority={priority}
        className="product-photo"
      />
    )
  }
  return <ProductArt kind={kind} color={colorHex} className="product-art" />
}
