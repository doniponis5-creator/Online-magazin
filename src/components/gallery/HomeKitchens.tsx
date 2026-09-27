import Link from 'next/link'
import type { Lang } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { galleryTiles, readyTiles, type Tile } from './data'
import { KitchenTile } from './KitchenTile'

/** Карточек на главной: 3 в ряд на компьютере, 2 — на телефоне. */
const COUNT = 6

/** «Лучшая» кухня галереи: средняя оценка ≥ 4 и оценок не меньше трёх. */
const isBest = (t: Tile) => t.count >= 3 && t.avg >= 4

async function bestTiles(lang: Lang): Promise<Tile[]> {
  try {
    const { items } = await galleryTiles({ lang, sort: 'top' })
    return items.filter(isBest).slice(0, COUNT)
  } catch (error) {
    // хранилище не прочиталось — главная всё равно открывается, с готовыми кухнями
    console.error('[home] галерея кухонь не прочитана, показываю готовые:', error)
    return []
  }
}

/** Сначала лучшие из галереи, остальное — готовые кухни (`READY`). */
export async function homeKitchenTiles(lang: Lang): Promise<Tile[]> {
  const best = await bestTiles(lang)
  return [...best, ...readyTiles(lang)].slice(0, COUNT)
}

/** Блок главной «Готовые кухни в 3D» — серверный, данные прямо из хранилища. */
export async function HomeKitchens({ lang }: { lang: Lang }) {
  const tiles = await homeKitchenTiles(lang)
  if (tiles.length === 0) return null
  const t = getDictionary(lang).home
  return (
    <section className="section gl-home" aria-labelledby="home-kitchens">
      <div className="section__head">
        <h2 className="section__title" id="home-kitchens">
          {t.kitchensTitle}
        </h2>
      </div>
      <p className="gl-home__lead">{t.kitchensLead}</p>
      <div className="gl-home__grid">
        {tiles.map((tile) => (
          <KitchenTile key={tile.id} tile={tile} lang={lang} />
        ))}
      </div>
      <div className="gl-home__actions">
        <Link href={`/${lang}/kitchen`} className="btn btn--primary">
          {t.kitchensBuild}
        </Link>
        <Link href={`/${lang}/kitchen/gallery`} className="btn btn--outline">
          {t.kitchensGallery}
        </Link>
      </div>
    </section>
  )
}
