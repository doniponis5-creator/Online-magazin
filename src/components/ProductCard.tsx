'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { categoryName } from '@/data/categories'
import { colorHexOf } from '@/data/products'
import { productPhotos } from '@/data/photos'
import { formatSom } from '@/lib/format'
import type { Product } from '@/data/products'
import { useCart } from '@/lib/cart/CartProvider'
import { AddToCartButton } from './AddToCartButton'
import { FavoriteButton } from './FavoriteButton'
import { ProductImage } from './ProductImage'
import { QuantityStepper } from './QuantityStepper'

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const { t, lang } = useI18n()
  const cart = useCart()
  const name = lang === 'ky' ? product.nameKy : product.nameRu
  const variant = product.variants[0]
  const inStock = variant.stock > 0
  const href = `/${lang}/product/${product.id}`
  const photo = productPhotos[product.id]

  // если товар уже в корзине — кнопка превращается в количество
  const line = cart.lines.find(
    (l) => l.productId === product.id && l.variantId === variant.id,
  )
  const mounted = cart.hydrated

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
          <ProductImage
            productId={product.id}
            kind={product.art}
            colorHex={colorHexOf(product, variant)}
            altRu={photo?.altRu ?? name}
            altKy={photo?.altKy ?? name}
            priority={priority}
          />
          {photo && <span className="card__photo-badge">{t.product.photoCategoryBadge}</span>}
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
          {!inStock ? (
            <button type="button" className="btn btn--outline btn--sm btn--block" disabled>
              {t.catalog.outOfStock}
            </button>
          ) : mounted && line ? (
            <div className="card__stepper">
              <QuantityStepper
                value={line.qty}
                max={variant.stock}
                onChange={(next) => cart.changeQty(product.id, variant.id, next)}
                ariaLabel={`${t.cart.quantity}: ${name}`}
              />
            </div>
          ) : (
            <AddToCartButton productId={product.id} variantId={variant.id} block small />
          )}
        </div>
      </div>
    </article>
  )
}
