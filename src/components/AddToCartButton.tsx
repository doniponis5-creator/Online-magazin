'use client'

import { useEffect, useRef, useState } from 'react'
import { useCart } from '@/lib/cart/CartProvider'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconCheck, IconCart } from './Icons'

/** Add-to-cart with short visual confirmation (state change, no fake success screens). */
export function AddToCartButton({
  productId,
  variantId,
  disabled,
  block,
  small,
  label,
}: {
  productId: string
  variantId: string
  disabled?: boolean
  block?: boolean
  small?: boolean
  label?: string
}) {
  const { t } = useI18n()
  const cart = useCart()
  const [added, setAdded] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const onClick = () => {
    cart.add(productId, variantId, 1)
    setAdded(true)
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
      disabled={disabled}
      aria-live="polite"
    >
      {added ? <IconCheck size={18} /> : <IconCart size={18} />}
      {added ? t.catalog.added : (label ?? t.catalog.addToCart)}
    </button>
  )
}
