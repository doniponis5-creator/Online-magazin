import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { products } from '@/data/products'
import { isLang } from '@/lib/i18n/config'
import { applianceInfo, kitchenAppliances } from '@/lib/kitchen/catalog'
import { STYLES } from '@/lib/kitchen/styles'
import { canonical } from '@/lib/seo'
import { KitchenPlanner } from '@/components/kitchen/KitchenPlanner'

/**
 * 3D-конструктор кухни. Покупатель выбирает форму, размер и стиль, а в кухню
 * встаёт настоящая техника из наличия — в своём размере и со своим фото.
 * Мебель показана для примерки стиля: её магазин не продаёт.
 */

/** «21 стиль», «22 стиля», «25 стилей» — число берём из каталога, чтобы не устаревало */
function stylesRu(n: number): string {
  const a = n % 10
  const b = n % 100
  if (a === 1 && b !== 11) return `${n} стиль`
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return `${n} стиля`
  return `${n} стилей`
}

const META = {
  ru: {
    title: '3D-конструктор кухни — Смарт Центр',
    description:
      `Соберите кухню в 3D: форма, размер стен, высота потолка, шкафы до потолка. ${stylesRu(STYLES.length)} — хай-тек, мрамор, бетон, неоклассика, сканди. Настоящая техника из наличия, чертёж и спецификация для мебельщика.`,
  },
  ky: {
    title: 'Ашкананын 3D-конструктору — Смарт Центр',
    description:
      `Ашкананы 3D форматта чогултуңуз: формасы, дубалдын өлчөмү, шыптын бийиктиги, шыпка чейин шкафтар. ${STYLES.length} стиль, дүкөндө бар чыныгы техника, мебелчи үчүн чийме жана спецификация.`,
  },
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const meta = META[lang === 'ky' ? 'ky' : 'ru']
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: canonical(`/${lang === 'ky' ? 'ky' : 'ru'}/kitchen`),
      languages: { ru: canonical('/ru/kitchen'), ky: canonical('/ky/kitchen') },
    },
    openGraph: { title: meta.title, description: meta.description, url: canonical(`/${lang}/kitchen`) },
  }
}

export default async function KitchenPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const appliances = kitchenAppliances(products)
  return <KitchenPlanner appliances={appliances} info={applianceInfo(products, appliances.map((a) => a.id), lang)} />
}
