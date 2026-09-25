import type { HandleKind, Metal } from './styles'

/**
 * Конструктор кухни: общие типы.
 *
 * Все размеры — в сантиметрах. Мебель здесь только для примерки стиля, её мы
 * не продаём. Техника — настоящие товары магазина со своими размерами и фото.
 */

export type Shape = 'straight' | 'corner' | 'u' | 'island'

export type SlotKind = 'fridge' | 'oven' | 'microwave' | 'hob' | 'hood' | 'dishwasher' | 'washer'

export const SLOTS: SlotKind[] = ['fridge', 'oven', 'hob', 'hood', 'dishwasher', 'microwave', 'washer']

/** Цвет корпуса техники — от него зависит материал в 3D. */
export type Finish = 'black' | 'white' | 'inox' | 'gray' | 'beige'

export type HoodKind = 'chimney' | 'telescopic' | 'insert' | 'inclined'
export type FridgeKind = 'bottom' | 'top' | 'sbs' | 'french' | 'single'
export type HobKind = 'electric' | 'induction' | 'gas'

/** Товар магазина, который можно поставить в кухню. */
export type KitchenAppliance = {
  id: string
  slot: SlotKind
  name: string
  brand: string
  price: number
  oldPrice?: number
  image?: string
  /** ширина × высота × глубина, см */
  w: number
  h: number
  d: number
  /** размеры взяты из характеристик, а не из типовых для этого вида */
  sizeKnown: boolean
  builtIn: boolean
  finish: Finish
  hood?: HoodKind
  fridge?: FridgeKind
  hob?: HobKind
  burners?: number
}

/**
 * То, что покупатель может переставлять: техника, мойка, пеналы, отдельная
 * духовка — и свои шкафы (k1, k2…). Остальные шкафы между ними
 * раскладываются сами.
 */
export type FixedItem = 'fridge' | 'tall' | 'sink' | 'dishwasher' | 'washer' | 'hob' | 'pantry' | 'pantry2' | 'oven'
export const ITEM_KEYS: FixedItem[] = ['fridge', 'tall', 'sink', 'dishwasher', 'washer', 'hob', 'pantry', 'pantry2', 'oven']
/** Свой шкаф покупателя: его перетащили или поменяли ширину. */
export type CabinetId = `k${number}`
export type ItemKey = FixedItem | CabinetId
export const isCabinet = (k: string): k is CabinetId => /^k\d{1,3}$/.test(k)
/** Свой шкаф: ширина, см, и фасады. */
export type Cabinet = { w: number; front: BaseFront }
/** Предметы, которым покупатель может поменять ширину (кроме своих шкафов). */
export type SizedItem = 'sink' | 'hob' | 'pantry' | 'pantry2' | 'tall'
export const SIZED_ITEMS: SizedItem[] = ['sink', 'hob', 'pantry', 'pantry2', 'tall']
/** Высокие колонны: им можно задать свою высоту (ниже потолка). */
export type ColumnItem = 'pantry' | 'pantry2' | 'tall'
export const COLUMN_ITEMS: ColumnItem[] = ['pantry', 'pantry2', 'tall']

/** Стены: A — задняя, B — левая, C — правая; I — остров. */
export type WallId = 'A' | 'B' | 'C' | 'I'

/** Порядок предметов по стенам. У A — слева направо, у B и C — от угла к зрителю. */
export type Arrangement = Partial<Record<WallId, ItemKey[]>>

/** Выбор покупателя. null — «не нужно», id — конкретная модель. */
export type Picks = Partial<Record<SlotKind, string | null>>

export type KitchenState = {
  shape: Shape
  /** длина задней стены */
  a: number
  /** левая стена (угловая и П-образная) */
  b: number
  /** правая стена (П-образная) */
  c: number
  /** длина острова */
  island: number
  style: StyleId
  tone: number
  picks: Picks
  /** свой порядок техники; нет — раскладка по правилам */
  arrangement?: Arrangement
  /** духовка на уровне глаз — в пенале, даже без микроволновки */
  tallOven?: boolean
  /** пеналы для хранения: 0, 1 или 2 */
  pantries?: number
  /** высота потолка, см; нет — 270 */
  ceiling?: number
  /** верхние шкафы только до обычной высоты; нет — до потолка, с антресолями */
  lowUppers?: boolean
  /** окна нет */
  noWindow?: boolean
  /** ширина окна, см; нет — типовая */
  windowW?: number
  /** холодильник стоит отдельно: без боковин и антресоли над ним */
  fridgeOpen?: boolean
  /** свой пол вместо пола стиля */
  floor?: FloorKind
  /** свой цвет стен: номер в палитре WALL_COLORS */
  wallColor?: number
  /** свои фасады отдельных шкафов: ключ — ряд и начало шкафа (A120, a60) */
  fronts?: Record<string, FrontVariant>
  /** духовка в своём шкафу под столешницей, отдельно от плиты */
  ovenApart?: boolean
  /** свои шкафы (перетащенные или с другой шириной) */
  cabinets?: Record<CabinetId, Cabinet>
  /**
   * Своё место предмета на стене: середина, см от угла (как в itemPositions).
   * Нет — предмет стоит там, куда его ставят правила, а шкафы вокруг делят
   * остаток стены.
   */
  at?: Partial<Record<ItemKey, number>>
  /** своя ширина мойки, шкафа под плитой, пеналов и колонны с духовкой, см */
  widths?: Partial<Record<SizedItem, number>>
  /** своя высота пеналов и колонны с духовкой от пола, см; нет — до верха (потолка) */
  heights?: Partial<Record<ColumnItem, number>>
  /**
   * Шкафы, у которых одиночная дверца открывается вправо (петли справа).
   * Ключ — как у фасадов (A120, a60), свой шкаф (k1) или предмет (sink, tall,
   * pantry, hob). Остальные дверцы открываются влево.
   */
  doorsRight?: string[]
  /** отделка: цвет фасадов из каталога (ламинат, акрил, эмаль, шпон, Fenix) */
  facade?: string
  /** цвет верхних фасадов, если другой */
  upperFacade?: string
  /**
   * свой цвет фасада шкафа над холодильником (у стекла — рамки); нет — как у
   * верха гарнитура. Холодильник на кухне один, поэтому ключ шкафа не нужен.
   */
  overFridgeFacade?: string
  /** столешница из каталога */
  top?: string
  /** фартук из каталога: камень, цветное стекло, плитка, простой */
  splash?: string
  /** ручки: вид и металл; handleless — без ручек (профиль Gola) */
  handle?: HandleKind
  handleMetal?: Metal
  handleless?: boolean
}

/** Пол комнаты. */
export type FloorKind = 'herringbone' | 'herringboneDark' | 'oak' | 'darkOak' | 'tile' | 'terracotta' | 'concrete' | 'marble'

/**
 * Как устроен шкаф спереди. Низ: дверцы, 2–4 ящика, ящик над дверцами,
 * открытые полки. Верх: дверцы, стекло, подъёмная дверца, полки, без шкафа.
 */
export type BaseFront = 'doors' | 'drawers2' | 'drawers3' | 'drawers4' | 'mix' | 'open'
export type UpperFront = 'doors' | 'glass' | 'lift' | 'open' | 'none'
export type FrontVariant = BaseFront | UpperFront

export type StyleId =
  | 'classic'
  | 'neoclassic'
  | 'hitech'
  | 'nero'
  | 'concrete'
  | 'marble'
  | 'glass'
  | 'minimal'
  | 'loft'
  | 'scandi'
  | 'modern'
  | 'column'
  | 'portal'
  | 'japandi'
  | 'provence'
  | 'artdeco'
  | 'country'
  | 'gold'
  | 'quiet'
  | 'midcentury'
  | 'english'
