import { HomeKitchens } from '@/components/gallery/HomeKitchens'
import { isLang, type Lang } from '@/lib/i18n/config'
import { HomeRest, HomeTop } from './HomeSections'

/**
 * Главная статическая (ISR): «Готовые кухни в 3D» — лучшие из галереи и
 * готовые — пересобираются раз в 5 минут, без запроса к самому сайту.
 */
export const revalidate = 300

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const raw = (await params).lang
  const lang: Lang = isLang(raw) ? raw : 'ru'
  return (
    <div className="container">
      <HomeTop />
      <HomeKitchens lang={lang} />
      <HomeRest />
    </div>
  )
}
