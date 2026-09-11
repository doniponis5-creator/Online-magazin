'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { categoryName } from '@/data/categories'
import { colorHexOf } from '@/data/products'
import { formatSom } from '@/lib/format'
import type { Product } from '@/data/products'
import { AddToCartButton } from './AddToCartButton'
import { FavoriteButton } from './FavoriteButton'
import { ProductArt } from './ProductArt'

export function ProductCard({ product }: { product: Product }) {
  const { t, lang } = useI18n()
  const name = lang === 'ky' ? product.nameKy : product.nameRu
  const variant = product.variants[0]
  const inStock = variant.stock > 0
  const href = `/${lang}/product/${product.id}`

  return (
    <article className="card">
      <div className="card__media">
        <div className="card__badges">
          {product.badge === 'hit' && <span className="badge badge--hit">{t.catalog.badgeHit}</span>}
          {product.badge === 'new' && <span className="badge badge--new">{t.catalog.badgeNew}</span>}
        </div>
        <div className="card__fav">
          <FavoriteButton productId={product.id} variant="floating" />
        </div>
        <Link href={href} className="card__media-link" aria-label={name} tabIndex={-1}>
          <ProductArt kind={product.art} color={colorHexOf(product, variant)} />
        </Link>
      </div>
      <div className="card__body">
        <span className="card__cat">{categoryName(product.categoryId, lang)}</span>
        <Link href={href} className="card__name">
          {name}
        </Link>
        <div className="card__prices">
          <span className="card__price">{formatSom(product.price)}</span>
          {product.oldPrice && <span className="card__old-price">{formatSom(product.oldPrice)}</span>}
        </div>
        <div className="card__actions">
          {inStock ? (
            <AddToCartButton
              productId={product.id}
              variantId={variant.id}
              block
              small
            />
          ) : (
            <button type="button" className="btn btn--outline btn--sm btn--block" disabled>
              {t.catalog.outOfStock}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
