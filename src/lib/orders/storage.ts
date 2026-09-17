/** Последний заказ покупателя в браузере — чтобы вернуться к нему после страницы O!Деньги. */
export const LAST_ORDER_KEY = 'sc-last-order'

export function readLastOrder(): { orderId: string; token: string } | null {
  try {
    const raw = localStorage.getItem(LAST_ORDER_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed.orderId === 'string' && typeof parsed.token === 'string' ? parsed : null
  } catch {
    return null
  }
}
