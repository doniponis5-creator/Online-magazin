'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useCart } from '@/lib/cart/CartProvider'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconCart, IconGrid, IconHeart, IconHome } from './Icons'

export function BottomNav() {
  const { t, lang } = useI18n()
  const pathname = usePathname() || ''
  const cart = useCart()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

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
