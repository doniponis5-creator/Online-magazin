import 'server-only'
import { READY, readyKitchen, type ReadyKitchen } from '@/data/kitchen-ready'
import { products } from '@/data/products'
import { kitchenTexts } from '@/components/kitchen/texts'
import type { Lang } from '@/lib/i18n/config'
import { kitchenAppliances } from '@/lib/kitchen/catalog'
import { planKitchen } from '@/lib/kitchen/layout'
import { chosenItems, frontsText, planInputOf, projectItems, projectTotal, wallsText } from '@/lib/kitchen/order'
import { stateFromQuery } from '@/lib/kitchen/share'
import { getStyle } from '@/lib/kitchen/styles'
import { SLOTS, type KitchenAppliance, type KitchenState, type Shape, type SlotKind } from '@/lib/kitchen/types'
import { KITCHEN_ID, PAGE_SIZE, sizeBand, thumbOf, titleOf, wallLength, type GalleryCard, type GalleryComment, type SizeBand } from '@/lib/gallery/rules'
import { getKitchen, listKitchens, publishedIndex } from '@/lib/gallery/store'
import { galleryTexts } from '@/lib/gallery/texts'

/**
 * Данные страниц галереи — из хранилища напрямую, техника и цены — из
 * текущего каталога при каждом показе. Всё, что уходит в разметку, собрано
 * здесь; телефонов в этих типах нет и взяться им неоткуда: хранилище отдаёт
 * только публичные `GalleryCard`/`GalleryKitchen`.
 */

const image = (name: string) => `/api/gallery/image/${name}`

let catalog: { list: KitchenAppliance[]; known: Map<string, KitchenAppliance> } | null = null
function appliances() {
  if (!catalog) {
    const list = kitchenAppliances(products)
    catalog = { list, known: new Map(list.map((a) => [a.id, a])) }
  }
  return catalog
}

/** Длина всех стен — правило в `rules.ts` (по нему фильтрует и хранилище). */
export { wallLength }

function stateOf(q: string): KitchenState {
  return stateFromQuery(new URLSearchParams(q), appliances().known)
}

export type TechRow = {
  slot: SlotKind
  slotName: string
  name: string | null
  /** есть в каталоге — ссылка на карточку товара */
  productId: string | null
  price: number | null
  note: 'noStock' | 'notFit' | null
}

export type KitchenFacts = {
  shape: Shape
  shapeName: string
  walls: string
  style: string
  /** цвет фасадов с кодом; '' — как в стиле */
  fronts: string
  rows: TechRow[]
  total: number
  wallLength: number
}

/**
 * Что в кухне: форма, стены, стиль, цвета, техника по текущим ценам.
 * Модель из проекта, которой больше нет в каталоге, — строка «нет в наличии»,
 * а не подмена другой моделью.
 */
export function kitchenFacts(q: string, lang: Lang): KitchenFacts {
  const { list, known } = appliances()
  const params = new URLSearchParams(q)
  const asked = stateFromQuery(params, new Set(params.values())).picks
  const state = stateFromQuery(params, known)
  const gone = new Set(SLOTS.filter((slot) => typeof asked[slot] === 'string' && !known.has(asked[slot] as string)))
  for (const slot of gone) state.picks[slot] = null

  const kt = kitchenTexts(lang)
  const chosen = chosenItems(state.picks, list)
  const plan = planKitchen(planInputOf(state, chosen, []), { shelves: getStyle(state.style).shelves })
  const items = projectItems(state, plan, list)
  const rows: TechRow[] = []
  for (const slot of SLOTS) {
    const item = items.find((i) => i.slot === slot)
    if (gone.has(slot) || item?.status === 'noStock' || item?.status === 'typical') {
      rows.push({ slot, slotName: kt.slots[slot], name: null, productId: null, price: null, note: 'noStock' })
    } else if (item?.appliance) {
      const a = item.appliance
      rows.push({ slot, slotName: kt.slots[slot], name: a.name, productId: a.id, price: a.price, note: item.inTotal ? null : 'notFit' })
    }
  }
  const style = getStyle(state.style)
  return {
    shape: state.shape,
    shapeName: kt.shapes[state.shape][0],
    walls: wallsText(state, lang),
    style: style[lang],
    fronts: frontsText(state, lang),
    rows,
    total: projectTotal(items).sum,
    wallLength: wallLength(state),
  }
}

export type Tile = {
  /** адрес страницы: /<lang>/kitchen/gallery/<id> */
  id: string
  title: string
  image: string
  /** маленькое фото «вживую» поверх угла кадра */
  realThumb: string | null
  author: string
  master: boolean
  /** кухня из галереи (оценки, комментарии); готовая — нет */
  social: boolean
  avg: number
  count: number
  comments: number
  total: number
}

function authorOf(card: Pick<GalleryCard, 'authorName' | 'role'>, lang: Lang): string {
  const t = galleryTexts(lang)
  return card.authorName || (card.role === 'master' ? t.master : t.buyer)
}

/** Название, собранное из проекта (`autoTitle`), — на языке страницы; своё — как написал автор. */
function titleFor(card: Pick<GalleryCard, 'q' | 'title'> & { autoTitle?: boolean }, lang: Lang): string {
  return card.autoTitle ? titleOf(card.q, lang) : card.title
}

/**
 * Сумма техники кухни по текущим ценам. Проект по q не меняется, каталог — только
 * при выкладке (процесс перезапускается), поэтому считаем раз на q и язык.
 */
const totals = new Map<string, number>()
function totalOf(q: string, lang: Lang): number {
  const key = `${lang}|${q}`
  let sum = totals.get(key)
  if (sum === undefined) {
    sum = kitchenFacts(q, lang).total
    if (totals.size > 5000) totals.clear()
    totals.set(key, sum)
  }
  return sum
}

function tileOf(card: GalleryCard, lang: Lang): Tile {
  return {
    id: card.id,
    title: titleFor(card, lang),
    image: image(card.thumb),
    realThumb: card.realThumb ? image(card.realThumb) : null,
    author: authorOf(card, lang),
    master: card.role === 'master',
    social: true,
    avg: card.avg,
    count: card.count,
    comments: card.commentCount,
    total: totalOf(card.q, lang),
  }
}

function readyTile(k: ReadyKitchen, lang: Lang): Tile {
  return {
    id: `ready-${k.id}`,
    title: k[lang],
    image: k.thumb,
    realThumb: null,
    author: galleryTexts(lang).shop,
    master: false,
    social: false,
    avg: 0,
    count: 0,
    comments: 0,
    total: totalOf(k.q, lang),
  }
}

export type TileFilter = { shape?: Shape; size?: SizeBand }

const fits = (q: string, f: TileFilter) => {
  const s = stateOf(q)
  return (!f.shape || s.shape === f.shape) && (!f.size || sizeBand(wallLength(s)) === f.size)
}

/** Готовые кухни с фильтром формы и размера. */
export function readyTiles(lang: Lang, filter: TileFilter = {}): Tile[] {
  return READY.filter((k) => fits(k.q, filter)).map((k) => readyTile(k, lang))
}

export type GalleryQuery = TileFilter & {
  lang: Lang
  sort: 'new' | 'top'
  real?: boolean
  authorId?: string
  /** «мои» — телефон из сессии */
  phone?: string
  /** сколько страниц по 24 показать («Ещё» добавляет страницу), не больше 5 */
  upto?: number
}

/** Больше пяти страниц «Ещё» не раскрывает: дальше — фильтры. */
const MAX_UPTO = 5

/** Кухни галереи: первые `upto`×24 после фильтров — один запрос к хранилищу; `more` — есть ещё. */
export async function galleryTiles(query: GalleryQuery): Promise<{ items: Tile[]; total: number; more: boolean }> {
  const { lang, upto = 1, ...rest } = query
  const want = Math.max(1, Math.min(MAX_UPTO, Math.floor(upto) || 1)) * PAGE_SIZE
  const res = await listKitchens({
    sort: rest.sort,
    shape: rest.shape,
    size: rest.size,
    authorId: rest.authorId,
    phone: rest.phone,
    real: rest.real,
    page: 1,
    limit: want,
  })
  // на пятой странице «Ещё» больше не показываем: дальше помогают фильтры
  return { items: res.items.map((c) => tileOf(c, lang)), total: res.total, more: res.total > want && want < MAX_UPTO * PAGE_SIZE }
}

/** Все опубликованные кухни — для карты сайта (скрытых хранилище не отдаёт). */
export const publishedKitchens = publishedIndex

export type KitchenPageData = {
  /** адрес: <hex> или ready-<id> */
  id: string
  /** id для /api/gallery/<id>; у готовой — null */
  apiId: string | null
  social: boolean
  q: string
  title: string
  author: string
  /** «Все кухни мастера» — фильтр ?author= */
  authorId: string | null
  master: boolean
  createdAt: string | null
  avg: number
  count: number
  /** кадр 3D 1200×750 */
  image: string
  /** картинка для Telegram/Instagram */
  card: string
  cardSize: { width: number; height: number }
  comments: (GalleryComment & { author: string })[]
  realPhotos: { full: string; thumb: string }[]
  facts: KitchenFacts
}

/** Страница кухни; скрытой, чужого адреса и пропавшей готовой — null (404). */
export async function kitchenPage(id: string, lang: Lang): Promise<KitchenPageData | null> {
  const t = galleryTexts(lang)
  if (id.startsWith('ready-')) {
    const k = readyKitchen(id.slice(6))
    if (!k) return null
    return {
      id,
      apiId: null,
      social: false,
      q: k.q,
      title: k[lang],
      author: t.shop,
      authorId: null,
      master: false,
      createdAt: null,
      avg: 0,
      count: 0,
      image: k.image,
      card: k.card,
      cardSize: { width: 1200, height: 630 },
      comments: [],
      realPhotos: [],
      facts: kitchenFacts(k.q, lang),
    }
  }
  if (!KITCHEN_ID.test(id)) return null
  const k = await getKitchen(id)
  if (!k) return null
  return {
    id,
    apiId: id,
    social: true,
    q: k.q,
    title: titleFor(k, lang),
    author: authorOf(k, lang),
    authorId: k.authorId,
    master: k.role === 'master',
    createdAt: k.createdAt,
    avg: k.avg,
    count: k.count,
    image: image(k.image),
    card: image(k.image),
    cardSize: { width: 1200, height: 750 },
    comments: k.comments.map((c) => ({ ...c, author: c.authorName || t.buyer })),
    realPhotos: k.realPhotos.map((name) => ({ full: image(name), thumb: image(thumbOf(name)) })),
    facts: kitchenFacts(k.q, lang),
  }
}
