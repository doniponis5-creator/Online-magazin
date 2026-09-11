import type { Lang } from '@/lib/i18n/config'

const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

/** Prices are integer som (KGS). Demo data — not a real offer. */
export function formatSom(amount: number): string {
  return `${numberFormat.format(amount)} сом`
}

export function localized<T>(lang: Lang, ru: T, ky: T): T {
  return lang === 'ky' ? ky : ru
}
