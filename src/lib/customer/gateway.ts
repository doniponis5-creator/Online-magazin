/**
 * Покупатель и бонусы SBonus: связь сайта с сервером (api.smartcentr.store).
 *
 * Вход без пароля: телефон → код (сначала Telegram, потом WhatsApp).
 * Ключ клиента всегда телефон — он же в кассе и в 1С.
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
  /** код клиента в SBonus — то, что кассир сканирует с экрана телефона */
  qrCode?: string
  history?: BonusHistoryItem[]
  orders?: CustomerOrderItem[]
}

export type VerifyResult =
  | { ok: true; needName: false; customer: CustomerProfile }
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
type MockCustomer = { name: string; balance: number }
const store = globalThis as unknown as {
  __scMockCustomers?: Map<string, MockCustomer>
  __scMockTickets?: Map<string, string>
}
const mockCustomers = (store.__scMockCustomers ??= new Map())
const mockTickets = (store.__scMockTickets ??= new Map())

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
    qrCode: `SB-${phone.replace(/\D/g, '').slice(-10).padStart(10, '0')}`,
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

// ── Демонстрационный вход для проверяющего из Apple ───────────────────────────

/**
 * Apple проверяет приложение вручную, из другой страны. Наш вход — код в
 * Telegram или WhatsApp на кыргызский номер: проверяющий такой код получить не
 * может, а значит не увидит ни бонусную карту, ни Face ID, ни уведомления —
 * и вернёт приложение обратно.
 *
 * Поэтому один-единственный номер входит по заранее известному коду. Он живёт
 * только на сайте: в SBonus его нет, бонусы ему не начисляются, в 1С он не
 * попадает. Номер и код задаются в настройках сервера
 * (SITE_DEMO_PHONE, SITE_DEMO_CODE) — не заданы, и никакого демо-входа нет.
 *
 * После выхода приложения в App Store номер можно убрать: достаточно стереть
 * две строки в настройках, пересобирать ничего не нужно.
 */
const DEMO_PHONE = (process.env.SITE_DEMO_PHONE ?? '').trim()
const DEMO_CODE = (process.env.SITE_DEMO_CODE ?? '').trim()
const DEMO_NAME = (process.env.SITE_DEMO_NAME ?? 'Apple Review').trim()
const DEMO_QR = (process.env.SITE_DEMO_QR ?? 'SB-DEMO000001').trim()
const DEMO_BALANCE = Number(process.env.SITE_DEMO_BALANCE ?? 1500)

/** Демо-вход включён и это он. Оба значения обязательны: одного мало. */
export function isDemoPhone(phone: string): boolean {
  return Boolean(DEMO_PHONE && DEMO_CODE) && phone === DEMO_PHONE
}

/**
 * Код у демо-номера короткий и постоянный, поэтому его можно подобрать
 * перебором. Настоящий сервер от перебора защищён, а этот вход идёт мимо него —
 * значит считаем промахи сами. Десять подряд — и час тишины.
 *
 * Счётчик живёт в памяти процесса: перезапуск сайта его обнуляет. Для номера,
 * за которым нет ни денег, ни чужих данных, этого достаточно.
 */
const DEMO_MAX_MISSES = 10
const DEMO_LOCK_MS = 60 * 60 * 1000
const demoGuard = (globalThis as unknown as {
  __scDemoGuard?: { misses: number; until: number }
}).__scDemoGuard ??= { misses: 0, until: 0 }

function demoProfile(_amount = 0): CustomerProfile {
  const balance = Math.max(0, Math.round(DEMO_BALANCE))
  return {
    phone: DEMO_PHONE,
    name: DEMO_NAME,
    balance,
    tier: 'Bronze',
    tierPercent: 1,
    maxSpendPct: 10,
    // Списывать бонусы демо-номеру нельзя: заказ уходит на настоящий сервер, а
    // там этого клиента нет — сервер пересчитает и откажет. Баланс показываем,
    // тратить не даём: проверяющему нужна карта и QR, а не покупка бонусами.
    maxSpend: 0,
    qrCode: DEMO_QR,
    history: [],
    orders: [],
  }
}

// ── API ───────────────────────────────────────────────────────────────────────

/**
 * Настройки сайта, которыми владелец управляет из 1С («Панель сайта»).
 * Меняются на сервере и действуют сразу, поэтому спрашиваем их, а не держим в коде.
 */
export type SiteSettings = { guestCheckout: boolean; bonusMaxPct: number; welcomeBonus: number }

const SITE_SETTINGS_FALLBACK: SiteSettings = { guestCheckout: true, bonusMaxPct: 10, welcomeBonus: 1000 }

export async function getSiteSettings(): Promise<SiteSettings> {
  if (paymentMode() === 'mock') return SITE_SETTINGS_FALLBACK
  try {
    const data = await call<Partial<SiteSettings>>('/api/v1/webhook/site/settings', { method: 'GET' })
    return {
      guestCheckout: data.guestCheckout !== false,
      bonusMaxPct: Number(data.bonusMaxPct ?? SITE_SETTINGS_FALLBACK.bonusMaxPct),
      welcomeBonus: Number(data.welcomeBonus ?? SITE_SETTINGS_FALLBACK.welcomeBonus),
    }
  } catch (error) {
    // Сервер не ответил — не запираем магазин: заказ важнее настройки
    console.error('[settings] не удалось получить настройки сайта:', error)
    return SITE_SETTINGS_FALLBACK
  }
}

/**
 * Адрес телефона для push-уведомлений.
 *
 * Сервер хранит адреса и рассылает по ним сообщения о заказах. В тестовом режиме
 * просто пишем в консоль: сервера нет, отправлять некуда.
 */
export async function registerPushDevice(token: string, phone: string | null): Promise<void> {
  if (paymentMode() === 'mock') {
    console.log('[push] тестовый режим, адрес телефона получен:', token.slice(0, 12) + '…', phone ?? 'без входа')
    return
  }
  await call('/api/v1/webhook/site/push-device', { method: 'POST', body: { token, platform: 'ios', phone } })
}

/** Отметка о посещении страницы — для счётчика людей в «Панели сайта». */
export async function recordVisit(visitor: string, path: string): Promise<void> {
  if (paymentMode() === 'mock') return
  await call('/api/v1/webhook/site/visit', { method: 'POST', body: { visitor, path } })
}

/** Куда ушёл код: сервер сначала пробует Telegram, потом WhatsApp. */
export type CodeChannel = 'telegram' | 'whatsapp'

export async function sendCode(phone: string, ip: string): Promise<CodeChannel> {
  // Демо-номеру отправлять нечего: код у проверяющего уже есть.
  if (isDemoPhone(phone)) return 'telegram'
  if (paymentMode() === 'mock') {
    console.info(`[customer] тестовый код для ${phone}: ${MOCK_CODE}`)
    return 'whatsapp'
  }
  const result = await call<{ channel?: CodeChannel }>('/api/v1/webhook/site/customer/send-code', {
    method: 'POST',
    body: { phone, ip },
  })
  // Старый сервер канал не возвращает — тогда это WhatsApp
  return result.channel === 'telegram' ? 'telegram' : 'whatsapp'
}

export async function verifyCode(phone: string, code: string, ip: string): Promise<VerifyResult> {
  if (isDemoPhone(phone)) {
    if (Date.now() < demoGuard.until) throw new CustomerApiError(429, 'Слишком много попыток')
    if (code !== DEMO_CODE) {
      demoGuard.misses += 1
      if (demoGuard.misses >= DEMO_MAX_MISSES) {
        demoGuard.until = Date.now() + DEMO_LOCK_MS
        demoGuard.misses = 0
      }
      throw new CustomerApiError(401, 'Неверный код')
    }
    demoGuard.misses = 0
    return { ok: true, needName: false, customer: demoProfile() }
  }
  if (paymentMode() === 'mock') {
    if (code !== MOCK_CODE) throw new CustomerApiError(401, 'Неверный код. Тестовый код: 1234')
    if (mockCustomers.has(phone)) return { ok: true, needName: false, customer: mockProfile(phone) }
    const ticket = `mock-${Date.now()}`
    mockTickets.set(ticket, phone)
    return { ok: true, needName: true, ticket, welcomeBonus: MOCK_WELCOME }
  }
  return call<VerifyResult>('/api/v1/webhook/site/customer/verify', { method: 'POST', body: { phone, code, ip } })
}

export async function register(
  ticket: string,
  name: string,
): Promise<{ customer: CustomerProfile; welcomeBonus: number }> {
  if (paymentMode() === 'mock') {
    const phone = mockTickets.get(ticket)
    if (!phone) throw new CustomerApiError(401, 'Время вышло. Войдите заново.')
    mockTickets.delete(ticket)
    if (!mockCustomers.has(phone)) mockCustomers.set(phone, { name, balance: MOCK_WELCOME })
    return { customer: mockProfile(phone), welcomeBonus: MOCK_WELCOME }
  }
  return call('/api/v1/webhook/site/customer/register', { method: 'POST', body: { ticket, name } })
}

/** Профиль по телефону; null — клиента нет в SBonus. */
export async function getProfile(phone: string, amount = 0, full = false): Promise<CustomerProfile | null> {
  if (isDemoPhone(phone)) return demoProfile(amount)
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

/**
 * Покупатель удалил учётную запись в приложении.
 *
 * Стираем то, что держит сайт: адреса телефона для уведомлений. Бонусный счёт
 * в SBonus и заказы остаются — это общий счёт с кассой и записи бухгалтерии;
 * приложение говорит об этом человеку прямо и даёт телефон магазина.
 *
 * Возвращает, сколько адресов убрали. Ошибка сервера не должна мешать выходу:
 * решает вызывающая сторона.
 */
export async function deleteAccount(phone: string): Promise<{ pushRemoved: number }> {
  if (isDemoPhone(phone) || paymentMode() === 'mock') {
    console.info(`[customer] удаление учётной записи (без сервера): ${phone}`)
    return { pushRemoved: 0 }
  }
  const result = await call<{ ok?: boolean; pushRemoved?: number }>(
    '/api/v1/webhook/site/account-delete',
    { method: 'POST', body: { phone } },
  )
  return { pushRemoved: Number(result.pushRemoved ?? 0) }
}

/** Тестовый режим: списать бонусы «после оплаты». */
export function mockSpend(phone: string, amount: number): void {
  const c = mockCustomers.get(phone)
  if (c) c.balance = Math.max(0, c.balance - amount)
}
