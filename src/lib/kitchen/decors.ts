/**
 * Декоры ЛДСП с настоящим кодом производителя — по 10–12 ходовых у бренда:
 * белые и серые однотоны, дубы, бетон и камень. Мастер заказывает лист по коду.
 *
 * Код и название сверены с официальными каталогами 27.09.2026:
 * - Egger — egger.com/ru (decor-detail/<код>) и egger-russia.ru/furniture-interior-design/decors/<код>/
 * - Kronospan — kronospan.com/ru_KZ/decors/view/kronodesign/<код>/: взяты только декоры, у которых
 *   во вкладке «Продукты» есть «Ламинированная древесностружечная плита (ЛДСП)» (K091, K200, K201,
 *   K203, K205 там — только столешницы, стеновые панели и HPL, поэтому их нет). Однотоны у Kronospan
 *   сейчас с буквой K (K112, K164, K190): страницы с номерами 0112/0164/0190 на ru_KZ не открываются.
 * - Lamarty — lamarty.ru/lamarty/decors/ (номеров у декоров нет: декор зовут по имени,
 *   поэтому печатный код — только «Lamarty», а id — по адресу страницы декора на lamarty.ru)
 *
 * Экранный цвет подобран вручную по описанию и превью — примерный (покупателю это сказано
 * под палитрой). Фото декоров не берём: права производителя; рисунок строит генератор
 * фактур (`wood` / `concrete`; камень — как `concrete`). Список поправит поставщик владельца.
 */

export type DecorBrand = 'egger' | 'kronospan' | 'lamarty'

export type Decor = {
  /** `dec-<бренд>-<код в нижнем регистре, пробелы → дефис>`; у Lamarty — по адресу страницы декора */
  id: string
  brand: DecorBrand
  /** код в каталоге бренда: «H1145 ST10», «K001»; у Lamarty пусто — декор зовут по имени */
  code: string
  ru: string
  ky: string
  /** экранный цвет, примерный */
  color: string
  texture?: 'wood' | 'concrete'
}

export const DECOR_BRANDS: { id: DecorBrand; name: string }[] = [
  { id: 'egger', name: 'Egger' },
  { id: 'kronospan', name: 'Kronospan' },
  { id: 'lamarty', name: 'Lamarty' },
]

const idOf = (brand: DecorBrand, code: string) => `dec-${brand}-${code.toLowerCase().trim().replace(/[\s_]+/g, '-')}`

type Row = [code: string, ru: string, ky: string, color: string, texture?: 'wood' | 'concrete']

const coded = (brand: DecorBrand, rows: Row[]): Decor[] =>
  rows.map(([code, ru, ky, color, texture]) => ({ id: idOf(brand, code), brand, code, ru, ky, color, ...(texture ? { texture } : {}) }))

/** Lamarty: [адрес страницы на lamarty.ru, название, …] — номера у декора нет. */
const named = (rows: Row[]): Decor[] =>
  rows.map(([slug, ru, ky, color, texture]) => ({ id: idOf('lamarty', slug), brand: 'lamarty', code: '', ru, ky, color, ...(texture ? { texture } : {}) }))

export const DECORS: Decor[] = [
  ...coded('egger', [
    ['W1000 ST9', 'Белый Премиум', 'Премиум ак', '#f4f3ee'],
    ['W980 ST2', 'Белый платиновый', 'Платина ак', '#eeeeea'],
    ['U702 ST9', 'Кашемир серый', 'Кашемир боз', '#b9ada0'],
    ['U961 ST2', 'Чёрный графит', 'Графит кара', '#3a3b3d'],
    ['U999 ST2', 'Чёрный', 'Кара', '#1f2022'],
    ['F186 ST9', 'Бетон Чикаго светло-серый', 'Чикаго бетону, ачык боз', '#a8a49d', 'concrete'],
    ['F187 ST9', 'Бетон Чикаго тёмно-серый', 'Чикаго бетону, кочкул боз', '#5f5b56', 'concrete'],
    ['H1145 ST10', 'Дуб Бардолино натуральный', 'Бардолино эмени, табигый', '#b58d62', 'wood'],
    ['H1180 ST37', 'Дуб Галифакс натуральный', 'Галифакс эмени, табигый', '#a5774b', 'wood'],
    ['H3303 ST10', 'Дуб Гамильтон натуральный', 'Гамильтон эмени, табигый', '#b0885d', 'wood'],
    ['H3309 ST28', 'Дуб Гладстоун песочный', 'Гладстоун эмени, кумдуу', '#c3a57f', 'wood'],
    ['H1344 ST32', 'Дуб Шерман коньяк коричневый', 'Шерман эмени, коньяк күрөң', '#7a5337', 'wood'],
  ]),
  ...coded('kronospan', [
    ['K101', 'Белый Фасадный', 'Фасаддык ак', '#f2f1ed'],
    ['K112', 'Серый Камень', 'Боз таш', '#c8c8c4'],
    ['0540', 'Серый Манхеттен', 'Манхэттен боз', '#8d8f8f'],
    ['K164', 'Антрацит', 'Антрацит', '#3e4043'],
    ['K190', 'Черный', 'Кара', '#1d1d1f'],
    ['K001', 'Дуб Крафт Белый', 'Крафт эмени, ак', '#d8cdbd', 'wood'],
    ['K002', 'Дуб Крафт Серый', 'Крафт эмени, боз', '#9e958a', 'wood'],
    ['K003', 'Дуб Крафт Золотой', 'Крафт эмени, алтын', '#c1935d', 'wood'],
    ['K004', 'Дуб Крафт Табачный', 'Крафт эмени, тамеки түс', '#8a6242', 'wood'],
    ['K086', 'Гикори Рокфорд Натуральный', 'Рокфорд гикориси, табигый', '#b38a60', 'wood'],
    ['K350', 'Бетонный Камень', 'Бетон таш', '#a9a8a4', 'concrete'],
    ['K353', 'Угольный Камень', 'Көмүр таш', '#4b4b4c', 'concrete'],
  ]),
  ...named([
    ['white', 'Белый', 'Ак', '#efefea'],
    ['snow_white', 'Белоснежный', 'Кардай ак', '#f7f7f5'],
    ['grey_stone', 'Серый камень', 'Боз таш', '#a9a7a2'],
    ['marengo', 'Маренго', 'Маренго', '#6c6f72'],
    ['graphite', 'Графит', 'Графит', '#45484b'],
    ['black', 'Черный', 'Кара', '#1e1f21'],
    ['wotan_oak', 'Дуб Вотан', 'Вотан эмени', '#7b6857', 'wood'],
    ['sonoma_eiche', 'Дуб Сонома', 'Сонома эмени', '#c9a67b', 'wood'],
    ['galiano_oak', 'Дуб Галиано', 'Галиано эмени', '#8f6c4c', 'wood'],
    ['marsala_oak', 'Дуб Марсала', 'Марсала эмени', '#6a4a36', 'wood'],
    ['sandy_oak', 'Дуб Сэнди', 'Сэнди эмени', '#c7aa84', 'wood'],
    ['cement', 'Цемент', 'Цемент', '#9c9994', 'concrete'],
  ]),
]

const BY_ID = new Map(DECORS.map((d) => [d.id, d]))

export function decor(id: string): Decor | undefined {
  return BY_ID.get(id)
}

/** Печатный код для мастера: «Egger H1145 ST10», «Kronospan K001»; у Lamarty — «Lamarty» (номера нет). */
export function decorCode(d: Decor): string {
  const brand = DECOR_BRANDS.find((b) => b.id === d.brand)!.name
  return d.code ? `${brand} ${d.code}` : brand
}
