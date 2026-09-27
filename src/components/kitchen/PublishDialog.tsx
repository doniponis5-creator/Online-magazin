'use client'

import Link from 'next/link'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { useCustomer } from '@/components/AccountView'
import { CustomerLogin } from '@/components/CustomerLogin'
import { MAX_TITLE, titleOf } from '@/lib/gallery/rules'
import type { Lang } from '@/lib/i18n/config'
import { Modal } from './Modal'
import { readPublish, type PublishFail } from './publish'
import { galleryShots } from './shot'
import type { KitchenTexts } from './texts'

type Phase = 'form' | 'login' | 'sending' | 'done'
type Err = PublishFail | 'shot'

/**
 * «В галерею»: кадр 3D, название, кто собрал → `POST /api/gallery`.
 * Не вошёл — вход (тот же, что в кабинете), после входа отправка идёт сама.
 * Грузится через `import()` только по нажатию: вход и кабинет в бандл
 * конструктора не попадают.
 */
export function PublishDialog({
  lang,
  t,
  q,
  shot,
  onClose,
}: {
  lang: Lang
  t: KitchenTexts
  /** проект — строка `queryFromState` */
  q: string
  /** кадр 3D (data URL JPEG) или null, если 3D нет */
  shot: () => string | null
  onClose: () => void
}) {
  const g = t.gallery
  const { customer, setCustomer } = useCustomer()
  const [phase, setPhase] = useState<Phase>('form')
  const [title, setTitle] = useState('')
  const [role, setRole] = useState<'buyer' | 'master'>('buyer')
  const [error, setError] = useState<Err | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [id, setId] = useState('')
  const [shared, setShared] = useState<string | null>(null)
  const titleId = useId()
  // своё название не ввели — сервер подпишет сам, а страница покажет его на языке посетителя
  const autoTitle = titleOf(q, lang)

  // Кадр — сразу при открытии: в галерею уходит кухня такой, какой её сохранили.
  useEffect(() => {
    setPreview(shot())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = async () => {
    setError(null)
    setPhase('sending')
    let files: { image: Blob; thumb: Blob }
    try {
      const frame = preview ?? shot()
      if (!frame) throw new Error('shot')
      files = await galleryShots(frame)
    } catch {
      setError('shot')
      setPhase('form')
      return
    }
    const form = new FormData()
    form.set('q', q)
    if (title.trim()) form.set('title', title.trim())
    form.set('role', role)
    form.set('image', new File([files.image], 'kitchen.jpg', { type: 'image/jpeg' }))
    form.set('thumb', new File([files.thumb], 'kitchen-s.jpg', { type: 'image/jpeg' }))
    const res = await fetch('/api/gallery', { method: 'POST', body: form }).catch(() => null)
    const out = readPublish(res ? res.status : null, res ? await res.json().catch(() => null) : null)
    if (out.ok) {
      setId(out.id)
      setPhase('done')
      return
    }
    if (out.error === 'login') {
      // думали, что вошёл, а сессия кончилась — скажем об этом прямо
      setError(customer ? 'login' : null)
      setCustomer(null)
      setPhase('login')
      return
    }
    setError(out.error)
    setPhase('form')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (customer === null) setPhase('login')
    else void send()
  }

  const galleryPath = `/${lang}/kitchen/gallery/${id}`
  const share = async () => {
    const url = `${window.location.origin}${galleryPath}`
    if (navigator.share) {
      try {
        await navigator.share({ title: title.trim() || autoTitle, url })
        return
      } catch {
        // отменили — скопируем ссылку
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setShared(t.linkCopied)
    } catch {
      setShared(url)
    }
  }

  return (
    <Modal labelledBy={titleId} locked={phase === 'sending'} onClose={onClose}>
        <button type="button" className="kp-dialog__close" aria-label={g.close} title={g.close} onClick={onClose} disabled={phase === 'sending'}>
          ×
        </button>
        <h2 id={titleId} className="kp-dialog__title">
          {phase === 'done' ? g.doneTitle : g.dialogTitle}
        </h2>

        {phase === 'done' ? (
          <>
            {preview && <img src={preview} alt="" className="kp-dialog__shot" />}
            <p className="kp-dialog__lead">{g.doneText}</p>
            <div className="kp-dialog__actions">
              <Link href={galleryPath} className="btn btn--primary btn--sm">
                {g.view}
              </Link>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => void share()}>
                {g.share}
              </button>
            </div>
            {shared && (
              <p className="kp-note" role="status">
                {shared}
              </p>
            )}
          </>
        ) : phase === 'login' ? (
          <>
            <p className="kp-dialog__lead">{error === 'login' ? g.errors.login : g.loginLead}</p>
            <CustomerLogin
              onDone={(c) => {
                setCustomer(c)
                void send()
              }}
            />
          </>
        ) : (
          <form onSubmit={submit} className="kp-dialog__form">
            {preview && <img src={preview} alt="" className="kp-dialog__shot" />}
            <p className="kp-dialog__lead">{g.dialogLead}</p>
            <label className="kp-dialog__field">
              <span>{g.name}</span>
              <input
                type="text"
                value={title}
                maxLength={MAX_TITLE}
                placeholder={g.namePlaceholder(autoTitle)}
                onChange={(e) => setTitle(e.target.value)}
              />
              <small className="kp-note">{g.nameNote}</small>
            </label>
            <fieldset className="kp-dialog__field">
              <legend>{g.who}</legend>
              <div className="kp-chips">
                {(['buyer', 'master'] as const).map((r) => (
                  <button key={r} type="button" className="kp-chip" aria-pressed={role === r} onClick={() => setRole(r)}>
                    {g[r]}
                  </button>
                ))}
              </div>
            </fieldset>
            {error && (
              <p className="kp-dialog__error" role="alert">
                {g.errors[error]}
              </p>
            )}
            <div className="kp-dialog__actions">
              <button type="submit" className="btn btn--primary btn--sm" disabled={phase === 'sending'}>
                {phase === 'sending' ? g.sending : g.publish}
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} disabled={phase === 'sending'}>
                {g.cancel}
              </button>
            </div>
          </form>
        )}
    </Modal>
  )
}
