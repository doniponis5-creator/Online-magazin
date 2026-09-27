import Link from 'next/link'
import { formatSom } from '@/lib/format'
import type { Lang } from '@/lib/i18n/config'
import { galleryNumber } from '@/lib/gallery/format'
import { galleryTexts } from '@/lib/gallery/texts'
import type { Tile } from './data'
import './gallery.css'

/** Звёзды для показа (не для оценки): 4,3 → ★★★★☆ с подписью для экранного диктора. */
export function StarsView({ value, label }: { value: number; label?: string }) {
  const full = Math.round(value)
  return (
    <span className="gl-stars" aria-label={label ?? `${value} / 5`} role="img">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= full ? 'gl-star is-on' : 'gl-star'} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  )
}

/** Карточка кухни в галерее и в «Готовых кухнях». */
export function KitchenTile({ tile, lang }: { tile: Tile; lang: Lang }) {
  const t = galleryTexts(lang)
  return (
    <article className="gl-tile">
      <Link href={`/${lang}/kitchen/gallery/${tile.id}`} className="gl-tile__link">
        <span className="gl-tile__media">
          {/* eslint-disable-next-line @next/next/no-img-element -- кадр из хранилища галереи, размер уже нужный */}
          <img src={tile.image} alt="" loading="lazy" width={480} height={300} />
          {tile.realThumb && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- фото вживую из хранилища галереи */}
              <img className="gl-tile__real" src={tile.realThumb} alt="" loading="lazy" width={96} height={72} />
              <span className="gl-tile__badge">{t.hasReal}</span>
            </>
          )}
        </span>
        <span className="gl-tile__body">
          <span className="gl-tile__title">{tile.title}</span>
          <span className="gl-tile__by">
            {tile.author}
            {tile.master && <span className="gl-master">{t.master}</span>}
          </span>
          {tile.social && (
            <span className="gl-tile__row">
              {tile.count ? (
                <>
                  <StarsView value={tile.avg} />
                  <span>
                    {galleryNumber(tile.avg)} · {t.ratings(tile.count)}
                  </span>
                </>
              ) : (
                <span className="gl-muted">{t.noRatings}</span>
              )}
              {tile.comments > 0 && <span className="gl-muted">· {t.commentsCount(tile.comments)}</span>}
            </span>
          )}
          {tile.total > 0 && <span className="gl-tile__price">{t.techTotal(formatSom(tile.total))}</span>}
        </span>
      </Link>
    </article>
  )
}
