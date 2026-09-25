/**
 * Связь сайта с сервером заказов SBonus (api.smartcentr.store).
 *
 * Боевой режим (заданы SHOP_API_URL и SHOP_API_SECRET):
 *   сайт отправляет проверенный заказ на сервер, подписывая тело HMAC-SHA256;
 *   сервер сохраняет заказ, выставляет счёт O!Деньги и возвращает ссылку на оплату.
 *   После оплаты O!Деньги сообщают серверу, 1С забирает заказ и создаёт документы.
 *
 * Тестовый режим (SHOP_PAYMENT_MODE=mock или сервер не настроен в разработке):
 *   заказ хранится в памяти процесса, «оплата» — кнопка на странице заказа.
 *   Нужен только чтобы проверить путь покупателя на localhost.
 *
 * Модуль только для сервера: секрет не должен попасть в браузер.
 */
import 'server-only'
import { createHmac, randomBytes } from 'node:crypto'
import type { ValidatedOrder } from './order'

export type OrderStatus = 'awaiting_payment' | 'paid' | 'in_1c' | 'cancelled' | 'failed'

export type PublicOrder = {
  orderId: string
  status: OrderStatus
  total: number
  goodsTotal: number
  /** списано бонусов SBonus */
  bonusSpend?: number
  /** оплачено деньгами через O!Деньги */
  payAmount?: number
  /** начислено бонусов за покупку (после реализации в 1С) */
  bonusEarned?: number
  deliveryPrice: number
  deliveryMethod: 'pickup' | 'delivery'
  lines: { name: string; qty: number; price: number; sum: number }[]
  payUrl: string | null
  createdAt: string
  /** номер заказа клиента в 1С, когда магазин его создал */
  number1c?: string | null
}

type CreateResult = { orderId: string; token: string; payUrl: string; mock: boolean }

const API_URL = process.env.SHOP_API_URL?.replace(/\/+$/, '')
const API_SECRET = process.env.SHOP_API_SECRET

export function paymentMode(): 'live' | 'mock' {
  if (process.env.SHOP_PAYMENT_MODE === 'mock') return 'mock'
  if (API_URL && API_SECRET) return 'live'
  // В продакшене без настроек оплату не имитируем — это была бы ложная «оплата».
  return process.env.NODE_ENV === 'production' ? 'live' : 'mock'
}

function sign(body: string): string {
  return createHmac('sha256', API_SECRET ?? '').update(body, 'utf8').digest('hex')
}

export async function callServer<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  if (!API_URL || !API_SECRET) throw new Error('Сервер заказов не настроен (SHOP_API_URL, SHOP_API_SECRET)')
  const body = init.body === undefined ? undefined : JSON.stringify(init.body)
  const response = await fetch(`${API_URL}${path}`, {
    method: init.method,
    headers: {
      'Content-Type': 'application/json',
      // подпись тела для POST; для GET подписываем путь
      'X-Signature': sign(body ?? path),
    },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Сервер заказов ответил ${response.status}: ${text.slice(0, 300)}`)
  }
  return (await response.json()) as T
}

// ── Тестовый режим ────────────────────────────────────────────────────────────

type MockEntry = { token: string; order: ValidatedOrder; status: OrderStatus; createdAt: string }
const globalStore = globalThis as unknown as { __scMockOrders?: Map<string, MockEntry> }
const mockOrders = (globalStore.__scMockOrders ??= new Map())

function toPublic(orderId: string, entry: MockEntry, payUrl: string | null): PublicOrder {
  return {
    orderId,
    status: entry.status,
    total: entry.order.total,
    goodsTotal: entry.order.goodsTotal,
    bonusSpend: entry.order.bonus,
    payAmount: entry.order.total - entry.order.bonus,
    bonusEarned: 0,
    deliveryPrice: entry.order.delivery.price,
    deliveryMethod: entry.order.delivery.method,
    lines: entry.order.lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price, sum: l.sum })),
    payUrl,
    createdAt: entry.createdAt,
    number1c: null,
  }
}

// ── API ───────────────────────────────────────────────────────────────────────

export async function createOrder(order: ValidatedOrder): Promise<CreateResult> {
  if (paymentMode() === 'mock') {
    const orderId = `TEST-${Date.now().toString(36).toUpperCase()}`
    const token = randomBytes(16).toString('hex')
    mockOrders.set(orderId, { token, order, status: 'awaiting_payment', createdAt: new Date().toISOString() })
    return { orderId, token, payUrl: `/${order.lang}/order/${orderId}?token=${token}`, mock: true }
  }
  const result = await callServer<{ order_id: string; token: string; pay_url: string }>(
    '/api/v1/webhook/site/orders',
    { method: 'POST', body: { ...order, source: 'site' } },
  )
  return { orderId: result.order_id, token: result.token, payUrl: result.pay_url, mock: false }
}

export async function getOrder(orderId: string, token: string): Promise<PublicOrder | null> {
  if (paymentMode() === 'mock') {
    const entry = mockOrders.get(orderId)
    if (!entry || entry.token !== token) return null
    return toPublic(orderId, entry, null)
  }
  try {
    return await callServer<PublicOrder>(
      `/api/v1/webhook/site/orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`,
      { method: 'GET' },
    )
  } catch {
    return null
  }
}

/** Только тестовый режим: имитация успешной оплаты. Возвращает оплаченный заказ (повторно — null). */
export function mockPay(orderId: string, token: string): ValidatedOrder | null {
  if (paymentMode() !== 'mock') return null
  const entry = mockOrders.get(orderId)
  if (!entry || entry.token !== token || entry.status !== 'awaiting_payment') return null
  entry.status = 'paid'
  return entry.order
}
