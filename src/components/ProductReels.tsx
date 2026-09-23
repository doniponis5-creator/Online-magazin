'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { products, type Product } from '@/data/products'
import { categoryName } from '@/data/categories'
import { formatSom } from '@/lib/format'
import { useCart } from '@/lib/cart/CartProvider'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { REELS_FROM_SITE_KEY, REELS_INDEX_KEY, REELS_ORDER_KEY } from '@/lib/reelsSession'
import { AddToCartButton } from './AddToCartButton'
import { FavoriteButton } from './FavoriteButton'
import { ProductImage } from './ProductImage'
import { ShareButton } from './ShareButton'
import { IconArrowDown, IconCart, IconChevronRight, IconClose } from './Icons'
import './product-reels.css'

/**
 * «Лента»: товары всего каталога по одному на экран, листаются вверх, как
 * Reels. Порядок случайный и новый при каждом открытии с главной — в этом и
 * смысл: человек не знает, что выпадет следующим, и листает дальше.
 *
 * Каталог остаётся как был; лента — отдельная страница /reels, на которую
 * ведёт баннер с главной. Тема светлая, как весь сайт: тёмный экран «как в
 * Instagram» спорил бы с лимонным стилем. Видео у товаров нет — только фото,
 * поэтому фото на активном экране медленно приближается, чтобы кадр жил.
 *
 * Порядок и позиция хранятся в sessionStorage: человек открыл «Подробнее»,
 * вернулся — и он на том же товаре в том же порядке, а не на новом первом.
 * Баннер на главной перед переходом стирает сохранённое — оттуда лента
 * всегда начинается заново и вперемешку.
 */


function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function readSaved(): { list: Product[]; index: number } | null {
  try {
    const raw = sessionStorage.getItem(REELS_ORDER_KEY)
    if (!raw) return null
    const ids: string[] = JSON.parse(raw)
    const byId = new Map(products.map((p) => [p.id, p]))
    const list = ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p))
    // товары, которых не было в сохранённом порядке (каталог обновился), — в конец
    const seen = new Set(list.map((p) => p.id))
    for (const p of products) if (!seen.has(p.id)) list.push(p)
    const index = Number(sessionStorage.getItem(REELS_INDEX_KEY) ?? 0)
    return list.length ? { list, index: Number.isFinite(index) ? Math.min(Math.max(0, index), list.length - 1) : 0 } : null
  } catch {
    return null
  }
}

function saveOrder(list: Product[]) {
  try {
    sessionStorage.setItem(REELS_ORDER_KEY, JSON.stringify(list.map((p) => p.id)))
  } catch {
    // хранилище недоступно (приватный режим) — лента просто не запомнит порядок
  }
}

function IconShuffle({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="m15 15 6 6" />
      <path d="m4 4 5 5" />
    </svg>
  )
}

export function ProductReels() {
  const { t, lang } = useI18n()
  const router = useRouter()
  const cart = useCart()
  const [list, setList] = useState<Product[] | null>(null)
  const [active, setActive] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  // Каждая новая раздача — новый контейнер прокрутки (key). Прокручивать
  // старый к нулю нельзя: scroll-snap помнит не позицию, а элемент, и после
  // перестановки слайдов браузер «доснапывает» к прежнему товару, который
  // оказался где-то в середине. Новый контейнер начинается с нуля честно.
  const [round, setRound] = useState(0)
  const [startIndex, setStartIndex] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)

  // Список собираем после монтирования: у сервера и у клиента случайность
  // разная, и до монтирования слайды не рисуем — иначе React увидит разную
  // разметку. Сохранённый порядок (вернулись с карточки) — важнее нового.
  useEffect(() => {
    const saved = readSaved()
    const next = saved ? saved.list : shuffle(products)
    if (!saved) saveOrder(next)
    setList(next)
    setStartIndex(saved?.index ?? 0)
    if ((saved?.index ?? 0) > 0) setScrolled(true)
    setRound((r) => r + 1)
  }, [])

  // Стартовая позиция (вернулись с карточки) — сразу, без анимации
  useEffect(() => {
    const root = scroller.current
    if (!root || !list || startIndex === 0) return
    root.scrollTo({ top: startIndex * root.clientHeight })
    setActive(startIndex)
  }, [list, round, startIndex])

  const reshuffle = () => {
    setList((prev) => {
      const next = prev ? shuffle(prev) : prev
      if (next) saveOrder(next)
      return next
    })
    setActive(0)
    setStartIndex(0)
    setScrolled(false)
    setRound((r) => r + 1)
  }

  // «Закрыть»: назад — только если пришли со своего сайта. history.length
  // считает все записи вкладки, и после перехода из Instagram или Google
  // «назад» увёл бы с сайта. Признак своего сайта ставит баннер на главной.
  const close = useCallback(() => {
    let fromSite = false
    try {
      fromSite = sessionStorage.getItem(REELS_FROM_SITE_KEY) === '1'
        || (document.referrer !== '' && new URL(document.referrer).origin === location.origin)
    } catch {
      fromSite = false
    }
    if (fromSite && window.history.length > 1) router.back()
    else router.push(`/${lang}`)
  }, [router, lang])

  // Страница под лентой не должна прокручиваться; фокус — внутрь ленты,
  // иначе клавиатура и читалка экрана остаются в шапке под оверлеем.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtn.current?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Какой экран сейчас виден — для счётчика, оживления фото и возврата
  useEffect(() => {
    const root = scroller.current
    if (!root || !list) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const i = Number((e.target as HTMLElement).dataset.index)
          setActive(i)
          try {
            sessionStorage.setItem(REELS_INDEX_KEY, String(i))
          } catch {
            // без хранилища — просто не запомним позицию
          }
        }
      },
      { root, threshold: 0.6 },
    )
    root.querySelectorAll<HTMLElement>('[data-index]').forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [list, round])

  // Стрелки и Esc — для компьютера
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const root = scroller.current
      if (!root) return
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault()
        root.scrollBy({ top: root.clientHeight, behavior })
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        root.scrollBy({ top: -root.clientHeight, behavior })
      } else if (e.key === 'Escape') {
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const total = list?.length ?? 0
  const cartCount = cart.hydrated ? cart.itemsCount : 0

  return (
    <div className="reels" role="dialog" aria-modal="true" aria-label={t.reels.title} aria-busy={!list}>
      <div className="reels__bar">
        <h1 className="reels__title">{t.reels.title}</h1>
        {total > 0 && (
          <span className="reels__counter">
            {active + 1} / {total}
          </span>
        )}
        {/* Корзина: полоска корзины и нижняя панель лежат под лентой, а положить
            товар отсюда можно — значит, и дойти до корзины должно быть можно */}
        <Link href={`/${lang}/cart`} className="reels__icon-btn reels__cart" aria-label={`${t.nav.cart}${cartCount ? ` (${cartCount})` : ''}`} title={t.nav.cart}>
          <IconCart size={20} />
          {cartCount > 0 && <span className="reels__cart-count" aria-hidden="true">{cartCount}</span>}
        </Link>
        <button type="button" className="reels__icon-btn" onClick={reshuffle} aria-label={t.reels.shuffle} title={t.reels.shuffle}>
          <IconShuffle />
        </button>
        <button ref={closeBtn} type="button" className="reels__icon-btn" onClick={close} aria-label={t.reels.close} title={t.reels.close}>
          <IconClose size={22} />
        </button>
      </div>

      <div
        key={round}
        className="reels__scroller"
        ref={scroller}
        onScroll={(e) => {
          if (!scrolled && e.currentTarget.scrollTop > 1) setScrolled(true)
        }}
      >
        {list && list.length === 0 && <p className="reels__empty">{t.reels.empty}</p>}
        {list?.map((p, i) => (
          <ReelsSlide key={p.id} product={p} index={i} active={i === active} hint={i === 0 && !scrolled && total > 1 ? t.reels.hint : null} />
        ))}
      </div>
    </div>
  )
}

function ReelsSlide({
  product,
  index,
  active,
  hint,
}: {
  product: Product
  index: number
  active: boolean
  hint: string | null
}) {
  const { t, lang } = useI18n()
  const ky = lang === 'ky'
  const name = ky ? product.nameKy : product.nameRu
  const href = `/${lang}/product/${product.id}`
  const variant = product.variants[0]
  const inStock = variant.stock > 0
  const specs = product.specs.slice(0, 3)
  const pct = product.oldPrice && product.oldPrice > product.price ? Math.round((1 - product.price / product.oldPrice) * 100) : 0

  return (
    <article className={`reels__slide${active ? ' is-active' : ''}`} data-index={index}>
      <div className="reels__media">
        <div className="reels__badges">
          {pct > 0 && <span className="badge reels__badge-sale">−{pct}%</span>}
          {product.badge === 'hit' && <span className="badge badge--hit">{t.catalog.badgeHit}</span>}
          {product.badge === 'new' && <span className="badge badge--new">{t.catalog.badgeNew}</span>}
        </div>
        <div className="reels__side">
          <FavoriteButton productId={product.id} />
          <ShareButton variant="icon" title={name} text={product.price > 0 ? `${name} — ${formatSom(product.price)}` : name} path={href} />
        </div>
        <Link href={href} className="reels__media-link" aria-label={name} tabIndex={-1}>
          <ProductImage kind={product.art} image={product.image} alt={name} />
        </Link>
        {hint && (
          <span className="reels__hint" aria-hidden="true">
            {hint}
            <IconArrowDown size={16} />
          </span>
        )}
      </div>
      <div className="reels__body">
        <span className="reels__cat">{categoryName(product.categoryId, lang)}</span>
        <h2 className="reels__name">
          <Link href={href}>{name}</Link>
        </h2>
        {specs.length > 0 && (
          <ul className="reels__specs">
            {specs.map((s) => (
              <li key={s.labelRu}>
                <span>{ky ? s.labelKy : s.labelRu}</span>
                {ky ? s.valueKy : s.valueRu}
              </li>
            ))}
          </ul>
        )}
        <div className="reels__prices">
          {product.price > 0 ? (
            <>
              <span className={`reels__price${product.oldPrice ? ' is-sale' : ''}`}>{formatSom(product.price)}</span>
              {product.oldPrice ? <s className="reels__old">{formatSom(product.oldPrice)}</s> : null}
            </>
          ) : (
            <span className="reels__price reels__price--request">{t.catalog.priceOnRequest}</span>
          )}
        </div>
        <div className="reels__actions">
          {/* Без цены в корзину не положить — остаётся только «Подробнее» на всю ширину */}
          {product.price <= 0 ? null : inStock ? (
            <AddToCartButton productId={product.id} variantId={variant.id} block />
          ) : (
            <button type="button" className="btn btn--outline btn--block" disabled>
              {t.catalog.outOfStock}
            </button>
          )}
          <Link href={href} className={`btn ${product.price <= 0 ? 'btn--primary btn--block' : 'btn--outline'} reels__more`}>
            {t.reels.details}
            <IconChevronRight size={18} />
          </Link>
        </div>
      </div>
    </article>
  )
}
