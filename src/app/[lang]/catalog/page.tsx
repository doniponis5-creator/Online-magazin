import { CatalogView } from '@/components/CatalogView'

export const metadata = {
  title: 'Каталог — Смарт Центр',
}

// Состояние каталога живёт в URL и читается клиентом; страница статична.
export default function CatalogPage() {
  return <CatalogView />
}
