'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { countWithNoun } from '@/lib/format'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { thumbOf, type PublicReview } from '@/lib/reviews/rules'
import { fill, reviewDate, reviewTexts } from '@/lib/reviews/texts'
import { IconCamera, IconCheck, IconChevronLeft, IconChevronRight, IconClose, IconStar } from './Icons'
import './reviews.css'

const photoUrl = (name: string) => `/api/reviews/photo/${name}`
/** В карточке — маленькая копия; большое фото грузится только в окне. */
const thumbUrl = (name: string) => photoUrl(thumbOf(name))

/** Длинный текст сворачиваем — ряд карточек остаётся ровным. */
const LONG_TEXT = 220

export function ReviewStars({ value, label, size = 16 }: { value: number; label: string; size?: number }) {
  return (
    <span className="review-stars" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <IconStar key={n} size={size} filled={n <= value} className={n <= value ? 'is-on' : undefined} />
      ))}
    </span>
  )
}

type Viewer = { review: PublicReview; index: number }

/**
 * Отзывы покупателей на главной: 20 последних, новые первыми.
 *
 * Список спрашиваем при каждом открытии страницы — новый отзыв виден сразу.
 * Отзывов нет — блока нет совсем: пустая полка «Отзывы» выглядит хуже,
 * чем её отсутствие.
 *
 * Фото покупателя — главное в карточке: оно убеждает сильнее любого текста,
 * поэтому первое фото стоит обложкой, а не мелкой плиткой.
 */
export function CustomerReviews() {
  const { lang } = useI18n()
  const t = reviewTexts(lang)
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [viewer, setViewer] = useState<Viewer | null>(null)
  // Куда можно листать ряд: стрелки гаснут на краях и прячутся, если листать некуда.
  const [edges, setEdges] = useState({ start: true, end: true })
  const row = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/reviews', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { ok?: boolean; reviews?: PublicReview[] } | null) => {
        if (alive && data?.ok && Array.isArray(data.reviews)) setReviews(data.reviews)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  const measure = useCallback(() => {
    const el = row.current
    if (!el) return
    setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 })
  }, [])

  useEffect(() => {
    const el = row.current
    if (!el) return
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(el)
    el.addEventListener('scroll', measure, { passive: true })
    return () => {
      resize.disconnect()
      el.removeEventListener('scroll', measure)
    }
  }, [measure, reviews.length])

  const scroll = useCallback((direction: 1 | -1) => {
    const el = row.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('.review-card')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: direction * ((card?.offsetWidth ?? 320) + 16), behavior: reduce ? 'auto' : 'smooth' })
  }, [])

  if (reviews.length === 0) return null

  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
  const averageText = average.toFixed(1).replace('.', ',')
  const scrollable = !(edges.start && edges.end)

  return (
    <section className="section reviews" aria-labelledby="reviews-title">
      <div className="section__head">
        <h2 className="section__title" id="reviews-title">{t.title}</h2>
        <Link className="section__cta" href={`/${lang}/account#reviews`}>
          {t.write}
          <IconChevronRight size={16} />
        </Link>
      </div>

      <div className="reviews__bar">
        <p className="reviews__score">
          <ReviewStars value={Math.round(average)} label={fill(t.average, { avg: averageText })} size={18} />
          <strong>{averageText}</strong>
          <span className="reviews__count">{countWithNoun(reviews.length, ...t.count)}</span>
          <span className="reviews__trust">
            <IconCheck size={15} />
            {t.lead}
          </span>
        </p>
        {scrollable && (
          <span className="reviews__arrows">
            <button type="button" className="reviews__arrow" onClick={() => scroll(-1)} disabled={edges.start} aria-label={t.prev}>
              <IconChevronLeft size={20} />
            </button>
            <button type="button" className="reviews__arrow" onClick={() => scroll(1)} disabled={edges.end} aria-label={t.next}>
              <IconChevronRight size={20} />
            </button>
          </span>
        )}
      </div>

      <div className="reviews__row" ref={row}>
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} onPhoto={(index) => setViewer({ review, index })} />
        ))}
      </div>

      {viewer && <PhotoViewer review={viewer.review} start={viewer.index} onClose={() => setViewer(null)} />}
    </section>
  )
}

function ReviewCard({ review, onPhoto }: { review: PublicReview; onPhoto: (index: number) => void }) {
  const { lang } = useI18n()
  const t = reviewTexts(lang)
  const [open, setOpen] = useState(false)
  const [cover, ...more] = review.photos
  const long = review.text.length > (cover ? LONG_TEXT : LONG_TEXT * 2)
  const [first, ...rest] = review.products
  // Без фото короткий отзыв набираем крупно, как цитату: «Всё отлично»
  // мелким шрифтом терялось в пустой карточке.
  const voice = cover ? '' : review.text.length <= 70 ? ' is-short' : review.text.length <= 180 ? ' is-medium' : ''

  return (
    <article className={`review-card${cover ? ' has-cover' : ''}`}>
      {cover && (
        <button type="button" className="review-card__cover" onClick={() => onPhoto(0)} aria-label={fill(t.photo, { n: 1 })}>
          <img src={thumbUrl(cover)} alt="" loading="lazy" decoding="async" />
          {more.length > 0 && (
            <span className="review-card__count" aria-hidden="true">
              <IconCamera size={15} />
              {review.photos.length}
            </span>
          )}
        </button>
      )}

      <div className="review-card__body">
        <div className="review-card__top">
          <ReviewStars value={review.rating} label={fill(t.stars, { n: review.rating })} />
          <time dateTime={review.createdAt}>{reviewDate(review.createdAt, lang)}</time>
        </div>
        <p className={`review-card__text${voice}${long && !open ? ' is-clamped' : ''}`}>{review.text}</p>
        {long && (
          <button type="button" className="link-btn review-card__more" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? t.readLess : t.readMore}
          </button>
        )}
        {more.length > 0 && (
          <div className="review-card__thumbs">
            {more.map((name, i) => (
              <button key={name} type="button" onClick={() => onPhoto(i + 1)} aria-label={fill(t.photo, { n: i + 2 })}>
                <img src={thumbUrl(name)} alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        )}
      </div>

      <footer className="review-card__who">
        <span className="review-card__avatar" aria-hidden="true">
          {review.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="review-card__person">
          <strong>{review.name}</strong>
          <span className="review-card__badge">
            <IconCheck size={13} />
            {t.verified}
          </span>
        </span>
        {first && (
          <small className="review-card__bought" title={review.products.join(', ')}>
            {t.bought} {first}
            {rest.length > 0 && ` ${fill(t.more, { n: rest.length })}`}
          </small>
        )}
      </footer>
    </article>
  )
}

/**
 * Фото во весь экран — тот же вид, что увеличение фото товара: белая сцена
 * над затемнением. Листается стрелками, клавишами и пальцем; Esc и тап по
 * затемнению закрывают.
 */
function PhotoViewer({ review, start, onClose }: { review: PublicReview; start: number; onClose: () => void }) {
  const { lang } = useI18n()
  const t = reviewTexts(lang)
  const dialog = useRef<HTMLDialogElement>(null)
  const touch = useRef<number | null>(null)
  const [index, setIndex] = useState(start)
  const photos = review.photos
  const many = photos.length > 1
  const step = useCallback((by: number) => setIndex((i) => (i + by + photos.length) % photos.length), [photos.length])
  // Сначала закрываем сам диалог — браузер вернёт фокус на фото, с которого
  // открыли. Потом сразу убираем окно: событие close браузер присылает
  // с задержкой, а в фоновой вкладке может не прислать вовсе.
  const close = useCallback(() => {
    dialog.current?.close()
    onClose()
  }, [onClose])

  // Закрывать в уборке не нужно: окно уходит из страницы вместе с компонентом.
  useEffect(() => {
    const el = dialog.current
    if (el && !el.open) el.showModal()
    document.documentElement.classList.add('dialog-open')
    return () => document.documentElement.classList.remove('dialog-open')
  }, [])

  return (
    <dialog
      ref={dialog}
      className="review-viewer"
      aria-label={fill(t.photo, { n: index + 1 })}
      onClose={onClose}
      onCancel={(event) => {
        // Esc — тем же путём, что и крестик.
        event.preventDefault()
        close()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') step(1)
        if (event.key === 'ArrowLeft') step(-1)
      }}
    >
      <figure
        className="review-viewer__stage"
        onTouchStart={(event) => {
          touch.current = event.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(event) => {
          const from = touch.current
          const to = event.changedTouches[0]?.clientX
          touch.current = null
          if (from === null || to === undefined || !many) return
          if (Math.abs(to - from) > 40) step(to < from ? 1 : -1)
        }}
      >
        <div className="review-viewer__photo">
          <img key={photos[index]} src={photoUrl(photos[index])} alt={fill(t.photo, { n: index + 1 })} />
        </div>
        <figcaption className="review-viewer__caption">
          <ReviewStars value={review.rating} label={fill(t.stars, { n: review.rating })} size={15} />
          <strong>{review.name}</strong>
          <span>{reviewDate(review.createdAt, lang)}</span>
          {many && (
            <span className="review-viewer__counter">
              {index + 1} / {photos.length}
            </span>
          )}
        </figcaption>
        <button type="button" className="review-viewer__close" onClick={close} aria-label={t.close}>
          <IconClose size={22} />
        </button>
        {many && (
          <>
            <button type="button" className="review-viewer__nav is-prev" onClick={() => step(-1)} aria-label={t.prev}>
              <IconChevronLeft size={24} />
            </button>
            <button type="button" className="review-viewer__nav is-next" onClick={() => step(1)} aria-label={t.next}>
              <IconChevronRight size={24} />
            </button>
          </>
        )}
      </figure>
    </dialog>
  )
}
