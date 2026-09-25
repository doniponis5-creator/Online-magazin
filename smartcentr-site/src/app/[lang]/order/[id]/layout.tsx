import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLang, defaultLang } from '@/lib/i18n/config'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = getDictionary(isLang(lang) ? lang : defaultLang)
  // страница заказа личная — не индексируем
  return { title: `${t.order.title} — Смарт Центр`, robots: { index: false, follow: false } }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
