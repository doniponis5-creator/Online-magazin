import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { currentSession } from '@/app/api/customer/route-helpers'
import { galleryTiles, readyTiles, type Tile } from '@/components/gallery/data'
import { KitchenTile } from '@/components/gallery/KitchenTile'
import { kitchenTexts } from '@/components/kitchen/texts'
import { READY } from '@/data/kitchen-ready'
import { SHAPES } from '@/lib/gallery/rules'
import { galleryTexts, type SizeBand } from '@/lib/gallery/texts'
import { isLang, type Lang } from '@/lib/i18n/config'
import type { Shape } from '@/lib/kitchen/types'
import { canonical } from '@/lib/seo'

/**
 * Галерея кухонь: «Готовые кухни», «Лучшие», «Новые»; фильтры формы, размера,
 * «только с фото вживую», «мои» (вошедшему) и «кухни мастера» (?author=).
 * Живая — читает хранилище на каждый запрос.
 */
export const dynamic = 'force-dynamic'

type Search = Record<string, string | string[] | undefined>
type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Search> }

const SIZES: readonly SizeBand[] = ['small', 'mid', 'big']
const AUTHOR_ID = /^[a-f0-9]{12}$/

type Filter = { sort: 'top' | 'new'; shape?: Shape; size?: SizeBand; real: boolean; mine: boolean; author?: string; page: number }

function readFilter(sp: Search): Filter {
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined)
  const author = one('author')
  return {
    sort: one('sort') === 'new' ? 'new' : 'top',
    shape: SHAPES.find((s) => s === one('shape')),
    size: SIZES.find((s) => s === one('size')),
    real: one('real') === '1',
    mine: one('mine') === '1',
    author: author && AUTHOR_ID.test(author) ? author : undefined,
    page: Math.max(1, Math.min(50, Math.floor(Number(one('page'))) || 1)),
  }
}

/** Адрес галереи с изменённым фильтром; «Ещё» сбрасывается при любой смене. */
function hrefOf(lang: Lang, f: Filter, patch: Partial<Filter>): string {
  const next = { ...f, page: 1, ...patch }
  const q = new URLSearchParams()
  if (next.sort === 'new') q.set('sort', 'new')
  if (next.shape) q.set('shape', next.shape)
  if (next.size) q.set('size', next.size)
  if (next.real) q.set('real', '1')
  if (next.mine) q.set('mine', '1')
  if (next.author) q.set('author', next.author)
  if (next.page > 1) q.set('page', String(next.page))
  const s = q.toString()
  return `/${lang}/kitchen/gallery${s ? `?${s}` : ''}`
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { lang: raw } = await params
  const lang: Lang = raw === 'ky' ? 'ky' : 'ru'
  const t = galleryTexts(lang)
  const f = readFilter(await searchParams)
  const image = READY[0] ? [{ url: canonical(READY[0].card), width: 1200, height: 630 }] : undefined
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical: canonical(`/${lang}/kitchen/gallery`),
      languages: { ru: canonical('/ru/kitchen/gallery'), ky: canonical('/ky/kitchen/gallery') },
    },
    // «мои» и выборки по фильтрам — не отдельные страницы для поиска
    robots: f.mine ? { index: false, follow: true } : undefined,
    openGraph: { title: t.metaTitle, description: t.metaDescription, url: canonical(`/${lang}/kitchen/gallery`), images: image },
  }
}

function Grid({ tiles, lang }: { tiles: Tile[]; lang: Lang }) {
  return (
    <div className="gl-grid">
      {tiles.map((tile) => (
        <KitchenTile key={tile.id} tile={tile} lang={lang} />
      ))}
    </div>
  )
}

export default async function GalleryPage({ params, searchParams }: Props) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const t = galleryTexts(lang)
  const kt = kitchenTexts(lang)
  const f = readFilter(await searchParams)
  const session = await currentSession()
  const mine = f.mine && session ? session.phone : undefined

  const list = await galleryTiles({
    lang,
    sort: f.sort,
    shape: f.shape,
    size: f.size,
    real: f.real,
    authorId: f.author,
    phone: mine,
    upto: f.page,
  })
  // «Мои» без входа — пусто, а не чужие кухни
  const items = f.mine && !session ? [] : list.items
  const personal = f.mine || Boolean(f.author)
  const ready = personal || f.real ? [] : readyTiles(lang, { shape: f.shape, size: f.size })
  const filtered = Boolean(f.shape || f.size || f.real || personal)

  const heading = f.mine
    ? t.mine
    : f.author && items[0]
      ? items[0].master
        ? t.masterOf(items[0].author)
        : t.authorOf(items[0].author)
      : t.title

  const chip = (on: boolean, href: string, label: string) => (
    <Link key={href + label} href={href} className={on ? 'gl-chip is-on' : 'gl-chip'} aria-current={on ? 'true' : undefined} scroll={false}>
      {label}
    </Link>
  )

  return (
    <div className="container gl-page">
      <header className="gl-head">
        <h1>{heading}</h1>
        <p>{t.lead}</p>
        <Link href={`/${lang}/kitchen`} className="btn btn--primary">
          {t.build}
        </Link>
      </header>

      <div className="gl-filters">
        <div className="gl-chips" aria-label={t.shape}>
          <span className="gl-chips__label">{t.shape}</span>
          {chip(!f.shape, hrefOf(lang, f, { shape: undefined }), t.any)}
          {SHAPES.map((s) => chip(f.shape === s, hrefOf(lang, f, { shape: s }), kt.shapes[s][0]))}
        </div>
        <div className="gl-chips" aria-label={t.size}>
          <span className="gl-chips__label">{t.size}</span>
          {chip(!f.size, hrefOf(lang, f, { size: undefined }), t.anySize)}
          {SIZES.map((s) => chip(f.size === s, hrefOf(lang, f, { size: s }), t.sizes[s]))}
        </div>
        <div className="gl-chips">
          {chip(f.real, hrefOf(lang, f, { real: !f.real }), t.onlyReal)}
          {session && chip(f.mine, hrefOf(lang, f, { mine: !f.mine, author: undefined }), t.mine)}
          {personal && chip(false, hrefOf(lang, f, { mine: false, author: undefined }), t.allKitchens)}
        </div>
      </div>

      {ready.length > 0 && (
        <section className="gl-section" aria-labelledby="gl-ready">
          <h2 id="gl-ready" className="gl-h2">
            {t.ready}
          </h2>
          <p className="gl-section__lead">{t.readyLead}</p>
          <Grid tiles={ready} lang={lang} />
        </section>
      )}

      <nav className="gl-tabs" aria-label={t.title}>
        <Link href={hrefOf(lang, f, { sort: 'top' })} className={f.sort === 'top' ? 'is-on' : ''} scroll={false}>
          {t.top}
        </Link>
        <Link href={hrefOf(lang, f, { sort: 'new' })} className={f.sort === 'new' ? 'is-on' : ''} scroll={false}>
          {t.fresh}
        </Link>
      </nav>

      {items.length > 0 ? (
        <>
          <Grid tiles={items} lang={lang} />
          {list.more && (
            <div className="gl-more">
              <Link href={hrefOf(lang, f, { page: f.page + 1 })} className="btn btn--outline" scroll={false}>
                {t.more}
              </Link>
            </div>
          )}
        </>
      ) : (
        <div className="gl-empty">
          <p>{filtered ? t.emptyFilter : t.empty}</p>
          <Link href={`/${lang}/kitchen`} className="btn btn--primary">
            {t.build}
          </Link>
        </div>
      )}
    </div>
  )
}
