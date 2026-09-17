import { CatalogView } from '@/components/CatalogView'

export const metadata = {
  title: 'Каталог — Smart Centr',
}

// Состояние каталога живёт в URL и читается клиентом; страница статична.
export default function CatalogPage() {
  return <CatalogView />
}
