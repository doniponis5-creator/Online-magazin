import type { ArtKind } from './products'
import oneCCatalog from './1c/catalog.json'
import { oneCCategories } from './1c/categories'

export type CategoryId = string

export type Category = {
  id: CategoryId
  nameRu: string
  nameKy: string
  /** иконка раздела и плейсхолдер товара без фото */
  art: ArtKind
}

const demoCategories: Category[] = [
  { id: 'smartphones', nameRu: 'Смартфоны', nameKy: 'Смартфондор', art: 'phone' },
  { id: 'laptops', nameRu: 'Ноутбуки', nameKy: 'Ноутбуктар', art: 'laptop' },
  { id: 'tv', nameRu: 'Телевизоры', nameKy: 'Телевизорлор', art: 'tv' },
  { id: 'home', nameRu: 'Техника для дома', nameKy: 'Үй техникасы', art: 'washer' },
  { id: 'tablets', nameRu: 'Планшеты', nameKy: 'Планшеттер', art: 'tablet' },
  { id: 'accessories', nameRu: 'Аксессуары', nameKy: 'Аксессуарлар', art: 'headphones' },
]

/** Разделы витрины: из 1С, когда выгрузка не пустая, иначе демо-разделы. */
export const categories: Category[] = oneCCatalog.items.length > 0 ? oneCCategories : demoCategories

export function categoryName(id: CategoryId, lang: 'ru' | 'ky'): string {
  const cat = categories.find((c) => c.id === id)
  if (!cat) return id
  return lang === 'ky' ? cat.nameKy : cat.nameRu
}
