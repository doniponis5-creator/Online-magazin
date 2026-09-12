import { notFound } from 'next/navigation'
import { getProduct } from '@/data/products'
import { Gallery } from '@/components/Gallery'

/**
 * Тестовая фикстура фотозума — НЕ часть публичной витрины: без параметра
 * ?fixture=zoom отдаёт 404, нигде не связана. Нужна, чтобы доступный
 * dialog-зум оставался проверенным до появления реальных фото товаров.
 */
export default async function DevGalleryFixturePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ fixture?: string }>
}) {
  const { lang: rawLang } = await params
  const { fixture } = await searchParams
  if (rawLang !== 'ru' && rawLang !== 'ky') notFound()
  if (fixture !== 'zoom') notFound()

  const product = getProduct('tabslate-10')
  if (!product) notFound()
  const lang = rawLang as 'ru' | 'ky'

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <Gallery
        product={product}
        colorKey={null}
        photo={{
          // проверенный архивный баннерный файл, только для фикстуры
          src: '/photos/tablet.jpg',
          altRu: 'Фикстура зума — проверка dialog',
          altKy: 'Зум фикстурасы — dialog текшерүү',
          credit: 'fixture',
        }}
      />
      <p lang={lang} style={{ marginTop: 12, fontSize: 13 }}>
        dev fixture: /dev/gallery?fixture=zoom
      </p>
    </div>
  )
}
