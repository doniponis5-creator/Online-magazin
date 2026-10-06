import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLang, defaultLang } from '@/lib/i18n/config'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = getDictionary(isLang(lang) ? lang : defaultLang)
  // Своя у каждого покупателя (из браузера) — поисковику показывать нечего.
  return { title: `${t.compare.title} — Смарт Центр`, description: t.meta.description, robots: { index: false } }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
