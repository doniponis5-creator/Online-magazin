'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type MouseEvent, useEffect, useState } from 'react'
import { useCart } from '@/lib/cart/CartProvider'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconCart, IconGrid, IconHeart, IconHome, IconUser } from './Icons'

export function BottomNav() {
  const { t, lang } = useI18n()
  const pathname = usePathname() || ''
  const cart = useCart()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  /**
   * Нажал раздел, в котором уже находишься — страница уезжает наверх.
   * Раньше такое нажатие не делало ничего: человек долистал каталог до
   * середины, ткнул «Главная» или «Каталог» и не понимал, почему экран стоит.
   */
  const backToTop = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    // Только когда адрес совпадает целиком. На «/ru/catalog?cat=fridges»
    // раздел тоже считается активным, но нажатие должно сбросить фильтр и
    // открыть весь каталог — а не просто прокрутить страницу.
    if (window.location.pathname !== href || window.location.search !== '') return
    e.preventDefault()
    // Плавно — только с небольшой высоты. Из глубины длинного каталога плавная
    // прокрутка едет несколько секунд, и человек успевает подумать, что завис.
    const from = window.scrollY
    const smooth = from < 2600 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
    // Не во всех браузерах плавная прокрутка работает (встроенные окна
    // WhatsApp и Instagram её иногда молча игнорируют). Если через полсекунды
    // страница не сдвинулась — прыгаем сразу, лишь бы человек увидел верх.
    if (smooth) {
      setTimeout(() => {
        if (window.scrollY === from && from > 0) window.scrollTo({ top: 0, behavior: 'auto' })
      }, 500)
    }
  }

  const items = [
    { href: `/${lang}`, label: t.nav.home, icon: <IconHome size={22} />, match: (p: string) => p === `/${lang}` },
    { href: `/${lang}/catalog`, label: t.nav.catalog, icon: <IconGrid size={22} />, match: (p: string) => p.startsWith(`/${lang}/catalog`) },
    {
      href: `/${lang}/cart`,
      label: t.nav.cart,
      icon: <IconCart size={22} />,
      match: (p: string) => p.startsWith(`/${lang}/cart`),
      badge: mounted ? cart.itemsCount : 0,
    },
    {
      href: `/${lang}/favorites`,
      label: t.nav.favorites,
      icon: <IconHeart size={22} />,
      match: (p: string) => p.startsWith(`/${lang}/favorites`),
    },
    { href: `/${lang}/account`, label: lang === 'ky' ? 'Кабинет' : 'Кабинет', icon: <IconUser size={22} />, match: (p: string) => p.startsWith(`/${lang}/account`) },
  ]

  return (
    <nav className="bottom-nav" aria-label={t.a11y.bottomNav}>
      {items.map((item) => {
        const active = item.match(pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav__item${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={(e) => backToTop(e, item.href)}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge ? (
              <span className="bottom-nav__badge" aria-hidden="true">
                {item.badge}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
