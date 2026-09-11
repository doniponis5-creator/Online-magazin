import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { defaultLang, isLang, type Lang } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { CartProvider } from '@/lib/cart/CartProvider'
import { FavoritesProvider } from '@/lib/favorites/FavoritesProvider'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { Footer } from '@/components/Footer'
import { HtmlLang } from '@/components/HtmlLang'
import { MotionProvider } from '@/components/MotionProvider'

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

  return (
    <I18nProvider lang={lang} dict={dict}>
      <CartProvider>
        <FavoritesProvider>
          <HtmlLang lang={lang} />
          <MotionProvider />
          <a href="#content" className="skip-link">
            {dict.nav.skipToContent}
          </a>
          <Header />          <main id="content" tabIndex={-1}>
            {children}
          </main>
          <Footer />
          <BottomNav />
        </FavoritesProvider>
      </CartProvider>
    </I18nProvider>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params
  const lang: Lang = isLang(raw) ? raw : defaultLang
  const dict = getDictionary(lang)
  return { title: dict.meta.title, description: dict.meta.description }
}
