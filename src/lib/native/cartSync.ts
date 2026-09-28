/**
 * Корзина из приложения — на сервер, чтобы напомнить о забытых товарах.
 *
 * Корзина живёт на самом телефоне, сервер о ней не знает. Поэтому в приложении
 * мы отдаём сайту короткий снимок: первые три названия, число позиций и сумму.
 * Шлём не на каждое нажатие, а через 5 секунд тишины; тот же снимок второй раз
 * не шлём. Приложение свернули или закрыли раньше — шлём сразу: иначе снимок не
 * дошёл бы, и напоминание о корзине не пришло бы. Пустая корзина — тоже снимок:
 * сервер поймёт, что напоминать не о чем.
 *
 * В браузере не уходит ничего. Без входа — тоже: сайт отвечает 401, и мы молчим,
 * пока «Кабинет» не скажет, что покупатель вошёл. Любой сбой сети молча
 * пропускаем — корзина покупателя от этого не страдает.
 */
import { cartTotals, type CartLine, type ProductRef } from '@/lib/cart/logic'
import { pushPlatform } from './push'

export type CartSnapshot = { items: string[]; count: number; total: number }

/** Сколько ждём после последнего изменения, прежде чем отправить. */
export const CART_SYNC_DELAY = 5_000

/** Названия нужны серверу только для текста напоминания — хватит трёх. */
const MAX_ITEMS = 3

/**
 * Снимок корзины. Позиция — строка корзины: две штуки одного чайника — одна позиция,
 * иначе напоминание «Чайник и ещё 1» звучало бы странно. Названия — по-русски,
 * как и сам текст напоминания на сервере.
 */
export function cartSnapshot(lines: CartLine[], products: (ProductRef & { nameRu: string })[]): CartSnapshot {
  const names: string[] = []
  for (const line of lines) {
    const product = products.find((p) => p.id === line.productId)
    if (product && names.length < MAX_ITEMS) names.push(product.nameRu)
  }
  return { items: names, count: lines.length, total: cartTotals(lines, products).subtotal }
}

// 'unknown' — ещё не знаем, вошёл ли покупатель: пробуем отправить, сайт скажет.
let signed: 'unknown' | 'in' | 'out' = 'unknown'
let latest: CartSnapshot | null = null
let lastSent: string | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let hideListening = false

/** Отдельной функцией: TypeScript не видит, что за время запроса покупатель мог выйти. */
function signedOut(): boolean {
  return signed === 'out'
}

function stopTimer() {
  if (timer) clearTimeout(timer)
  timer = null
}

async function flush(): Promise<void> {
  stopTimer()
  if (!pushPlatform() || !latest || signed === 'out') return
  const key = JSON.stringify(latest)
  if (key === lastSent) return
  // keepalive: запрос доходит, даже если приложение в эту секунду уходит в фон.
  const response = await fetch('/api/push/cart', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: key,
    keepalive: true,
  }).catch(() => null)
  if (!response) return // сети нет — отправим со следующим изменением
  if (response.status === 401) {
    signed = 'out'
    lastSent = null
    return
  }
  // Пока шёл запрос, покупатель мог выйти — тогда ответ уже не считается входом.
  if (response.ok && !signedOut()) {
    signed = 'in'
    lastSent = key
  }
}

/**
 * Приложение уходит в фон или закрывается, а снимок ещё ждёт своих 5 секунд —
 * шлём сразу: в фоне телефон может усыпить страницу, и таймер не сработает.
 */
function listenHide(): void {
  if (hideListening || typeof document === 'undefined' || !document.addEventListener) return
  hideListening = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer) void flush()
  })
}

/** Корзина изменилась (и при открытии приложения). Отправим через 5 секунд тишины. */
export function cartChanged(snapshot: CartSnapshot): void {
  if (!pushPlatform()) return
  latest = snapshot
  if (signed === 'out') return
  listenHide()
  stopTimer()
  timer = setTimeout(() => void flush(), CART_SYNC_DELAY)
}

/** Покупатель вошёл: снимок уходит сразу. Повторный вызов при том же входе ничего не шлёт. */
export function cartSignedIn(): void {
  if (signed === 'in') return
  signed = 'in'
  lastSent = null
  void flush()
}

/** Покупатель вышел или не входил: молчим до следующего входа. */
export function cartSignedOut(): void {
  signed = 'out'
  lastSent = null
  stopTimer()
}
