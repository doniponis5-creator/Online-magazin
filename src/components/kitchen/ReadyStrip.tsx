'use client'

import Link from 'next/link'
import { useEffect, useId, useMemo, useState } from 'react'
import { READY } from '@/data/kitchen-ready'
import { formatSom } from '@/lib/format'
import type { GalleryCard } from '@/lib/gallery/rules'
import type { Lang } from '@/lib/i18n/config'
import { queryFromState } from '@/lib/kitchen/share'
import type { KitchenAppliance, Shape } from '@/lib/kitchen/types'
import { Modal } from './Modal'
import { openQuery, techSum, topOfGallery } from './ready'
import type { KitchenTexts } from './texts'

const SHAPES: Shape[] = ['straight', 'corner', 'u', 'island']

type Card = {
  key: string
  q: string
  /** та же кухня, как её запишет конструктор (`queryFromState`) — чтобы узнать её после открытия и перезагрузки */
  norm: string
  title: string
  thumb: string
  shape: Shape
  sum: number
  rating?: { avg: number; count: number }
}

function cardOf(key: string, q: string, title: string, thumb: string, appliances: readonly KitchenAppliance[], rating?: Card['rating']): Card {
  const { state } = openQuery(q, appliances)
  return { key, q, norm: queryFromState(state), title, thumb, shape: state.shape, sum: techSum(state, appliances), rating }
}

/**
 * Полоса «Готовые кухни» в шаге «Кухня», выше карточек форм: 12 готовых, затем до 6 лучших из
 * галереи. Нажатие открывает кухню в конструкторе; если своя уже собрана —
 * сначала вопрос «Заменить?». Галерея недоступна — полоса просто без неё.
 */
export function ReadyStrip({
  lang,
  t,
  appliances,
  own,
  dropName,
  onOpen,
}: {
  lang: Lang
  t: KitchenTexts
  appliances: readonly KitchenAppliance[]
  /** строка своей кухни (`queryFromState`); null — кухня по умолчанию или только что открытая готовая */
  own: string | null
  /** «Мои варианты» полны — какой вариант удалится при замене */
  dropName: string | null
  /** save — своя кухня собрана: сначала положить её в «Мои варианты» */
  onOpen: (q: string, title: string, save: boolean) => void
}) {
  const g = t.gallery
  const [shape, setShape] = useState<Shape | null>(null)
  const [top, setTop] = useState<GalleryCard[]>([])
  const [asking, setAsking] = useState<Card | null>(null)
  const titleId = useId()

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/api/gallery?sort=top', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ok?: boolean; items?: GalleryCard[] } | null) => {
        if (d?.ok && Array.isArray(d.items)) setTop(topOfGallery(d.items))
      })
      // нет сети или галереи — полоса только из готовых
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  const ready = useMemo(() => READY.map((r) => cardOf(`ready-${r.id}`, r.q, lang === 'ky' ? r.ky : r.ru, r.thumb, appliances)), [appliances, lang])
  const best = useMemo(
    () => top.map((k) => cardOf(k.id, k.q, k.title, `/api/gallery/image/${k.thumb}`, appliances, { avg: k.avg, count: k.count })),
    [top, appliances],
  )
  const shown = [...ready, ...best].filter((c) => !shape || c.shape === shape)

  // своя кухня = одна из готовых без правок (открыли раньше, в том числе до перезагрузки) — не спрашиваем
  const built = own !== null && ![...ready, ...best].some((c) => c.norm === own)
  const pick = (c: Card) => (built ? setAsking(c) : onOpen(c.q, c.title, false))


  return (
    <section className="kp-ready" aria-labelledby={titleId}>
      <h3 id={titleId} className="kp-ready__title">
        {g.readyTitle}
      </h3>
      <p className="kp-note">{g.readyLead}</p>
      {/* одна строка фильтров — только форма (таск 06); длина стен и бюджет убраны с экрана */}
      <div className="kp-ready__filter" role="group" aria-label={g.filterShape}>
        <span className="kp-ready__label">{g.filterShape}</span>
        <button type="button" className="kp-chip" aria-pressed={shape === null} onClick={() => setShape(null)}>
          {g.all}
        </button>
        {SHAPES.map((v) => (
          <button key={v} type="button" className="kp-chip" aria-pressed={shape === v} onClick={() => setShape(shape === v ? null : v)}>
            {t.shapes[v][0]}
          </button>
        ))}
      </div>
      <ul className="kp-ready__list">
        {shown.map((c) => (
          <li key={c.key} className="kp-ready__item">
            <button type="button" className="kp-ready__card" onClick={() => pick(c)} aria-label={`${c.title}. ${g.open}`}>
              <img src={c.thumb} alt="" className="kp-ready__img" loading="lazy" width={480} height={300} />
              <span className="kp-ready__name">{c.title}</span>
              {/* техники из кухни нет в каталоге — «0 сом» не пишем */}
              {c.sum > 0 && <span className="kp-ready__sum">{g.tech(formatSom(c.sum))}</span>}
              {c.rating && (
                <span className="kp-ready__meta">
                  {g.fromGallery} · {g.stars(c.rating.avg.toFixed(1).replace('.', ','), c.rating.count)}
                </span>
              )}
            </button>
          </li>
        ))}
        <li className="kp-ready__item kp-ready__item--all">
          <Link href={`/${lang}/kitchen/gallery`} className="kp-ready__all">
            {g.allLink} →
          </Link>
        </li>
      </ul>
      {shown.length === 0 && <p className="kp-note">{g.none}</p>}

      {asking && (
        <Modal label={g.replaceTitle} alert small onClose={() => setAsking(null)}>
          <h2 className="kp-dialog__title">{g.replaceTitle}</h2>
          <p className="kp-dialog__lead">
            {g.replaceText}
            {dropName && ` ${g.replaceDrop(dropName)}`}
          </p>
          <div className="kp-dialog__actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              autoFocus
              onClick={() => {
                setAsking(null)
                onOpen(asking.q, asking.title, true)
              }}
            >
              {g.replace}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAsking(null)}>
              {g.cancel}
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
