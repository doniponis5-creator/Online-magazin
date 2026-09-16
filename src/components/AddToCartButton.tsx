'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { getProduct } from '@/data/products'
import { useCart } from '@/lib/cart/CartProvider'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconCheck, IconCart } from './Icons'

/** Подтверждаем только фактическое изменение количества в корзине. */
export function AddToCartButton({
  productId,
  variantId,
  disabled,
  block,
  small,
  label,
  onAdded,
}: {
  productId: string
  variantId: string
  disabled?: boolean
  block?: boolean
  small?: boolean
  label?: string
  onAdded?: (keyboard: boolean) => void
}) {
  const { t } = useI18n()
  const cart = useCart()
  const [added, setAdded] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const variant = getProduct(productId)?.variants.find((item) => item.id === variantId)
  const qty = cart.lines.find((line) => line.productId === productId && line.variantId === variantId)?.qty ?? 0
  const atLimit = Boolean(variant && variant.stock > 0 && qty >= variant.stock)
  const unavailable = !variant || variant.stock < 1

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!cart.add(productId, variantId, 1)) return
    setAdded(true)
    onAdded?.(event.detail === 0)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setAdded(false), 1400)
  }

  const cls = [
    'btn',
    small ? 'btn--sm' : '',
    block ? 'btn--block' : '',
    added ? 'btn--lime' : 'btn--primary',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={disabled || !cart.hydrated || unavailable || atLimit}
      aria-live="polite"
    >
      {added ? <IconCheck size={18} /> : <IconCart size={18} />}
      {unavailable ? t.catalog.outOfStock : atLimit ? t.cart.maxStock : added ? t.catalog.added : (label ?? t.catalog.addToCart)}
    </button>
  )
}
