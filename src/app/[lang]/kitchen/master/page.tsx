import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { products } from '@/data/products'
import { isLang } from '@/lib/i18n/config'
import { applianceInfo, kitchenAppliances } from '@/lib/kitchen/catalog'
import { canonical } from '@/lib/seo'
import { KitchenPlanner } from '@/components/kitchen/KitchenPlanner'

/**
 * Лист мастера: та же кухня, что в конструкторе (состояние — в адресе страницы),
 * но без шагов покупателя. Только то, что нужно мебельщику: 3D для сверки,
 * чертежи стен, спецификация, раскрой, смета. Покупатель видит этот лист по
 * кнопке «Открыть лист мастера» и отправляет ссылку мастеру.
 */

const META = {
  ru: { title: 'Лист мастера — 3D-конструктор кухни — Смарт Центр', description: 'Чертежи стен, спецификация, раскрой и смета по кухне из конструктора.' },
  ky: { title: 'Устанын барагы — ашкананын 3D-конструктору — Смарт Центр', description: 'Дубалдардын чиймелери, спецификация, кесүү жана смета.' },
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const meta = META[lang === 'ky' ? 'ky' : 'ru']
  return {
    title: meta.title,
    description: meta.description,
    // страница зависит от адреса конкретной кухни — в поиске ей делать нечего
    robots: { index: false, follow: false },
    alternates: { canonical: canonical(`/${lang === 'ky' ? 'ky' : 'ru'}/kitchen/master`) },
  }
}

export default async function KitchenMasterPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const appliances = kitchenAppliances(products)
  return <KitchenPlanner mode="master" appliances={appliances} info={applianceInfo(products, appliances.map((a) => a.id), lang)} />
}
