'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import type { CustomerOrderItem } from '@/lib/customer/gateway'
import { formatSom } from '@/lib/format'
import { MAX_PHOTOS, MAX_TEXT, MIN_TEXT, isBought } from '@/lib/reviews/rules'
import { shrinkPhoto } from '@/lib/reviews/shrink'
import { fill, reviewDate, reviewTexts } from '@/lib/reviews/texts'
import { IconCamera, IconCheck, IconClose, IconStar } from './Icons'
import './reviews.css'

/**
 * «Оцените покупку» — самый верх личного кабинета.
 *
 * Внизу кабинета форму никто не находил, поэтому она стоит первой. Видна,
 * только пока есть что оценить: оплаченный заказ без отзыва. Всё оценено —
 * плашки нет, место под бонусы и заказы не занимает.
 *
 * Неоплаченные заказы сюда не попадают: отзыв пишет тот, кто купил.
 * Проверяет это и сервер сайта — кнопку можно подделать, заказ в SBonus нельзя.
 */
export function AccountReviews({ orders }: { orders: CustomerOrderItem[] }) {
  const { lang } = useI18n()
  const t = reviewTexts(lang)
  const bought = orders.filter((o) => isBought(o.status))
  const ids = bought.map((o) => o.orderId).join(',')
  // Отзывы, оставленные раньше; null — ещё не знаем (плашку не показываем,
  // иначе она мигнёт и исчезнет у того, кто всё уже оценил).
  const [earlier, setEarlier] = useState<string[] | null>(null)
  // Оценённые сейчас: остаются в списке с галочкой до следующего захода.
  const [justDone, setJustDone] = useState<string[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [thanks, setThanks] = useState(false)
  const box = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!ids) return
    let alive = true
    fetch(`/api/reviews/mine?ids=${encodeURIComponent(ids)}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { ok?: boolean; reviewed?: string[] } | null) => {
        // Не ответил — показываем все заказы: второй отзыв сервер всё равно не примет.
        if (alive) setEarlier(data?.ok && Array.isArray(data.reviewed) ? data.reviewed : [])
      })
      .catch(() => alive && setEarlier([]))
    return () => {
      alive = false
    }
  }, [ids])

  const rows = earlier === null ? [] : bought.filter((o) => !earlier.includes(o.orderId))

  // Пришли по ссылке «Оставить отзыв» с главной — показываем плашку сразу.
  const shown = rows.length > 0
  useEffect(() => {
    if (shown && window.location.hash === '#reviews') box.current?.scrollIntoView({ block: 'start' })
  }, [shown])

  if (!shown) return null

  return (
    <section className="account-reviews" id="reviews" ref={box} aria-labelledby="account-reviews-title">
      <div className="account-reviews__head">
        <span className="account-reviews__stars" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((n) => (
            <IconStar key={n} size={18} filled />
          ))}
        </span>
        <h2 id="account-reviews-title">{t.formTitle}</h2>
        <p className="account-reviews__lead">{t.formLead}</p>
      </div>
      {thanks && (
        <p className="account-reviews__thanks" role="status">
          <IconCheck size={18} />
          {t.thanks}
        </p>
      )}
      <ul className="account-reviews__list">
        {rows.map((order) => {
          const done = justDone.includes(order.orderId)
          return (
            <li key={order.orderId}>
              <div className="account-reviews__row">
                <span>
                  <strong>{fill(t.order, { id: order.orderId })}</strong>
                  <small>
                    {order.createdAt && `${reviewDate(order.createdAt, lang)} · `}
                    {formatSom(order.total)}
                  </small>
                </span>
                {done ? (
                  <span className="account-reviews__done">
                    <IconCheck size={16} />
                    {t.done}
                  </span>
                ) : (
                  open !== order.orderId && (
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => {
                        setThanks(false)
                        setOpen(order.orderId)
                      }}
                    >
                      {t.write}
                    </button>
                  )
                )}
              </div>
              {open === order.orderId && !done && (
                <ReviewForm
                  orderId={order.orderId}
                  onCancel={() => setOpen(null)}
                  onDone={(already) => {
                    setJustDone((list) => [...list, order.orderId])
                    setOpen(null)
                    setThanks(!already)
                  }}
                />
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Пришёл по ссылке «Оставить отзыв», а вход не выполнен — объясняем, зачем
 * входить и каким номером. Без этого человек видел только форму входа и не
 * понимал, где же отзыв.
 */
export function ReviewLoginHint() {
  const { lang } = useI18n()
  const t = reviewTexts(lang)
  const [fromReviews, setFromReviews] = useState(false)
  useEffect(() => setFromReviews(window.location.hash === '#reviews'), [])
  if (!fromReviews) return null
  return (
    <p className="account-reviews__hint" role="note">
      <IconStar size={18} filled />
      {t.loginHint}
    </p>
  )
}

type Photo = { blob: Blob; thumb: Blob | null; url: string }
type ErrorKey = keyof ReturnType<typeof reviewTexts>['errors']

function ReviewForm({
  orderId,
  onDone,
  onCancel,
}: {
  orderId: string
  onDone: (already: boolean) => void
  onCancel: () => void
}) {
  const { lang } = useI18n()
  const t = reviewTexts(lang)
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [busy, setBusy] = useState<'photos' | 'send' | null>(null)
  const [error, setError] = useState<ErrorKey | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const firstStar = useRef<HTMLButtonElement>(null)
  const textBox = useRef<HTMLTextAreaElement>(null)
  const errorId = `review-error-${orderId}`
  const kept = useRef<Photo[]>([])
  kept.current = photos

  // Превью живут в памяти браузера — освобождаем, когда форма закрыта.
  useEffect(() => () => kept.current.forEach((p) => URL.revokeObjectURL(p.url)), [])

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    const room = MAX_PHOTOS - photos.length
    const list = Array.from(files).slice(0, room)
    if (files.length > room) setError('photos')
    setBusy('photos')
    const added: Photo[] = []
    for (const file of list) {
      try {
        const { full, thumb } = await shrinkPhoto(file)
        added.push({ blob: full, thumb, url: URL.createObjectURL(thumb ?? full) })
      } catch (reason) {
        setError((reason as Error).message === 'photo-size' ? 'photo-size' : 'photo-bad')
      }
    }
    setPhotos((current) => [...current, ...added].slice(0, MAX_PHOTOS))
    setBusy(null)
    if (picker.current) picker.current.value = ''
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      URL.revokeObjectURL(current[index].url)
      return current.filter((_, i) => i !== index)
    })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    // Ошибка — фокус сразу на поле, где её исправлять.
    if (!rating) {
      setError('rating')
      return firstStar.current?.focus()
    }
    if (text.trim().length < MIN_TEXT) {
      setError('text')
      return textBox.current?.focus()
    }
    setError(null)
    setBusy('send')
    const body = new FormData()
    body.set('orderId', orderId)
    body.set('rating', String(rating))
    body.set('text', text)
    photos.forEach((photo, i) => body.append('photos', photo.blob, `photo-${i + 1}.jpg`))
    // Копии идут парой к фото по порядку — только если есть у всех, иначе сдвинутся.
    if (photos.every((photo) => photo.thumb)) {
      photos.forEach((photo, i) => body.append('thumbs', photo.thumb!, `photo-${i + 1}-s.jpg`))
    }
    const response = await fetch('/api/reviews', { method: 'POST', body }).catch(() => null)
    const data = (await response?.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    setBusy(null)
    if (response?.ok && data?.ok) return onDone(false)
    if (data?.error === 'already') return onDone(true)
    const key = data?.error as ErrorKey | undefined
    setError(key && key in t.errors ? key : 'server')
  }

  const message = error ? fill(t.errors[error], { n: MAX_PHOTOS }) : ''

  return (
    <form className="review-form" onSubmit={submit} noValidate>
      <fieldset className="review-form__rating" aria-describedby={error === 'rating' ? errorId : undefined}>
        <legend className="field__label">{t.rating}</legend>
        <div className="review-form__scale">
          <div className={`review-form__stars${error === 'rating' ? ' is-invalid' : ''}`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                ref={n === 1 ? firstStar : undefined}
                type="button"
                className={n <= rating ? 'is-on' : undefined}
                aria-pressed={n === rating}
                aria-label={`${fill(t.stars, { n })} — ${t.ratingWords[n - 1]}`}
                onClick={() => {
                  setRating(n)
                  if (error === 'rating') setError(null)
                }}
              >
                <IconStar size={30} filled={n <= rating} />
              </button>
            ))}
          </div>
          <span className="review-form__word" aria-live="polite">
            {rating ? t.ratingWords[rating - 1] : ''}
          </span>
        </div>
      </fieldset>

      <label className={`field${error === 'text' ? ' field--error' : ''}`}>
        <span className="field__label">{t.text}</span>
        <textarea
          ref={textBox}
          aria-invalid={error === 'text' || undefined}
          aria-describedby={error === 'text' ? errorId : undefined}
          value={text}
          maxLength={MAX_TEXT}
          rows={4}
          placeholder={t.textHint}
          onChange={(event) => {
            setText(event.target.value)
            if (error === 'text') setError(null)
          }}
        />
        <small className="review-form__count">
          {text.length} / {MAX_TEXT}
        </small>
      </label>

      <div className="review-form__photos">
        <span className="field__label">{fill(t.photos, { n: MAX_PHOTOS })}</span>
        <div className="review-form__thumbs">
          {photos.map((photo, index) => (
            <span key={photo.url} className="review-form__thumb">
              <img src={photo.url} alt="" />
              <button type="button" onClick={() => removePhoto(index)} aria-label={t.removePhoto}>
                <IconClose size={14} />
              </button>
            </span>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              className="review-form__add"
              onClick={() => picker.current?.click()}
              disabled={busy !== null}
            >
              <IconCamera size={22} />
              <span>{busy === 'photos' ? t.preparing : t.addPhoto}</span>
            </button>
          )}
        </div>
        <input
          ref={picker}
          type="file"
          // image/*, без HEIC в списке: тогда iPhone сам отдаёт фото в JPEG.
          accept="image/*"
          multiple
          hidden
          onChange={(event) => addPhotos(event.target.files)}
        />
      </div>

      {message && (
        <p className="field__error" role="alert" id={errorId}>
          {message}
        </p>
      )}

      <div className="account-actions review-form__actions">
        <button type="submit" className="btn btn--primary" disabled={busy !== null}>
          {busy === 'send' ? t.sending : t.send}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy === 'send'}>
          {t.cancel}
        </button>
      </div>
    </form>
  )
}
