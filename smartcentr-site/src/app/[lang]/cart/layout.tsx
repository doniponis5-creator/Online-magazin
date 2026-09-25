import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLang, defaultLang } from '@/lib/i18n/config'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = getDictionary(isLang(lang) ? lang : defaultLang)
  return { title: `${t.cart.title} — Смарт Центр`, description: t.meta.description }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
