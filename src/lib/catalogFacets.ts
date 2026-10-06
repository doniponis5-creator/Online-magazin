/**
 * Фильтры каталога по характеристикам (владелец 06.10): телевизор — диагональ и чёткость,
 * стиральная машина — автомат/полуавтомат, загрузка, тип загрузки; швейная — вид, автомат, нити оверлока.
 *
 * Значение берётся из характеристик 1С, а если их нет — из названия («Телевизор SMART 43'»,
 * «Стиральная машина п/а …», «(Оверлок) … -5»). Не узнали — товар просто не попадает
 * ни в один пункт фильтра (и пропадает, только когда фильтр выбран). Чистые функции, без React.
 */
import type { Product } from '@/data/products'

type Lang = 'ru' | 'ky'
type Text = { ru: string; ky: string }

export type Facet = {
  /** ключ в адресе каталога: ?diag=43,55 */
  id: string
  /** раздел каталога (oneCCategories), где фильтр показывается */
  cat: string
  title: Text
  /** значение товара или null — не знаем */
  value: (p: Product) => string | null
  /** подпись значения на экране */
  label: (value: string, lang: Lang) => string
  /** порядок значений в списке */
  order: string[] | 'number'
}

/** Значение характеристики по названию строки (первое совпадение), в нижнем регистре. */
function spec(p: Product, label: RegExp): string {
  const row = p.specs.find((s) => label.test(s.labelRu))
  return row ? row.valueRu.toLowerCase().replace(/ё/g, 'е') : ''
}

function text(p: Product): string {
  return p.nameRu.toLowerCase().replace(/ё/g, 'е')
}

const fixed = (labels: Record<string, Text>) => (value: string, lang: Lang) => labels[value]?.[lang] ?? value

// ── Телевизоры ───────────────────────────────────────────────────────────────

/** Диагонали, которые выпускают телевизоры: «SMART 35+» — не диагональ, такое не берём. */
const DIAGONALS = new Set([19, 22, 24, 28, 32, 39, 40, 42, 43, 48, 50, 55, 58, 60, 65, 70, 75, 77, 80, 82, 85, 86, 98, 100])

export function tvDiagonal(p: Product): string | null {
  const fromSpec = spec(p, /^диагональ/i).match(/(\d{2,3})/)
  // «43'», «43″», «43"», «43 дюйм» или номер модели «65NANO81», «32D6P», «75E7Q»
  const fromName = p.nameRu.match(/(?:^|[\s(])(\d{2,3})(?:\s*(?:['″"”]|дюйм)|[A-Z])/i)
  for (const found of [fromSpec, fromName]) {
    const n = found ? Number(found[1]) : 0
    if (DIAGONALS.has(n)) return String(n)
  }
  return null
}

export function tvResolution(p: Product): string | null {
  const s = `${spec(p, /^разрешение/i)} ${text(p)}`
  if (/8k|7680/.test(s)) return '8k'
  if (/4k|uhd|3840/.test(s)) return '4k'
  if (/full\s*hd|fhd|1920/.test(s)) return 'fhd'
  if (/\bhd\b|1366|1280/.test(s)) return 'hd'
  return null
}

// ── Стиральные машины ────────────────────────────────────────────────────────

export function washerKind(p: Product): string | null {
  const s = `${text(p)} ${spec(p, /^тип$/i)}`
  // \b в JS не видит границу кириллицы — «п/а» ищем между пробелами
  if (/полуавтомат|(?:^|\s)п\/а(?:\s|$)/.test(s) || /^2$/.test(spec(p, /баков/i))) return 'semi'
  if (/стирал/.test(text(p))) return 'auto'
  return null
}

/** Загрузка, кг: из характеристик («8 кг», «10,5 кг») или из названия («8kg», «7.5кг», «7/4 kg» — стирка 7). */
export function washerLoad(p: Product): number | null {
  const fromSpec = spec(p, /загрузка для стирки|максимальная загрузка/i).match(/(\d+(?:[.,]\d+)?)/)
  const fromName = p.nameRu.match(/(\d+(?:[.,]\d+)?)\s*(?:\/\s*\d+\s*)?(?:kg|кг)/i)
  const found = fromSpec ?? fromName
  const kg = found ? Number(found[1].replace(',', '.')) : 0
  return kg > 0 && kg < 30 ? kg : null
}

/** Ступени загрузки: покупатель выбирает «на семью из скольких», не 7,2 против 7,5. */
export function washerLoadStep(p: Product): string | null {
  // Сушильная машина в том же разделе — в фильтры стиральных её не берём
  if (washerKind(p) === null) return null
  const kg = washerLoad(p)
  if (kg === null) return null
  if (kg < 7) return 'le6'
  if (kg < 8) return '7'
  if (kg < 9) return '8'
  return 'ge9'
}

export function washerLoading(p: Product): string | null {
  if (washerKind(p) === null) return null
  const s = spec(p, /^тип загрузки/i)
  if (/фронт/.test(s)) return 'front'
  if (/вертик/.test(s)) return 'top'
  return null
}

// ── Швейные машины ───────────────────────────────────────────────────────────

export function sewingKind(p: Product): string | null {
  const s = `${text(p)} ${spec(p, /^тип$/i)}`
  if (/оверлок|overlo/.test(s)) return 'overlock'
  if (/распошив|плоскошов/.test(s)) return 'coverstitch'
  if (/шагающ/.test(s)) return 'walking'
  if (/зигзаг/.test(s)) return 'zigzag'
  if (/прямострочн/.test(s)) return 'lockstitch'
  if (/электромеханич|бытов/.test(s)) return 'household'
  return null
}

/**
 * Прямострочная, три ступени (владелец 06.10: «кайчилик ҳам бор, отдельно бўлади»):
 * auto — автомат: компьютерная, сама обрезает нить, делает закрепку и поднимает лапку;
 * trim — «кайчи»: только обрезает нить (закрепка ручная);
 * semi — полуавтомат: ничего из этого.
 * Только у прямострочных: у оверлока и распошивалки свой выбор — нити.
 */
export function sewingAuto(p: Product): string | null {
  if (sewingKind(p) !== 'lockstitch') return null
  const type = spec(p, /^тип$/i)
  // «автоматическая смазка» есть почти у всех — это не автомат
  const does = `${spec(p, /^функции/i)} ${spec(p, /^оснащение/i)}`.replace(/автоматическ\S* смазк\S*/g, '')
  const auto =
    /автомат/.test(text(p)) ||
    /автоматическ|компьютерн/.test(type) ||
    /автоматические швейные/.test(does) ||
    (/обрезк/.test(does) && /подъем лапки|подъём лапки/.test(does) && !/ручная закрепка/.test(does))
  if (auto) return 'auto'
  if (/кайчи/.test(text(p)) || /обрезк/.test(does)) return 'trim'
  return 'semi'
}

export function overlockThreads(p: Product): string | null {
  if (sewingKind(p) !== 'overlock') return null
  const fromSpec = spec(p, /количество нитей/i).match(/\d/)
  if (fromSpec) return fromSpec[0]
  const s = `${text(p)} ${spec(p, /^тип$/i)}`
  if (/трехнит|трёхнит/.test(s)) return '3'
  if (/четырехнит|четырёхнит/.test(s)) return '4'
  if (/пятинит/.test(s)) return '5'
  const suffix = p.nameRu.match(/-(3|4|5)\b(?!\S)/)
  return suffix ? suffix[1] : null
}

// ── Список фильтров ──────────────────────────────────────────────────────────

export const FACETS: Facet[] = [
  {
    id: 'diag',
    cat: 'tv',
    title: { ru: 'Диагональ', ky: 'Диагональ' },
    value: tvDiagonal,
    label: (v) => `${v}″`,
    order: 'number',
  },
  {
    id: 'res',
    cat: 'tv',
    title: { ru: 'Чёткость', ky: 'Тактык' },
    value: tvResolution,
    label: fixed({
      '8k': { ru: '8K', ky: '8K' },
      '4k': { ru: '4K UHD', ky: '4K UHD' },
      fhd: { ru: 'Full HD', ky: 'Full HD' },
      hd: { ru: 'HD', ky: 'HD' },
    }),
    order: ['8k', '4k', 'fhd', 'hd'],
  },
  {
    id: 'wtype',
    cat: 'washers',
    title: { ru: 'Тип машины', ky: 'Машинанын түрү' },
    value: washerKind,
    label: fixed({
      auto: { ru: 'Автомат', ky: 'Автомат' },
      semi: { ru: 'Полуавтомат', ky: 'Жарым автомат' },
    }),
    order: ['auto', 'semi'],
  },
  {
    id: 'load',
    cat: 'washers',
    title: { ru: 'Загрузка', ky: 'Жүктөө' },
    value: washerLoadStep,
    label: fixed({
      le6: { ru: 'до 6,5 кг', ky: '6,5 кг чейин' },
      '7': { ru: '7 кг', ky: '7 кг' },
      '8': { ru: '8 кг', ky: '8 кг' },
      ge9: { ru: '9 кг и больше', ky: '9 кг жана көбүрөөк' },
    }),
    order: ['le6', '7', '8', 'ge9'],
  },
  {
    id: 'wload',
    cat: 'washers',
    title: { ru: 'Загрузка белья', ky: 'Кир салуу' },
    value: washerLoading,
    label: fixed({
      front: { ru: 'Фронтальная', ky: 'Алдынан' },
      top: { ru: 'Вертикальная', ky: 'Үстүнөн' },
    }),
    order: ['front', 'top'],
  },
  {
    id: 'skind',
    cat: 'sewing',
    title: { ru: 'Вид машины', ky: 'Машинанын түрү' },
    value: sewingKind,
    label: fixed({
      lockstitch: { ru: 'Прямострочная', ky: 'Түз тигүүчү' },
      overlock: { ru: 'Оверлок', ky: 'Оверлок' },
      coverstitch: { ru: 'Распошивальная', ky: 'Распошивалка' },
      zigzag: { ru: 'Зигзаг', ky: 'Зигзаг' },
      walking: { ru: 'С шагающей лапкой', ky: 'Басуучу таманы менен' },
      household: { ru: 'Бытовая', ky: 'Үй үчүн' },
    }),
    order: ['lockstitch', 'overlock', 'coverstitch', 'zigzag', 'walking', 'household'],
  },
  {
    id: 'sauto',
    cat: 'sewing',
    title: { ru: 'Прямострочная', ky: 'Түз тигүүчү' },
    value: sewingAuto,
    label: fixed({
      auto: { ru: 'Автомат', ky: 'Автомат' },
      trim: { ru: 'С обрезкой нити (кайчи)', ky: 'Кайчылуу (жипти кесет)' },
      semi: { ru: 'Полуавтомат', ky: 'Жарым автомат' },
    }),
    order: ['auto', 'trim', 'semi'],
  },
  {
    id: 'threads',
    cat: 'sewing',
    title: { ru: 'Оверлок: нитей', ky: 'Оверлок: жиптер' },
    value: overlockThreads,
    label: (v, lang) => (lang === 'ky' ? `${v} жиптүү` : `${v}-ниточный`),
    order: 'number',
  },
]

export function facetsFor(cat: string): Facet[] {
  return FACETS.filter((f) => f.cat === cat)
}

/** Выбранные значения из адреса: ?diag=43,55 → ['43', '55']. */
export function parseFacet(raw: string | null): string[] {
  return raw ? raw.split(',').map((v) => v.trim()).filter(Boolean) : []
}

/** Значения фильтра с числом товаров (по товарам, уже прошедшим остальные фильтры), в порядке facet.order. */
export function facetOptions(facet: Facet, pool: Product[]): { value: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const p of pool) {
    const v = facet.value(p)
    if (v !== null) counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  const values = [...counts.keys()]
  const order = facet.order
  values.sort(order === 'number' ? (a, b) => Number(a) - Number(b) : (a, b) => order.indexOf(a) - order.indexOf(b))
  return values.map((value) => ({ value, count: counts.get(value) ?? 0 }))
}
