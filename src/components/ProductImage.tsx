import Image from 'next/image'
import { productPhotos } from '@/data/photos'
import type { ArtKind } from '@/data/products'
import { ProductArt } from './ProductArt'

/**
 * Единое изображение товара: лицензированное фото (public/photos) либо
 * помеченный схематичный плейсхолдер ProductArt, если фото пока нет.
 * Фото — категорийные/декоративные, не снимки конкретных моделей
 * (см. ASSET_SOURCES.md). aspect-ratio резервируется контейнером.
 */
export function ProductImage({
  productId,
  kind,
  colorHex,
  altRu,
  altKy,
  sizes = '(max-width: 640px) 50vw, (max-width: 960px) 33vw, 25vw',
  priority = false,
  imageClassName,
}: {
  productId: string
  kind: ArtKind
  colorHex: string
  altRu: string
  altKy: string
  sizes?: string
  priority?: boolean
  imageClassName?: string
}) {
  const photo = productPhotos[productId]
  if (photo) {
    return (
      <Image
        src={photo.src}
        alt={altRu}
        fill
        sizes={sizes}
        priority={priority}
        className={`product-photo${imageClassName ? ` ${imageClassName}` : ''}`}
      />
    )
  }
  return <ProductArt kind={kind} color={colorHex} className="product-art" />
}
