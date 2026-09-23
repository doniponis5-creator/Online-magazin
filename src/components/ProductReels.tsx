'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { products, type Product } from '@/data/products'
import { categoryName } from '@/data/categories'
import { formatSom } from '@/lib/format'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { AddToCartButton } from './AddToCartButton'
import { FavoriteButton } from './FavoriteButton'
import { ProductImage } from './ProductImage'
import { IconArrowDown, IconChevronRight, IconClose } from './Icons'
import './product-reels.css'

/**
 * «Лента»: товары всего каталога по одному на экран, листаются вверх, как
 * Reels. Порядок случайный и новый при каждом открытии — в этом и смысл:
 * человек не знает, что выпадет следующим, и листает дальше.
 *
 * Каталог остаётся как был; лента — отдельная страница /reels, на которую
 * ведёт баннер с главной. Тема светлая, как весь сайт: тёмный экран «как в
 * Instagram» спорил бы с лимонным стилем. Видео у товаров нет — только фото,
 * поэтому фото на активном экране медленно приближается, чтобы кадр жил.
 */

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
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
  const [list, setList] = useState<Product[] | null>(null)
  const [active, setActive] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  // Перемешиваем после монтирования: у сервера и у клиента случайность разная,
  // и до монтирования список не рисуем — иначе React увидит разную разметку.
  useEffect(() => {
    setList(shuffle(products.filter((p) => p.price > 0)))
  }, [])

  const reshuffle = () => {
    setList((prev) => (prev ? shuffle(prev) : prev))
    setActive(0)
    setScrolled(false)
    scroller.current?.scrollTo({ top: 0 })
  }

  const close = useCallback(() => {
    if (window.history.length > 1) router.back()
    else router.push(`/${lang}`)
  }, [router, lang])

  // Страница под лентой не должна прокручиваться
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Какой экран сейчас виден — для счётчика и оживления фото
  useEffect(() => {
    const root = scroller.current
    if (!root || !list) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index))
        }
      },
      { root, threshold: 0.6 },
    )
    root.querySelectorAll<HTMLElement>('[data-index]').forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [list])

  // Стрелки и Esc — для компьютера
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const root = scroller.current
      if (!root) return
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault()
        root.scrollBy({ top: root.clientHeight, behavior: 'smooth' })
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        root.scrollBy({ top: -root.clientHeight, behavior: 'smooth' })
      } else if (e.key === 'Escape') {
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const total = list?.length ?? 0

  return (
    <div className="reels" role="dialog" aria-label={t.reels.title} aria-busy={!list}>
      <div className="reels__bar">
        <span className="reels__title">{t.reels.title}</span>
        {total > 0 && (
          <span className="reels__counter" aria-live="polite">
            {active + 1} / {total}
          </span>
        )}
        <button type="button" className="reels__icon-btn" onClick={reshuffle} aria-label={t.reels.shuffle} title={t.reels.shuffle}>
          <IconShuffle />
        </button>
        <button type="button" className="reels__icon-btn" onClick={close} aria-label={t.reels.close} title={t.reels.close}>
          <IconClose size={22} />
        </button>
      </div>

      <div
        className="reels__scroller"
        ref={scroller}
        onScroll={() => {
          if (!scrolled) setScrolled(true)
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
        <div className="reels__fav">
          <FavoriteButton productId={product.id} />
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
          <span className={`reels__price${product.oldPrice ? ' is-sale' : ''}`}>{formatSom(product.price)}</span>
          {product.oldPrice ? <s className="reels__old">{formatSom(product.oldPrice)}</s> : null}
        </div>
        <div className="reels__actions">
          {inStock ? (
            <AddToCartButton productId={product.id} variantId={variant.id} block />
          ) : (
            <button type="button" className="btn btn--outline btn--block" disabled>
              {t.catalog.outOfStock}
            </button>
          )}
          <Link href={href} className="btn btn--outline reels__more">
            {t.reels.details}
            <IconChevronRight size={18} />
          </Link>
        </div>
      </div>
    </article>
  )
}
