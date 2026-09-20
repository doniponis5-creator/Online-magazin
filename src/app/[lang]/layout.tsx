import '../globals.css'
import '../light-lemon.css'
import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { defaultLang, isLang, type Lang } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { CartProvider } from '@/lib/cart/CartProvider'
import { FavoritesProvider } from '@/lib/favorites/FavoritesProvider'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { CartReminder } from '@/components/CartReminder'
import { ContactButton } from '@/components/ContactButton'
import { Footer } from '@/components/Footer'
import { HtmlLang } from '@/components/HtmlLang'
import { MotionProvider } from '@/components/MotionProvider'
import { VisitCounter } from '@/components/VisitCounter'
import { OfflineCatalogSync } from '@/components/OfflineCatalogSync'
import { SITE_NAME, SITE_URL, storeJsonLd, websiteJsonLd } from '@/lib/seo'

/**
 * viewportFit: 'cover' — страница занимает экран телефона целиком, вместе с
 * полоской под часами и овалом жеста «домой».
 *
 * Без этой строки iPhone отвечает, что отступов у краёв нет (env(...) = 0), и
 * подписи нижней панели упираются в овал, а товары видно сквозь часы. С ней
 * отступы становятся настоящими, и CSS отводит под них место.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export function generateStaticParams() {
  return [{ lang: 'ru' }, { lang: 'ky' }]
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang: raw } = await params
  if (!isLang(raw)) notFound()
  const lang = raw as Lang
  const dict = getDictionary(lang)

  // Разметку отдаём в разметке страницы, а не скриптом: так её видит поисковик
  // при первом же заходе, до выполнения какого-либо кода.
  const jsonLd = [storeJsonLd(lang), websiteJsonLd(lang)]

  return (
    <html lang={lang}><body>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <I18nProvider lang={lang} dict={dict}>
      <CartProvider>
        <FavoritesProvider>
          <HtmlLang lang={lang} />
          <MotionProvider />
          <VisitCounter />
          <OfflineCatalogSync />
          <a href="#content" className="skip-link">
            {dict.nav.skipToContent}
          </a>
          <Header />          <main id="content" tabIndex={-1}>
            {children}
          </main>
          <Footer />
          <CartReminder />
          <ContactButton />
          <BottomNav />
        </FavoritesProvider>
      </CartProvider>
      </I18nProvider>
    </body></html>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params
  const lang: Lang = isLang(raw) ? raw : defaultLang
  const dict = getDictionary(lang)
  const path = `/${lang}`
  return {
    metadataBase: new URL(SITE_URL),
    title: dict.meta.title,
    description: dict.meta.description,
    applicationName: SITE_NAME,
    // Каноническая ссылка и пара языков: без них поисковик считает русскую
    // и кыргызскую версии разными сайтами и делит вес между ними.
    alternates: {
      canonical: path,
      languages: { ru: '/ru', ky: '/ky', 'x-default': '/ru' },
    },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      url: path,
      title: dict.meta.title,
      description: dict.meta.description,
      locale: lang === 'ky' ? 'ky_KG' : 'ru_RU',
      images: [{ url: '/brand/smart-centr-mark.jpg', width: 1000, height: 1794, alt: SITE_NAME }],
    },
    twitter: { card: 'summary_large_image', title: dict.meta.title, description: dict.meta.description },
    robots: { index: true, follow: true },
  }
}
