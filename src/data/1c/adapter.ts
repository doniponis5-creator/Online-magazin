/**
 * Каталог из 1С → товары витрины.
 *
 * Файл catalog.json пишет программа выгрузки (scripts/1c-export/export_catalog.py)
 * из расширения 1С «Онлайн магазин». Себестоимость в файл не попадает.
 * Цена 0 означает «цена по запросу»: товар виден, но в корзину не добавляется.
 */

import type { ArtKind, Product, SpecRow } from '../products'
import { categoryForGroup, oneCCategories } from './categories'

export type OneCItem = {
  id: string
  code: string
  name: string
  article?: string
  description?: string
  /** характеристики, заданные в 1С: «Онлайн магазин» → карточка товара */
  specs?: { label: string; value: string }[]
  group?: string
  parentGroup?: string
  brand?: string
  stock: number
  /** «По остатку» | «В наличии» | «Нет в наличии» */
  availability?: string
  price: number
  oldPrice?: number
  sale?: boolean
  dealOfDay?: boolean
  /** отметка «Специально для вас» из 1С */
  forYou?: boolean
  hit?: boolean
  isNew?: boolean
  photos?: string[]
  /** стоимость доставки, сом; 0 — бесплатно */
  deliveryPrice?: number
  /** срок акции из 1С: «2026-09-25T18:00:00», бишкекское время */
  promoUntil?: string
  /** гарантия из карточки товара в 1С, месяцев; 0 — не указана */
  warrantyMonths?: number
}

export type OneCCatalog = { exportedAt?: string | null; items: OneCItem[] }

const ART_BY_CATEGORY = Object.fromEntries(oneCCategories.map((c) => [c.id, c.art])) as Record<string, ArtKind>

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh',
  щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ң: 'n', ө: 'o', ү: 'u',
}

/** Код 1С «ЦБ-00001234» → адрес страницы «cb-00001234» */
export function slugFromCode(code: string): string {
  return code
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim()
}

/**
 * «В наличии» владелец ставит, когда товар продаётся всегда: остаток в базе
 * может быть нулевым, товар привозят под заказ. Поэтому здесь остаток не
 * ограничивает корзину — иначе при остатке 1 покупатель не мог положить две
 * штуки, и кнопка «В корзину» гасла со словом «Максимум». 99 — предел, который
 * и так проверяет сервер заказов (MAX_QTY).
 */
const ALWAYS_IN_STOCK = 99

function stockFor(item: OneCItem): number {
  const stock = Math.max(0, Math.floor(item.stock || 0))
  if (item.availability === 'Нет в наличии') return 0
  if (item.availability === 'В наличии') return Math.max(stock, ALWAYS_IN_STOCK)
  return stock
}

/** Написание брендов как на логотипе (в названиях 1С встречаются опечатки). */
const BRAND_ALIASES: Record<string, string> = { BRUSE: 'BRUCE' }

/**
 * Поле «Марка» в 1С обычно не заполнено — бренд ищем по словам в названии и артикуле.
 * Список тот же, что в scripts/1c-export/export_catalog.py.
 */
const KNOWN_BRANDS = [
  'MIDEA', 'ТЕХНОМИР', 'UAKEEN', 'HANTAJI', 'ARTEL', 'VELBERG', 'VELBURG', 'SAMSUNG', 'LEVO',
  'ASCO', 'ASKO', 'AVANGARD', 'HISENSE', 'TOEAR', 'PHILIPS', 'EMIN', 'AVEST', 'CHANGHONG',
  'ARNICA', 'AUCMA', 'ITIMAT', 'FERRE', 'REDMOND', 'CHIGO', 'BOSCH', 'BEKO', 'HITACHI',
  'ARSHIA', 'BRUCE', 'BRUSE', 'BAOYU', 'KUMTEL', 'SHIVAKI', 'ARISTON', 'GEMEI', 'LG', 'XIAOMI',
  'TEFAL', 'BRAUN', 'ATLANT', 'INDESIT', 'HAIER', 'GORENJE', 'ELECTROLUX', 'POLARIS',
  'SCARLETT', 'VITEK', 'TCL', 'SONY', 'PANASONIC', 'SHARP', 'KENWOOD', 'DELONGHI', 'FLAGMAN',
]

export function detectBrand(...texts: (string | undefined)[]): string {
  const words = new Set(
    texts.flatMap((text) => (text ?? '').toUpperCase().match(/[A-ZА-ЯЁ]+/g) ?? []),
  )
  return KNOWN_BRANDS.find((brand) => words.has(brand)) ?? ''
}

export function productFromOneC(item: OneCItem): Product {
  const name = cleanName(item.name)
  const categoryId = categoryForGroup(item.group ?? '', item.parentGroup ?? '', name)
  const rawBrand = item.brand || detectBrand(item.name, item.article)
  const brand = BRAND_ALIASES[rawBrand.toUpperCase()] ?? rawBrand
  const price = Math.max(0, Math.round(item.price || 0))
  const oldPrice = item.oldPrice && item.oldPrice > price && price > 0 ? Math.round(item.oldPrice) : undefined
  // Сначала то, что владелец вписал в 1С, потом служебные строки — бренд и коды
  // покупателю менее интересны, чем объём, мощность или гарантия.
  const fromOneC = (item.specs ?? [])
    .filter((row) => row?.label?.trim() && row?.value?.trim())
    .map((row) => ({
      labelRu: row.label.trim(),
      labelKy: row.label.trim(),
      valueRu: row.value.trim(),
      valueKy: row.value.trim(),
    }))
  // Служебные строки не дублируем: если владелец сам вписал «Бренд», второй раз не добавляем.
  const taken = new Set(fromOneC.map((row) => row.labelRu.toLowerCase()))
  const auto = [
    brand ? { labelRu: 'Бренд', labelKy: 'Бренд', valueRu: brand, valueKy: brand } : null,
    item.article && item.article !== name
      ? { labelRu: 'Артикул', labelKy: 'Артикул', valueRu: item.article, valueKy: item.article }
      : null,
    { labelRu: 'Код товара', labelKy: 'Товардын коду', valueRu: item.code, valueKy: item.code },
  ].filter((s): s is SpecRow => s !== null && !taken.has(s.labelRu.toLowerCase()))
  const specs = [...fromOneC, ...auto]

  return {
    id: slugFromCode(item.code) || item.id,
    brand,
    categoryId,
    nameRu: name,
    nameKy: name,
    price,
    oldPrice,
    art: ART_BY_CATEGORY[categoryId] ?? 'box',
    image: item.photos?.[0],
    images: item.photos ?? [],
    baseColor: '#245BEB',
    descRu: item.description ?? '',
    descKy: item.description ?? '',
    specs,
    warrantyMonths: Math.max(0, Math.round(Number(item.warrantyMonths) || 0)),
    variants: [{ id: 'std', stock: stockFor(item) }],
    badge: item.hit ? 'hit' : item.isNew ? 'new' : undefined,
    sale: Boolean(item.sale),
    dealOfDay: Boolean(item.dealOfDay),
    forYou: Boolean(item.forYou),
    deliveryPrice: Math.max(0, Math.round(item.deliveryPrice || 0)),
    stockHidden: item.availability === 'В наличии',
    promoUntil: item.promoUntil,
    oneCId: item.id,
    oneCCode: item.code,
  }
}

export function productsFromOneC(catalog: OneCCatalog): Product[] {
  const seen = new Set<string>()
  const result: Product[] = []
  for (const item of catalog.items) {
    const product = productFromOneC(item)
    if (seen.has(product.id)) continue
    seen.add(product.id)
    result.push(product)
  }
  // Порядок витрины: сначала с ценой и в наличии, затем с фото, затем по названию
  return result.sort((a, b) => {
    const rank = (p: Product) =>
      (p.price > 0 ? 0 : 2) + (p.variants[0].stock > 0 ? 0 : 1) + (p.image ? 0 : 0.5)
    return rank(a) - rank(b) || a.nameRu.localeCompare(b.nameRu, 'ru')
  })
}
