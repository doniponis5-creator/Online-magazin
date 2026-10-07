'use client'

import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import { formatSom } from '@/lib/format'
import { AddToCartButton } from './AddToCartButton'

/**
 * Телефон: главная кнопка страницы ниже первого экрана (аудит 07.10: «В корзину» на 1040 px при экране 812,
 * «Оформить заказ» в корзине — тоже за краем). Пока её не видно, внизу над меню — полоса с ценой и той же кнопкой.
 * Главная кнопка на экране — полосы нет, двух одинаковых кнопок рядом не бывает. На компьютере не показывается (CSS).
 * Пока полоса видна, у <html> класс buybar-on: напоминание о корзине уступает ей место, «Спросить» поднимается.
 */
export function StickyBar({ target, label, children }: { target: RefObject<HTMLElement | null>; label: string; children: ReactNode }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = target.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [target])

  useEffect(() => {
    const html = document.documentElement
    html.classList.toggle('buybar-on', shown)
    return () => html.classList.remove('buybar-on')
  }, [shown])

  if (!shown) return null
  return (
    <div className="buybar" role="region" aria-label={label}>
      {children}
    </div>
  )
}

/** Страница товара: цена и «В корзину». */
export function BuyBar({
  target,
  label,
  productId,
  variantId,
  price,
  oldPrice,
}: {
  target: RefObject<HTMLElement | null>
  /** подпись полосы для экранного диктора: «В корзину: <товар>» */
  label: string
  productId: string
  variantId: string
  price: number
  oldPrice?: number
}) {
  return (
    <StickyBar target={target} label={label}>
      <span className="buybar__prices">
        <b>{formatSom(price)}</b>
        {oldPrice ? <s>{formatSom(oldPrice)}</s> : null}
      </span>
      <AddToCartButton productId={productId} variantId={variantId} small />
    </StickyBar>
  )
}
