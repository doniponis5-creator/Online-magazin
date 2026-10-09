import { CatalogView } from '@/components/CatalogView'

export const metadata = {
  title: 'Каталог — Смарт Центр',
}

// Состояние каталога живёт в URL. Страница читает searchParams, поэтому сервер рисует её
// по адресу: товары приходят в HTML сразу. Раньше страница была статичной, и сервер
// отдавал пустое место — товары появлялись только после загрузки скриптов (аудит 09.10).
export default async function CatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await searchParams
  return <CatalogView />
}
