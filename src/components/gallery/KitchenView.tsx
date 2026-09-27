import Link from 'next/link'
import { formatSom } from '@/lib/format'
import type { Lang } from '@/lib/i18n/config'
import { galleryDate } from '@/lib/gallery/format'
import { galleryTexts } from '@/lib/gallery/texts'
import type { KitchenPageData } from './data'
import { Comments, KitchenMedia, OwnerTools, Rating, ShareButton } from './social'
import './gallery.css'

export type Viewer = { mine: boolean; stars: number | null }

/**
 * Страница кухни. `viewer` — вошедший (своя ли кухня, его оценка); null — не вошёл.
 * Проект уходит только в адрес «Хочу такую же» — как текст он не показывается.
 */
export function KitchenView({ page, lang, viewer }: { page: KitchenPageData; lang: Lang; viewer: Viewer | null }) {
  const t = galleryTexts(lang)
  const f = page.facts
  const date = page.createdAt ? galleryDate(page.createdAt, lang, 'long') || null : null
  return (
    <div className="container gl-page">
      <nav className="gl-back">
        <Link href={`/${lang}/kitchen/gallery`}>{t.back}</Link>
      </nav>
      <div className="gl-kitchen">
        <KitchenMedia lang={lang} title={page.title} image={page.image} photos={page.realPhotos} />
        <div className="gl-kitchen__info">
          <h1 className="gl-kitchen__title">{page.title}</h1>
          <p className="gl-kitchen__by">
            <span>
              {t.author}: <b>{page.author}</b>
              {page.master && <span className="gl-master">{t.master}</span>}
            </span>
            {date && <span className="gl-muted">{date}</span>}
          </p>
          {page.authorId && page.master && (
            <p className="gl-small">
              <Link href={`/${lang}/kitchen/gallery?author=${page.authorId}`}>{t.masterOf(page.author)}</Link>
            </p>
          )}
          {page.social && page.apiId && (
            <Rating
              lang={lang}
              apiId={page.apiId}
              avg={page.avg}
              count={page.count}
              stars={viewer?.stars ?? null}
              mine={Boolean(viewer?.mine)}
              loggedIn={viewer !== null}
            />
          )}
          <dl className="gl-facts">
            <div>
              <dt>{t.shapeSize}</dt>
              <dd>
                {f.shapeName} · {f.walls}
              </dd>
            </div>
            <div>
              <dt>{t.style}</dt>
              <dd>{f.style}</dd>
            </div>
            <div>
              <dt>{t.colors}</dt>
              <dd>{f.fronts || t.asStyle}</dd>
            </div>
          </dl>
          <div className="gl-cta">
            <a className="btn btn--primary" href={`/${lang}/kitchen?${page.q}`}>
              {t.want}
            </a>
            <ShareButton lang={lang} title={page.title} />
          </div>
          <p className="gl-muted gl-small">{t.wantHint}</p>
        </div>
      </div>

      <section className="gl-tech" aria-labelledby="gl-tech-title">
        <h2 id="gl-tech-title" className="gl-h2">
          {t.tech}
        </h2>
        {f.rows.length === 0 ? (
          <p className="gl-muted">{t.techNone}</p>
        ) : (
          <ul className="gl-tech__list">
            {f.rows.map((r) => (
              <li key={r.slot} className="gl-tech__row">
                <span className="gl-tech__slot">{r.slotName}</span>
                {r.productId && r.name ? (
                  <Link className="gl-tech__name" href={`/${lang}/product/${r.productId}`}>
                    {r.name}
                  </Link>
                ) : (
                  <span className="gl-tech__name gl-muted">{t.noStock}</span>
                )}
                <span className="gl-tech__price">
                  {r.price !== null && formatSom(r.price)}
                  {r.note === 'notFit' && <small className="gl-muted"> · {t.notFit}</small>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {f.total > 0 && (
          <p className="gl-tech__total">
            {t.total}: <b>{formatSom(f.total)}</b>
          </p>
        )}
        <p className="gl-muted gl-small">{t.totalHint}</p>
      </section>

      {page.social && page.apiId && viewer?.mine && <OwnerTools lang={lang} apiId={page.apiId} photos={page.realPhotos.length} />}
      {page.social && page.apiId && <Comments lang={lang} apiId={page.apiId} initial={page.comments} loggedIn={viewer !== null} />}
    </div>
  )
}
