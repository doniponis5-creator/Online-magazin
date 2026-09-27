'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { CustomerLogin } from '@/components/CustomerLogin'
import '@/components/account.css'
import type { Lang } from '@/lib/i18n/config'
import { MAX_COMMENT, MAX_REAL_PHOTOS, MIN_COMMENT, type GalleryComment } from '@/lib/gallery/rules'
import { errorText, galleryTexts } from '@/lib/gallery/texts'
import { shrinkPhoto } from '@/lib/reviews/shrink'

/**
 * Живая часть страницы кухни: фото «В 3D / В жизни», «Поделиться», оценка,
 * комментарии, жалобы, «Я сделал такую» и «Убрать из галереи».
 *
 * Не вошёл — действие открывает тот же вход, что в кабинете (`CustomerLogin`),
 * а после входа выполняется само, а страница обновляется (`router.refresh()`), чтобы
 * сервер заново узнал, своя ли кухня и какая у человека оценка. Ошибка API —
 * понятной фразой (too-many — по reason), введённый текст остаётся в поле.
 */

type Answer = { ok: true; [key: string]: unknown } | { ok: false; error: string; reason?: string }

async function call(url: string, init?: RequestInit): Promise<Answer> {
  const res = await fetch(url, { cache: 'no-store', ...init }).catch(() => null)
  if (!res) return { ok: false, error: 'network' }
  const data = (await res.json().catch(() => null)) as Answer | null
  return data && typeof data === 'object' && 'ok' in data ? data : { ok: false, error: 'save' }
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const LOGIN_EVENT = 'gallery-login'

/** Вход по требованию: `need(then)` — вошёл ли; нет — открыть вход и после него выполнить `then`. */
function useGate(initial: boolean, lang: Lang) {
  const router = useRouter()
  const logged = useRef(initial)
  const [pending, setPending] = useState<null | { run: () => void }>(null)
  useEffect(() => {
    const on = () => {
      logged.current = true
    }
    window.addEventListener(LOGIN_EVENT, on)
    return () => window.removeEventListener(LOGIN_EVENT, on)
  }, [])
  const ask = (then: () => void) => setPending({ run: then })
  const need = (then: () => void) => {
    if (logged.current) return true
    ask(then)
    return false
  }
  const again = (then: () => void) => {
    logged.current = false
    ask(then)
  }
  const dialog = pending ? (
    <LoginDialog
      lang={lang}
      onClose={() => setPending(null)}
      onDone={() => {
        logged.current = true
        window.dispatchEvent(new Event(LOGIN_EVENT))
        setPending(null)
        pending.run()
        router.refresh()
      }}
    />
  ) : null
  return { need, again, dialog }
}

function LoginDialog({ lang, onClose, onDone }: { lang: Lang; onClose: () => void; onDone: () => void }) {
  const t = galleryTexts(lang)
  return (
    <div className="gl-login" role="dialog" aria-modal="true" aria-labelledby="gl-login-title">
      <div className="gl-login__box">
        <button type="button" className="gl-login__close" onClick={onClose} aria-label={t.loginClose}>
          ×
        </button>
        <h2 id="gl-login-title" className="gl-login__title">
          {t.loginTitle}
        </h2>
        <p className="gl-muted">{t.loginLead}</p>
        <CustomerLogin onDone={() => onDone()} />
      </div>
    </div>
  )
}

/** Большая картинка: «В 3D» и — если автор добавил — «В жизни». */
export function KitchenMedia({ lang, title, image, photos }: { lang: Lang; title: string; image: string; photos: { full: string; thumb: string }[] }) {
  const t = galleryTexts(lang)
  const [tab, setTab] = useState<'3d' | 'life'>('3d')
  const [pick, setPick] = useState(0)
  const life = tab === 'life' && photos.length > 0
  const src = life ? photos[Math.min(pick, photos.length - 1)].full : image
  return (
    <div className="gl-media">
      {photos.length > 0 && (
        <div className="gl-media__tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!life} className={!life ? 'is-on' : ''} onClick={() => setTab('3d')}>
            {t.in3d}
          </button>
          <button type="button" role="tab" aria-selected={life} className={life ? 'is-on' : ''} onClick={() => setTab('life')}>
            {t.inLife} · {photos.length}
          </button>
        </div>
      )}
      <div className="gl-media__frame">
        {/* eslint-disable-next-line @next/next/no-img-element -- кадр 3D или фото из хранилища галереи */}
        <img src={src} alt={title} width={1200} height={750} />
        {!life && photos.length > 0 && (
          <button type="button" className="gl-media__peek" onClick={() => setTab('life')} aria-label={t.inLife}>
            {/* eslint-disable-next-line @next/next/no-img-element -- превью фото вживую */}
            <img src={photos[0].thumb} alt="" width={120} height={90} />
            <span>{t.inLife}</span>
          </button>
        )}
      </div>
      {life && photos.length > 1 && (
        <div className="gl-media__strip">
          {photos.map((p, i) => (
            <button key={p.full} type="button" className={i === pick ? 'is-on' : ''} onClick={() => setPick(i)} aria-label={`${t.inLife} ${i + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- превью фото вживую */}
              <img src={p.thumb} alt="" width={96} height={72} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ShareButton({ lang, title }: { lang: Lang; title: string }) {
  const t = galleryTexts(lang)
  const [done, setDone] = useState(false)
  const share = async () => {
    const url = window.location.href.split('#')[0]
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined)
      return
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined)
    setDone(true)
    setTimeout(() => setDone(false), 2500)
  }
  return (
    <button type="button" className="btn btn--outline gl-share" onClick={share}>
      {done ? t.copied : t.share}
    </button>
  )
}

function Problem({ children }: { children: ReactNode }) {
  return children ? (
    <p className="gl-error" role="alert">
      {children}
    </p>
  ) : null
}

/** Оценка 1–5: одна от человека, можно поменять; свою — нельзя. */
export function Rating(props: { lang: Lang; apiId: string; avg: number; count: number; stars: number | null; mine: boolean; loggedIn: boolean }) {
  const { lang, apiId, mine } = props
  const t = galleryTexts(lang)
  const gate = useGate(props.loggedIn, lang)
  const [avg, setAvg] = useState(props.avg)
  const [count, setCount] = useState(props.count)
  const [stars, setStars] = useState(props.stars)
  // после входа страница обновилась — сервер прислал оценку этого человека
  useEffect(() => setStars(props.stars), [props.stars])
  const [hover, setHover] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const rate = async (n: number) => {
    if (mine || busy) return
    if (!gate.need(() => rate(n))) return
    setBusy(true)
    setError('')
    const res = await call(`/api/gallery/${apiId}/rate`, json({ stars: n }))
    setBusy(false)
    if (res.ok) {
      setStars(n)
      setAvg(Number(res.avg) || 0)
      setCount(Number(res.count) || 0)
    } else if (res.error === 'login') gate.again(() => rate(n))
    else setError(errorText(lang, res.error, res.reason))
  }

  const shown = hover || stars || Math.round(avg)
  return (
    <div className="gl-rate">
      <div className="gl-rate__row">
        <span className="gl-rate__avg">{count ? avg.toLocaleString(lang === 'ky' ? 'ky-KG' : 'ru-RU') : '—'}</span>
        <span className="gl-rate__stars" role="group" aria-label={t.rateTitle} onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={n <= shown ? 'gl-star is-on' : 'gl-star'}
              aria-label={t.rateStar(n)}
              aria-pressed={stars === n}
              disabled={mine || busy}
              onMouseEnter={() => !mine && setHover(n)}
              onClick={() => rate(n)}
            >
              ★
            </button>
          ))}
        </span>
        <span className="gl-muted">{count ? t.ratings(count) : t.noRatings}</span>
      </div>
      {mine ? <p className="gl-muted gl-small">{t.rateOwn}</p> : stars ? <p className="gl-muted gl-small">{t.rateYour}: {stars}</p> : null}
      <Problem>{error}</Problem>
      {gate.dialog}
    </div>
  )
}

type CommentView = GalleryComment & { author: string }

/** Комментарии: список, форма, «Пожаловаться» у кухни и у каждого комментария. */
export function Comments({ lang, apiId, initial, loggedIn }: { lang: Lang; apiId: string; initial: CommentView[]; loggedIn: boolean }) {
  const t = galleryTexts(lang)
  const gate = useGate(loggedIn, lang)
  const [list, setList] = useState(initial)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reported, setReported] = useState<Set<string>>(new Set())
  const textRef = useRef(text)
  textRef.current = text

  const send = async () => {
    const value = textRef.current.trim()
    if (value.length < MIN_COMMENT || value.length > MAX_COMMENT) return setError(t.errors['bad-input'])
    if (!gate.need(send)) return
    setBusy(true)
    setError('')
    const res = await call(`/api/gallery/${apiId}/comments`, json({ text: value }))
    setBusy(false)
    if (res.ok) {
      const c = res.comment as GalleryComment
      setList((l) => [...l, { ...c, author: c.authorName || t.buyer }])
      setText('')
    } else if (res.error === 'login') gate.again(send)
    else setError(errorText(lang, res.error, res.reason))
  }

  const report = async (commentId?: string) => {
    const key = commentId ?? 'kitchen'
    if (reported.has(key)) return
    if (!gate.need(() => report(commentId))) return
    const res = await call(`/api/gallery/${apiId}/report`, json(commentId ? { commentId } : {}))
    if (res.ok) setReported((s) => new Set(s).add(key))
    else if (res.error === 'login') gate.again(() => report(commentId))
    else setError(errorText(lang, res.error, res.reason))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void send()
  }

  return (
    <section className="gl-comments" aria-labelledby="gl-comments-title">
      <div className="gl-comments__head">
        <h2 id="gl-comments-title" className="gl-h2">
          {t.comments} {list.length > 0 && <span className="gl-muted">{list.length}</span>}
        </h2>
        <button type="button" className="gl-link" onClick={() => report()}>
          {reported.has('kitchen') ? t.reported : t.report}
        </button>
      </div>
      {list.length === 0 ? (
        <p className="gl-muted">{t.noComments}</p>
      ) : (
        <ul className="gl-comments__list">
          {list.map((c) => (
            <li key={c.id} className="gl-comment">
              <div className="gl-comment__head">
                <b>{c.author}</b>
                <time className="gl-muted" dateTime={c.at}>
                  {new Date(c.at).toLocaleDateString(lang === 'ky' ? 'ky-KG' : 'ru-RU')}
                </time>
                <button type="button" className="gl-link gl-small" onClick={() => report(c.id)}>
                  {reported.has(c.id) ? t.reported : t.report}
                </button>
              </div>
              <p className="gl-comment__text">{c.text}</p>
            </li>
          ))}
        </ul>
      )}
      <form className="gl-form" onSubmit={submit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.commentPlaceholder}
          maxLength={MAX_COMMENT}
          rows={3}
          aria-label={t.comments}
        />
        <div className="gl-form__row">
          <span className="gl-muted gl-small">
            {text.trim().length}/{MAX_COMMENT}
          </span>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? t.busy : t.send}
          </button>
        </div>
        <Problem>{error}</Problem>
      </form>
      {gate.dialog}
    </section>
  )
}

/** Только автору: «Я сделал такую» (фото вживую) и «Убрать из галереи». */
export function OwnerTools({ lang, apiId, photos }: { lang: Lang; apiId: string; photos: number }) {
  const t = galleryTexts(lang)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const room = MAX_REAL_PHOTOS - photos

  const upload = async (e: FormEvent) => {
    e.preventDefault()
    if (!files.length || busy) return
    setBusy(true)
    setError('')
    const form = new FormData()
    try {
      for (const file of files.slice(0, room)) {
        const { full, thumb } = await shrinkPhoto(file)
        form.append('photos', full, 'photo.jpg')
        form.append('thumbs', thumb ?? new Blob([]), 'thumb.jpg')
      }
    } catch {
      setBusy(false)
      return setError(t.photoError)
    }
    const res = await call(`/api/gallery/${apiId}/photos`, { method: 'POST', body: form })
    setBusy(false)
    if (res.ok) window.location.reload()
    else setError(res.error === 'bad-input' ? t.photoError : errorText(lang, res.error, res.reason))
  }

  const remove = async () => {
    if (!window.confirm(t.removeAsk)) return
    setBusy(true)
    const res = await call(`/api/gallery/${apiId}`, { method: 'DELETE' })
    setBusy(false)
    if (res.ok) window.location.assign(`/${lang}/kitchen/gallery?mine=1`)
    else setError(errorText(lang, res.error, res.reason))
  }

  return (
    <section className="gl-owner">
      <h2 className="gl-h2">{t.realTitle}</h2>
      {room > 0 ? (
        <form className="gl-form" onSubmit={upload}>
          <p className="gl-muted">{t.realLead}</p>
          <label className="btn btn--outline gl-file">
            {files.length ? `${t.realPick}: ${Math.min(files.length, room)}` : t.realPick}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, room))}
            />
          </label>
          <button type="submit" className="btn btn--primary" disabled={!files.length || busy}>
            {busy ? t.busy : t.realSend}
          </button>
        </form>
      ) : (
        <p className="gl-muted">{t.realFull}</p>
      )}
      <button type="button" className="gl-link gl-danger" onClick={remove} disabled={busy}>
        {t.remove}
      </button>
      <Problem>{error}</Problem>
    </section>
  )
}
