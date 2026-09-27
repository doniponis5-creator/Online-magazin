import type { Lang } from '@/lib/i18n/config'

/**
 * Даты и числа галереи — одинаково на сервере (Node, UTC) и в браузере покупателя.
 * Без Intl и `toLocale*`: локали `ky` в Node и в браузере разные (или её нет вовсе),
 * и React ругался «Hydration failed» на KY-странице. Время — бишкекское.
 */

/** Asia/Bishkek — UTC+6 круглый год (перевода часов нет с 2005). */
const BISHKEK_MS = 6 * 60 * 60 * 1000

const RU_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const KY_MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']

const two = (n: number) => String(n).padStart(2, '0')

/**
 * `short` — 28.09.2026 (оба языка); `long` — «28 сентября 2026 г.» / «2026-ж., 28-сентябрь».
 * Битая дата — пустая строка.
 */
export function galleryDate(at: string, lang: Lang, style: 'short' | 'long' = 'short'): string {
  const ms = Date.parse(at)
  if (!Number.isFinite(ms)) return ''
  const d = new Date(ms + BISHKEK_MS)
  const day = d.getUTCDate()
  const month = d.getUTCMonth()
  const year = d.getUTCFullYear()
  if (style === 'short') return `${two(day)}.${two(month + 1)}.${year}`
  return lang === 'ky' ? `${year}-ж., ${day}-${KY_MONTHS[month]}` : `${day} ${RU_MONTHS[month]} ${year} г.`
}

/** Средняя оценка: 4,5 · 4,33 · 5 — запятая, без лишних нулей, до двух знаков. */
export function galleryNumber(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}
