export type CategoryId = 'smartphones' | 'laptops' | 'tv' | 'home' | 'tablets' | 'accessories'

export const categories: {
  id: CategoryId
  nameRu: string
  nameKy: string
}[] = [
  { id: 'smartphones', nameRu: 'Смартфоны', nameKy: 'Смартфондор' },
  { id: 'laptops', nameRu: 'Ноутбуки', nameKy: 'Ноутбуктар' },
  { id: 'tv', nameRu: 'Телевизоры', nameKy: 'Телевизорлор' },
  { id: 'home', nameRu: 'Техника для дома', nameKy: 'Үй техникасы' },
  { id: 'tablets', nameRu: 'Планшеты', nameKy: 'Планшеттер' },
  { id: 'accessories', nameRu: 'Аксессуары', nameKy: 'Аксессуарлар' },
]

export function categoryName(id: CategoryId, lang: 'ru' | 'ky'): string {
  const cat = categories.find((c) => c.id === id)
  if (!cat) return id
  return lang === 'ky' ? cat.nameKy : cat.nameRu
}
