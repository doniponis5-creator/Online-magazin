import type { Lang } from '@/lib/i18n/config'

const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

/** Prices are integer som (KGS). Demo data — not a real offer. */
export function formatSom(amount: number): string {
  return `${numberFormat.format(amount)} сом`
}

/**
 * Русское число с существительным: 1 товар, 2 товара, 5 товаров, 21 товар.
 * В кыргызском форма одна, поэтому там передают одинаковые слова.
 */
export function countWithNoun(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  const word = mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20) ? few : many
  return `${n} ${word}`
}

export function localized<T>(lang: Lang, ru: T, ky: T): T {
  return lang === 'ky' ? ky : ru
}
