'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { categoryName } from '@/data/categories'
import { formatSom } from '@/lib/format'
import type { Product } from '@/data/products'
import { useCart } from '@/lib/cart/CartProvider'
import { AddToCartButton } from './AddToCartButton'
import { FavoriteButton } from './FavoriteButton'
import { ProductImage } from './ProductImage'
import { QuantityStepper } from './QuantityStepper'

export function ProductCard({ product }: { product: Product }) {
  const { t, lang } = useI18n()
  const cart = useCart()
  const name = lang === 'ky' ? product.nameKy : product.nameRu
  const variant = product.variants[0]
  const inStock = variant.stock > 0
  const href = `/${lang}/product/${product.id}`

  // если товар уже в корзине — кнопка превращается в количество
  const line = cart.lines.find(
    (l) => l.productId === product.id && l.variantId === variant.id,
  )
  const mounted = cart.hydrated
  const actions = useRef<HTMLDivElement>(null)
  const focusAfterAdd = useRef(false)
  const [announcement, setAnnouncement] = useState('')
  useEffect(() => {
    if (!line || !focusAfterAdd.current) return
    focusAfterAdd.current = false
    const target = actions.current?.querySelector<HTMLElement>('button:not(:disabled)') ?? actions.current
    target?.focus({ preventScroll: true })
  }, [line])

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
          <ProductImage kind={product.art} image={product.image} alt={name} />
        </Link>
      </div>
      <div className="card__body">
        <span className="card__cat">{categoryName(product.categoryId, lang)}</span>
        <Link href={href} className="card__name">
          {name}
        </Link>
        <div className="card__prices">
          {product.price > 0 ? (
            <>
              <span className="card__price">{formatSom(product.price)}</span>
              {product.oldPrice && <span className="card__old-price">{formatSom(product.oldPrice)}</span>}
            </>
          ) : (
            <span className="card__price card__price--request">{t.catalog.priceOnRequest}</span>
          )}
        </div>
        <div className="card__actions" ref={actions} tabIndex={-1} aria-label={`${t.cart.quantity}: ${name}`}>
          {product.price <= 0 ? (
            <button type="button" className="btn btn--outline btn--sm btn--block" disabled>
              {t.catalog.priceOnRequest}
            </button>
          ) : !inStock ? (
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
            <AddToCartButton productId={product.id} variantId={variant.id} block small onAdded={(keyboard) => {
              focusAfterAdd.current = keyboard
              setAnnouncement(`${name}: ${t.catalog.added}`)
            }} />
          )}
        </div>
        <span className="visually-hidden" role="status">{announcement}</span>
      </div>
    </article>
  )
}
