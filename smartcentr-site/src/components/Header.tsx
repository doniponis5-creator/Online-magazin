'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { categories } from '@/data/categories'
import { useCart } from '@/lib/cart/CartProvider'
import { useFavorites } from '@/lib/favorites/FavoritesProvider'
import { buildCatalogHref, buildLangHref } from '@/lib/links'
import { otherLang, type Lang } from '@/lib/i18n/config'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconCart, IconClose, IconGrid, IconHeart, IconMapPin, IconSearch, IconUser } from './Icons'
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
        // У самого верха шапка всегда на месте: прятать нечего. В конструкторе
        // кухни на телефоне (html.kp-pinned) шапка не возвращается, пока
        // человек листает настройки под 3D, — иначе 3D прыгал на её высоту.
        const pinned = document.documentElement.classList.contains('kp-pinned')
        setHidden(y > 140 && (delta > 0 || pinned))
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    // Конструктор кухни встал в экран (html.kp-pinned) — шапка уезжает сразу,
    // не дожидаясь движения пальца. Телефон боком сам доводит страницу до
    // конструктора, и шапка оставалась поверх 3D.
    const onPin = () => {
      if (document.documentElement.classList.contains('kp-pinned') && window.scrollY > 140) setHidden(true)
    }
    const pin = new MutationObserver(onPin)
    pin.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    // шапка приходит позже конструктора: он мог встать в экран ещё до неё
    onPin()
    return () => {
      window.removeEventListener('scroll', onScroll)
      pin.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  const activeQuery = searchParams.get('q') ?? ''
  const hideSearch = pathname.startsWith(`/${lang}/checkout`)
  useEffect(() => setQuery(activeQuery), [activeQuery])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    router.push(buildCatalogHref(lang, { q: query }))
  }

  /*
   * Клик по логотипу перезагружает главную целиком, как кнопка «обновить»
   * в браузере: владелец правит каталог в 1С и ждёт свежие данные сразу.
   * Ctrl/Cmd/средняя кнопка отданы браузеру — открыть в новой вкладке.
   */
  const reloadHome = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    window.location.href = `/${lang}`
  }

  const cartCount = mounted ? cart.itemsCount : 0
  const favCount = mounted ? fav.ids.length : 0
  const search = searchParams.toString() ? `?${searchParams.toString()}` : ''

  // «Вы здесь» — как в нижней навигации телефона: отмечаем раздел, где
  // человек сейчас, а не то, что в корзине что-то лежит (это видно по числу).
  const here = (path: string) => (pathname.startsWith(`/${lang}/${path}`) ? 'page' : undefined)
  const activeCat = pathname === `/${lang}/catalog` ? searchParams.get('cat') : null

  // На узком экране строка разделов листается вбок. Открытый раздел
  // подвозим в середину строки, чтобы он не прятался за краем.
  const subnavRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = subnavRef.current
    const cur = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !cur) return
    const n = nav.getBoundingClientRect()
    const c = cur.getBoundingClientRect()
    if (c.left < n.left || c.right > n.right) nav.scrollLeft += c.left - n.left - (n.width - c.width) / 2
  }, [pathname, activeCat])

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
          <Link href={`/${lang}`} className="logo" aria-label="Smart Centr" onClick={reloadHome}>
            <Brand />
          </Link>

          <Link href={`/${lang}/catalog`} className="btn btn--primary btn--sm header__catalog-btn">
            <IconGrid size={18} />
            {t.nav.openCatalog}
          </Link>

          {/* На оформлении заказа поиска нет: там человек заканчивает покупку,
              и любая ссылка «в сторону» — это брошенная корзина. На остальных
              страницах поиск остаётся: в магазине это главный способ найти
              товар, и убирать его из кабинета или корзины нельзя. */}
          <form
            className={`header__search${hideSearch ? ' is-hidden' : ''}`}
            role="search"
            onSubmit={onSearch}
            hidden={hideSearch}
          >
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
                aria-label={t.nav.searchLabel}
              />
              {/* Стереть набранное одним нажатием: на телефоне выделять и
                  удалять текст в поле неудобно. */}
              {query ? (
                <button
                  type="button"
                  className="search__clear"
                  onClick={() => setQuery('')}
                  aria-label={t.nav.searchClear}
                >
                  <IconClose size={16} />
                </button>
              ) : null}
            </div>
          </form>

          <div className="header__actions">
            {/* Язык стоит первым: три значка с подписями идут одной группой,
                а не разорваны надписью «RU | КЫР». */}
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
              href={`/${lang}/account`}
              className="icon-btn"
              aria-label={lang === 'ky' ? 'Жеке кабинет' : 'Личный кабинет'}
              aria-current={here('account')}
            >
              <IconUser size={22} /><span className="header__action-label">Кабинет</span>
            </Link>

            <Link
              href={`/${lang}/favorites`}
              className="icon-btn"
              aria-label={`${t.nav.toFavorites}${mounted && favCount ? ` (${favCount})` : ''}`}
              aria-current={here('favorites')}
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
              className="icon-btn"
              aria-label={`${t.nav.toCart}${mounted && cartCount ? ` (${cartCount})` : ''}`}
              aria-current={here('cart')}
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

        <nav className="header__subnav" aria-label={t.categories.title} ref={subnavRef}>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={buildCatalogHref(lang, { cat: c.id })}
              className="subnav__link"
              aria-current={activeCat === c.id ? 'page' : undefined}
            >
              {lang === 'ky' ? c.nameKy : c.nameRu}
            </Link>
          ))}
          <Link href={`/${lang}/kitchen`} className="subnav__link subnav__link--kitchen" aria-current={here('kitchen')}>
            {lang === 'ky' ? '3D-ашкана' : '3D-кухня'}
          </Link>
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
