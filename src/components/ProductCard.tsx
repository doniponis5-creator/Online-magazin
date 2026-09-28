'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { categoryName } from '@/data/categories'
import { formatSom } from '@/lib/format'
import { phones, whatsappHref } from '@/data/contacts'
import { SITE_URL } from '@/lib/seo'
import type { Product } from '@/data/products'
import { useCart } from '@/lib/cart/CartProvider'
import { AddToCartButton } from './AddToCartButton'
import { FavoriteButton } from './FavoriteButton'
import { IconWhatsApp } from './Icons'
import { ProductImage } from './ProductImage'
import { PromoCountdown } from './PromoCountdown'
import { QuantityStepper } from './QuantityStepper'
import { SoonBadge } from './SoonBadge'

export function ProductCard({ product }: { product: Product }) {
  const { t, lang } = useI18n()
  const cart = useCart()
  const name = lang === 'ky' ? product.nameKy : product.nameRu
  const desc = (lang === 'ky' ? product.descKy : product.descRu)?.trim()
  const variant = product.variants[0]
  const inStock = variant.stock > 0
  const href = `/${lang}/product/${product.id}`
  // Цена есть, а товара нет — фото приглушаем: статус виден до того, как дочитали до кнопки.
  const soldOut = product.price > 0 && !inStock

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
    <article className={`card${soldOut ? ' card--sold-out' : ''}`}>
      <div className="card__media">
        <div className="card__badges">
          {product.preorder && <SoonBadge />}
          {product.badge === 'hit' && <span className="badge badge--hit">{t.catalog.badgeHit}</span>}
          {product.badge === 'new' && <span className="badge badge--new">{t.catalog.badgeNew}</span>}
        </div>
        <div className="card__fav">
          <FavoriteButton productId={product.id} variant="floating" />
        </div>
        {/* Срок акции задаёт владелец у самого товара в 1С; нет срока — нет наклейки */}
        {product.promoUntil && <PromoCountdown until={product.promoUntil} variant="card" />}
        <Link href={href} className="card__media-link" aria-label={name} tabIndex={-1}>
          <ProductImage kind={product.art} image={product.image} alt={name} />
        </Link>
      </div>
      <div className="card__body">
        <span className="card__cat">{categoryName(product.categoryId, lang)}</span>
        <Link href={href} className="card__name">
          {name}
        </Link>
        {/* Две строки описания — только на компьютере. Там карточки тянутся до
            высоты самой высокой в ряду, и под названием оставалась пустота.
            На телефоне места нет, и описание там только мешало бы. */}
        {desc && <p className="card__desc">{desc}</p>}
        <div className="card__prices">
          {product.price > 0 ? (
            <>
              <span className={`card__price${product.oldPrice ? ' card__price--sale' : ''}`}>{formatSom(product.price)}</span>
              {product.oldPrice && <span className="card__old-price">{formatSom(product.oldPrice)}</span>}
            </>
          ) : (
            <span className="card__price card__price--request">{t.catalog.priceOnRequest}</span>
          )}
        </div>
        <div className="card__actions" ref={actions} tabIndex={-1} aria-label={`${t.cart.quantity}: ${name}`}>
          {product.price <= 0 ? (
            // Цена по запросу: вместо мёртвой кнопки с тем же текстом — вопрос в WhatsApp,
            // уже с названием и ссылкой на товар (как «Спросить в WhatsApp» на странице товара).
            <a
              className="btn btn--outline btn--sm btn--block"
              href={whatsappHref(phones[0], `${t.contactWidget.askAbout} ${name}
${SITE_URL}${href}`)}
              target="_blank"
              rel="noopener"
            >
              <IconWhatsApp size={16} />
              {t.catalog.askPrice}
            </a>
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
            <AddToCartButton productId={product.id} variantId={variant.id} block small
              label={product.preorder ? t.catalog.preorder : undefined} noIcon={product.preorder} onAdded={(keyboard) => {
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
