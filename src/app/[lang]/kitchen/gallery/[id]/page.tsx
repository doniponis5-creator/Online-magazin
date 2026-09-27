import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { currentSession } from '@/app/api/customer/route-helpers'
import { kitchenPage } from '@/components/gallery/data'
import { KitchenView, type Viewer } from '@/components/gallery/KitchenView'
import { formatSom } from '@/lib/format'
import { galleryTexts } from '@/lib/gallery/texts'
import { viewerOf } from '@/lib/gallery/store'
import { isLang, type Lang } from '@/lib/i18n/config'
import { canonical } from '@/lib/seo'

/**
 * Страница одной кухни галереи (`<id>`) или готовой кухни (`ready-<id>`).
 * Живая: оценки, комментарии и скрытие владельцем видны сразу — не кешируется.
 */
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ lang: string; id: string }> }

const load = cache((id: string, lang: Lang) => kitchenPage(id, lang))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw, id } = await params
  const lang: Lang = raw === 'ky' ? 'ky' : 'ru'
  const page = await load(id, lang)
  if (!page) return {}
  const t = galleryTexts(lang)
  const f = page.facts
  const title = `${page.title} — ${t.title}`
  const description = [
    `${f.shapeName} · ${f.walls}`,
    f.style,
    f.total > 0 ? t.techTotal(formatSom(f.total)) : '',
    `${t.author}: ${page.author}`,
  ]
    .filter(Boolean)
    .join('. ')
  const path = `/kitchen/gallery/${page.id}`
  const images = [{ url: canonical(page.card), ...page.cardSize, alt: page.title }]
  return {
    title,
    description,
    alternates: {
      canonical: canonical(`/${lang}${path}`),
      languages: { ru: canonical(`/ru${path}`), ky: canonical(`/ky${path}`) },
    },
    openGraph: { type: 'article', title, description, url: canonical(`/${lang}${path}`), images },
    twitter: { card: 'summary_large_image', title, description, images: images.map((i) => i.url) },
  }
}

export default async function GalleryKitchenPage({ params }: Props) {
  const { lang, id } = await params
  if (!isLang(lang)) notFound()
  const page = await load(id, lang)
  if (!page) notFound()
  const session = page.apiId ? await currentSession() : null
  const viewer: Viewer | null = session && page.apiId ? ((await viewerOf(page.apiId, session.phone)) ?? { mine: false, stars: null }) : null
  return <KitchenView page={page} lang={lang} viewer={viewer} />
}
