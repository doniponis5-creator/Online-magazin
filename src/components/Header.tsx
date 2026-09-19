'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState, type FormEvent } from 'react'
import { categories } from '@/data/categories'
import { useCart } from '@/lib/cart/CartProvider'
import { useFavorites } from '@/lib/favorites/FavoritesProvider'
import { buildCatalogHref, buildLangHref } from '@/lib/links'
import { otherLang, type Lang } from '@/lib/i18n/config'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconCart, IconGrid, IconHeart, IconMapPin, IconSearch, IconUser } from './Icons'
import { Brand } from './Brand'

function HeaderInner() {
  const { t, lang } = useI18n()
  const pathname = usePathname() || `/${lang}`
  const searchParams = useSearchParams()
  const router = useRouter()
  const cart = useCart()
  const fav = useFavorites()
  const [mounted, setMounted] = useState(false)
  // при загрузке сразу на /catalog?q=... поле поиска показывает активный запрос
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')

  // Шапка уезжает вверх, когда человек листает вниз, и возвращается, когда
  // он листает обратно. На маленьком экране это отдаёт витрине две строки
  // высоты, а поиск всегда в одном движении пальца.
  const [hidden, setHidden] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    // Телефон умеет отдавать сотни событий прокрутки в секунду. Считаем не
    // чаще, чем рисуется кадр, иначе листание становится рваным.
    let last = window.scrollY
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const y = window.scrollY
        const delta = y - last
        // Дрожание пальца и «резиновый» отскок в конце страницы не считаем.
        if (Math.abs(delta) < 8) return
        last = y
        // У самого верха шапка всегда на месте: прятать нечего.
        setHidden(y > 140 && delta > 0)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  const activeQuery = searchParams.get('q') ?? ''
  useEffect(() => setQuery(activeQuery), [activeQuery])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    router.push(buildCatalogHref(lang, { q: query }))
  }

  const cartCount = mounted ? cart.itemsCount : 0
  const favCount = mounted ? fav.ids.length : 0
  const search = searchParams.toString() ? `?${searchParams.toString()}` : ''

  return (
    <>
      {/* Полоса под часами и значком батареи. Без неё товары видно сквозь них,
          когда шапка уехала вверх. На компьютере её высота — ноль. */}
      <div className="safe-top" aria-hidden="true" />
      <header className={`header${hidden ? ' is-hidden' : ''}`}>
      <div className="container">
        <div className="header__utility">
          <span><IconMapPin size={14} />{lang === 'ky' ? 'Бүт Кыргызстан боюнча' : 'По всему Кыргызстану'}</span>
        </div>
        <div className="header__inner">
          <Link href={`/${lang}`} className="logo" aria-label="Smart Centr">
            <Brand />
          </Link>

          <Link href={`/${lang}/catalog`} className="btn btn--primary btn--sm header__catalog-btn">
            <IconGrid size={18} />
            {t.nav.openCatalog}
          </Link>

          <form className="header__search" role="search" onSubmit={onSearch}>
            <div className="search">
              <span className="search__icon">
                <IconSearch size={19} />
              </span>
              <input
                type="search"
                className="search__input"
                placeholder={t.nav.searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={t.nav.searchPlaceholder}
              />
            </div>
          </form>

          <div className="header__actions">
            <Link href={`/${lang}/account`} className="icon-btn" aria-label={lang === 'ky' ? 'Жеке кабинет' : 'Личный кабинет'}>
              <IconUser size={22} /><span className="header__action-label">{lang === 'ky' ? 'Кабинет' : 'Кабинет'}</span>
            </Link>
            <nav className="lang-switch" aria-label={t.a11y.langSwitch}>
              <Link
                href={buildLangHref(pathname, search, lang)}
                className="lang-switch__item"
                aria-current="true"
                aria-label={t.a11y.currentLang}
              >
                {t.langName}
              </Link>
              <Link
                href={buildLangHref(pathname, search, otherLang[lang])}
                className="lang-switch__item"
                aria-label={t.a11y.switchToOther}
                hrefLang={otherLang[lang]}
              >
                {t.otherLangName}
              </Link>
            </nav>

            <Link
              href={`/${lang}/favorites`}
              className={`icon-btn${favCount > 0 ? ' is-active' : ''}`}
              aria-label={`${t.nav.toFavorites}${mounted && favCount ? ` (${favCount})` : ''}`}
            >
              <IconHeart size={22} />
              <span className="header__action-label">{t.nav.favorites}</span>
              {mounted && favCount > 0 && (
                <span className="icon-btn__badge" aria-hidden="true">
                  {favCount}
                </span>
              )}
            </Link>

            <Link
              href={`/${lang}/cart`}
              className={`icon-btn${cartCount > 0 ? ' is-active' : ''}`}
              aria-label={`${t.nav.toCart}${mounted && cartCount ? ` (${cartCount})` : ''}`}
            >
              <IconCart size={22} />
              <span className="header__action-label">{t.nav.cart}</span>
              {mounted && cartCount > 0 && (
                <span className="icon-btn__badge" aria-hidden="true">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        <nav className="header__subnav" aria-label={t.categories.title}>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={buildCatalogHref(lang, { cat: c.id })}
              className="subnav__link"
            >
              {lang === 'ky' ? c.nameKy : c.nameRu}
            </Link>
          ))}
          <span className="header__city">
            <IconMapPin size={16} />
            {t.city}
          </span>
        </nav>
      </div>
      </header>
    </>
  )
}

export function Header() {
  return (
    <Suspense fallback={<div className="header" aria-hidden="true" />}>
      <HeaderInner />
    </Suspense>
  )
}
