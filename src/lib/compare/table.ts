/**
 * Строки таблицы сравнения: сначала то, что важно всем (цена, рассрочка, гарантия, наличие, бренд),
 * потом характеристики 1С — объединение строк всех товаров в порядке первого появления.
 * Чего у товара нет — null (на экране «—»), ничего не выдумываем. Чистые функции, без React.
 */
import type { Product } from '@/data/products'
import { formatSom } from '@/lib/format'
import { adalMonthly } from '@/lib/installment'

export type CompareRow = {
  key: string
  label: string
  values: (string | null)[]
  /** значения у товаров разные (или у кого-то нет) — эту строку показываем и в «Только отличия» */
  differ: boolean
  /** номера товаров с лучшим значением (дешевле, меньше в месяц, дольше гарантия); пусто — отмечать нечего */
  best: number[]
  /** насколько лучшее значение лучше ближайшего другого (сом или месяцы); null — отмечать нечего */
  lead: number | null
  /** «главное» (цена, рассрочка, гарантия, наличие, бренд) или характеристика 1С */
  group: 'main' | 'specs'
}

export type CompareWords = {
  price: string
  installment: string
  perMonth: (sum: string) => string
  warranty: string
  warrantyOf: (months: number) => string
  stock: string
  inStock: string
  outOfStock: string
  preorder: string
  brand: string
}

/** Служебные строки 1С: покупателю сравнивать нечего. «Бренд» — своя строка выше. */
const SKIP = /^(код товара|товардын коду|артикул|бренд)$/i

const same = (v: string | null) => (v ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()

/**
 * Одно и то же в 1С у разных брендов названо по-разному («Загрузка для стирки» у LG, «Максимальная
 * загрузка» у TOSHIBA) — в сравнении это одна строка. Только точные синонимы: «Размеры Ш×В×Г» и
 * «Габариты (В×Ш×Г)» не сводим — порядок чисел разный, покупатель сравнил бы не то.
 */
const SYNONYMS: Record<string, string> = {
  'максимальная загрузка': 'загрузка для стирки',
  'тип двигателя': 'двигатель',
  'тип мотора': 'двигатель',
  'защита от детей': 'блокировка от детей',
  'класс энергоэффективности': 'класс энергопотребления',
  'максимальная скорость отжима': 'скорость отжима',
}
const specKey = (label: string) => {
  const key = same(label)
  return SYNONYMS[key] ?? key
}

function row(key: string, label: string, values: (string | null)[], group: CompareRow['group'] = 'main'): CompareRow {
  const seen = new Set(values.map(same))
  return { key, label, values, differ: seen.size > 1, best: [], lead: null, group }
}

/**
 * Лучшее отмечаем только там, где «лучше» однозначно: цена и платёж в месяц — меньше, гарантия — дольше.
 * Шум, размеры, мощность — покупатель решает сам, там отметки нет. Нужны хотя бы два известных
 * значения и разница между ними; равные лучшие отмечаются все.
 */
export function bestOf(numbers: (number | null)[], lower: boolean): number[] {
  const known = numbers.filter((n): n is number => n !== null && n > 0)
  if (known.length < 2 || new Set(known).size < 2) return []
  const top = lower ? Math.min(...known) : Math.max(...known)
  return numbers.flatMap((n, i) => (n === top ? [i] : []))
}

/**
 * Разница между лучшим и ближайшим к нему значением: «дешевле на 6 600 сом» верно против каждого
 * из остальных товаров. Лучшего нет — null.
 */
export function leadOf(numbers: (number | null)[], lower: boolean): number | null {
  const best = bestOf(numbers, lower)
  if (!best.length) return null
  const top = numbers[best[0]] as number
  const rest = numbers.filter((n): n is number => n !== null && n > 0 && n !== top)
  const next = lower ? Math.min(...rest) : Math.max(...rest)
  return Math.abs(next - top)
}

function withBest(r: CompareRow, numbers: (number | null)[], lower: boolean): CompareRow {
  return { ...r, best: bestOf(numbers, lower), lead: leadOf(numbers, lower) }
}

export function compareRows(list: Product[], lang: 'ru' | 'ky', w: CompareWords): CompareRow[] {
  const rows: CompareRow[] = [
    withBest(
      row('price', w.price, list.map((p) => (p.price > 0 ? formatSom(p.price) : null))),
      list.map((p) => p.price),
      true,
    ),
    withBest(
      row(
        'installment',
        w.installment,
        list.map((p) => {
          const monthly = adalMonthly(p.price)
          return monthly ? w.perMonth(formatSom(monthly)) : null
        }),
      ),
      list.map((p) => adalMonthly(p.price)),
      true,
    ),
    withBest(
      row('warranty', w.warranty, list.map((p) => (p.warrantyMonths > 0 ? w.warrantyOf(p.warrantyMonths) : null))),
      list.map((p) => p.warrantyMonths),
      false,
    ),
    row(
      'stock',
      w.stock,
      list.map((p) => (p.preorder ? w.preorder : p.variants.some((v) => v.stock > 0) ? w.inStock : w.outOfStock)),
    ),
    row('brand', w.brand, list.map((p) => p.brand || null)),
  ]

  // Характеристики: строка — по названию (без регистра), первое написание — подписью.
  const labels = new Map<string, string>()
  for (const p of list) {
    for (const s of p.specs) {
      const label = (lang === 'ky' ? s.labelKy || s.labelRu : s.labelRu).trim()
      const key = specKey(s.labelRu)
      if (!key || SKIP.test(s.labelRu.trim()) || labels.has(key)) continue
      labels.set(key, label)
    }
  }
  for (const [key, label] of labels) {
    const values = list.map((p) => {
      const s = p.specs.find((x) => specKey(x.labelRu) === key)
      const value = s ? (lang === 'ky' ? s.valueKy || s.valueRu : s.valueRu).trim() : ''
      return value || null
    })
    rows.push(row(`spec:${key}`, label, values, 'specs'))
  }
  // у всех пусто (например, гарантия в 1С не указана ни у кого) — строка ничего не говорит
  return rows.filter((r) => r.values.some((v) => v !== null))
}

/**
 * Короткие названия для тесных мест («Коротко», прилипающая полоска): общие слова в начале у всех
 * товаров («Стиральная машина») убираем — остаётся то, чем товары отличаются: «LG F2V3PS6J…».
 * Только целые слова; если у кого-то ничего не осталось — названия как есть.
 */
export function shortNames(names: string[]): string[] {
  if (names.length < 2) return names
  const words = names.map((n) => n.trim().split(/\s+/))
  let common = 0
  while (words.every((w) => common < w.length - 1 && same(w[common]) === same(words[0][common]))) common++
  return common ? words.map((w) => w.slice(common).join(' ')) : names
}
