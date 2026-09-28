/**
 * Правила постоянного адреса — одни для кабинета, оформления заказа и сервера.
 * Те же границы, что проверяет оформление: город от 2 знаков, адрес от 4.
 */

export type SavedAddress = { city: string; address: string }

export const CITY_MIN = 2
export const CITY_MAX = 60
export const ADDRESS_MIN = 4
export const ADDRESS_MAX = 200

/** Ключ в браузере для покупателя без входа: адрес помнит только это устройство. */
export const LOCAL_ADDRESS_KEY = 'sc-address'

const squash = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')

/** Привести адрес в порядок; не годится — null. */
export function cleanAddress(input: unknown): SavedAddress | null {
  if (!input || typeof input !== 'object') return null
  const { city, address } = input as Record<string, unknown>
  const c = squash(city)
  const a = squash(address)
  if (c.length < CITY_MIN || c.length > CITY_MAX) return null
  if (a.length < ADDRESS_MIN || a.length > ADDRESS_MAX) return null
  return { city: c, address: a }
}

/** «Бишкек, ул. Токтогула 12, кв. 5» — одной строкой для меню кабинета. */
export const addressLine = (a: SavedAddress) => `${a.city}, ${a.address}`
