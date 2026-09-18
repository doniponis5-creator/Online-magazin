/**
 * Покупатель и бонусы SBonus: связь сайта с сервером (api.smartcentr.store).
 *
 * Вход: телефон → пароль (если покупатель его задал) или код в WhatsApp.
 * Пароль необязателен; ключ клиента всегда телефон — он же в кассе и в 1С.
 *
 * Боевой режим: запросы подписываются тем же секретом, что и заказы (SHOP_API_SECRET).
 * Тестовый режим (localhost без сервера): код всегда 1234, клиенты и бонусы — в памяти процесса.
 */
import 'server-only'
import { callServer, paymentMode } from '@/lib/orders/gateway'

export type BonusHistoryItem = { type: string; amount: number; note: string; date: string | null }
export type CustomerOrderItem = {
  orderId: string
  token: string
  status: string
  total: number
  payAmount: number
  bonusSpent: number
  createdAt: string | null
}

export type CustomerProfile = {
  phone: string
  name: string
  balance: number
  tier: string
  tierPercent: number
  /** какую часть заказа на сайте можно оплатить бонусами, % */
  maxSpendPct: number
  /** сколько бонусов можно списать для переданной суммы */
  maxSpend: number
  /** задан ли пароль для входа без кода */
  hasPassword?: boolean
  history?: BonusHistoryItem[]
  orders?: CustomerOrderItem[]
}

/**
 * Короткий пропуск на смену пароля. Сервер выдаёт его после входа по коду:
 * значит, номер только что подтверждён и паролем можно распоряжаться.
 */
export type PasswordTicket = string

export type VerifyResult =
  | { ok: true; needName: false; customer: CustomerProfile; pwTicket?: PasswordTicket }
  | { ok: true; needName: true; ticket: string; welcomeBonus: number }

export class CustomerApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/** Сколько бонусов можно списать: не больше баланса и не больше pct% суммы, целые сомы. */
export function maxBonusSpend(balance: number, amount: number, pct: number): number {
  if (balance <= 0 || amount <= 0 || pct <= 0) return 0
  return Math.floor(Math.min(balance, (amount * pct) / 100))
}

// ── Тестовый режим ────────────────────────────────────────────────────────────

const MOCK_CODE = '1234'
const MOCK_WELCOME = 1000
const MOCK_PCT = 10
type MockCustomer = { name: string; balance: number; password?: string }
const store = globalThis as unknown as {
  __scMockCustomers?: Map<string, MockCustomer>
  __scMockTickets?: Map<string, string>
  __scMockPwTickets?: Map<string, string>
}
const mockCustomers = (store.__scMockCustomers ??= new Map())
const mockTickets = (store.__scMockTickets ??= new Map())
const mockPwTickets = (store.__scMockPwTickets ??= new Map())

function mockPwTicket(phone: string): PasswordTicket {
  const ticket = `mockpw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  mockPwTickets.set(ticket, phone)
  return ticket
}

function mockPhoneByTicket(ticket: string): string {
  const phone = mockPwTickets.get(ticket)
  if (!phone) throw new CustomerApiError(401, 'Время вышло. Войдите заново.')
  mockPwTickets.delete(ticket)
  return phone
}

function mockProfile(phone: string, amount = 0): CustomerProfile {
  const c = mockCustomers.get(phone)!
  return {
    phone,
    name: c.name,
    balance: c.balance,
    tier: 'Bronze',
    tierPercent: 1,
    maxSpendPct: MOCK_PCT,
    maxSpend: maxBonusSpend(c.balance, amount, MOCK_PCT),
    hasPassword: Boolean(c.password),
    history: [],
    orders: [],
  }
}

async function call<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  try {
    return await callServer<T>(path, init)
  } catch (error) {
    const match = /ответил (\d{3}): ([\s\S]*)$/.exec(String((error as Error).message))
    if (match) {
      let detail = match[2]
      try {
        const parsed = JSON.parse(detail) as { detail?: unknown }
        if (typeof parsed.detail === 'string') detail = parsed.detail
      } catch {
        // текст как есть
      }
      throw new CustomerApiError(Number(match[1]), detail)
    }
    throw new CustomerApiError(502, 'server-unavailable')
  }
}

// ── API ───────────────────────────────────────────────────────────────────────

/** Пароль короче не принимаем — та же проверка стоит на сервере. */
export const MIN_PASSWORD = 6
export const MAX_PASSWORD = 72

/**
 * Первый шаг входа: задан ли у номера пароль.
 * Есть пароль — сайт спросит его и код в WhatsApp не отправляется.
 */
export async function startLogin(phone: string, ip: string): Promise<{ hasPassword: boolean }> {
  if (paymentMode() === 'mock') {
    return { hasPassword: Boolean(mockCustomers.get(phone)?.password) }
  }
  return call('/api/v1/webhook/site/customer/start', { method: 'POST', body: { phone, ip } })
}

/** Вход по паролю — без кода в WhatsApp. */
export async function loginWithPassword(phone: string, password: string, ip: string): Promise<CustomerProfile> {
  if (paymentMode() === 'mock') {
    const c = mockCustomers.get(phone)
    if (!c?.password || c.password !== password) throw new CustomerApiError(401, 'Неверный номер или пароль')
    return mockProfile(phone)
  }
  const result = await call<{ customer: CustomerProfile }>('/api/v1/webhook/site/customer/login', {
    method: 'POST',
    body: { phone, password, ip },
  })
  return result.customer
}

/** Задать или сменить пароль. pwTicket выдаётся после входа по коду. */
export async function setPassword(pwTicket: PasswordTicket, password: string): Promise<void> {
  if (paymentMode() === 'mock') {
    const phone = mockPhoneByTicket(pwTicket)
    const c = mockCustomers.get(phone)
    if (c) c.password = password
    return
  }
  await call('/api/v1/webhook/site/customer/set-password', { method: 'POST', body: { pwTicket, password } })
}

/** Убрать пароль — покупатель снова входит по коду. */
export async function dropPassword(pwTicket: PasswordTicket): Promise<void> {
  if (paymentMode() === 'mock') {
    const phone = mockPhoneByTicket(pwTicket)
    const c = mockCustomers.get(phone)
    if (c) delete c.password
    return
  }
  await call('/api/v1/webhook/site/customer/drop-password', { method: 'POST', body: { pwTicket } })
}

export async function sendCode(phone: string, ip: string): Promise<void> {
  if (paymentMode() === 'mock') {
    console.info(`[customer] тестовый код для ${phone}: ${MOCK_CODE}`)
    return
  }
  await call('/api/v1/webhook/site/customer/send-code', { method: 'POST', body: { phone, ip } })
}

export async function verifyCode(phone: string, code: string, ip: string): Promise<VerifyResult> {
  if (paymentMode() === 'mock') {
    if (code !== MOCK_CODE) throw new CustomerApiError(401, 'Неверный код. Тестовый код: 1234')
    if (mockCustomers.has(phone)) {
      return { ok: true, needName: false, customer: mockProfile(phone), pwTicket: mockPwTicket(phone) }
    }
    const ticket = `mock-${Date.now()}`
    mockTickets.set(ticket, phone)
    return { ok: true, needName: true, ticket, welcomeBonus: MOCK_WELCOME }
  }
  return call<VerifyResult>('/api/v1/webhook/site/customer/verify', { method: 'POST', body: { phone, code, ip } })
}

export async function register(
  ticket: string,
  name: string,
): Promise<{ customer: CustomerProfile; welcomeBonus: number; pwTicket?: PasswordTicket }> {
  if (paymentMode() === 'mock') {
    const phone = mockTickets.get(ticket)
    if (!phone) throw new CustomerApiError(401, 'Время вышло. Войдите заново.')
    mockTickets.delete(ticket)
    if (!mockCustomers.has(phone)) mockCustomers.set(phone, { name, balance: MOCK_WELCOME })
    return { customer: mockProfile(phone), welcomeBonus: MOCK_WELCOME, pwTicket: mockPwTicket(phone) }
  }
  return call('/api/v1/webhook/site/customer/register', { method: 'POST', body: { ticket, name } })
}

/** Профиль по телефону; null — клиента нет в SBonus. */
export async function getProfile(phone: string, amount = 0, full = false): Promise<CustomerProfile | null> {
  if (paymentMode() === 'mock') {
    return mockCustomers.has(phone) ? mockProfile(phone, amount) : null
  }
  const digits = phone.replace(/^\+/, '')
  const query = `amount=${Math.max(0, Math.round(amount))}${full ? '&full=1' : ''}`
  try {
    return await call<CustomerProfile>(`/api/v1/webhook/site/customer/${digits}?${query}`, { method: 'GET' })
  } catch (error) {
    if (error instanceof CustomerApiError && error.status === 404) return null
    throw error
  }
}

/** Тестовый режим: списать бонусы «после оплаты». */
export function mockSpend(phone: string, amount: number): void {
  const c = mockCustomers.get(phone)
  if (c) c.balance = Math.max(0, c.balance - amount)
}
