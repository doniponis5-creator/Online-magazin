/**
 * Вход покупателя: подписанная cookie сессии.
 *
 * После проверки кода из WhatsApp сайт кладёт в httpOnly-cookie телефон и имя,
 * подписанные HMAC-SHA256 (секрет SHOP_API_SECRET). Подделать телефон из браузера нельзя:
 * без секрета подпись не сойдётся. Баланс в cookie не хранится — всегда берётся с сервера SBonus.
 */
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'sc_customer'
export const SESSION_DAYS = 30

export type CustomerSession = { phone: string; name: string; exp: number }

function secret(): string {
  const value = process.env.SHOP_API_SECRET
  if (value) return value
  if (process.env.NODE_ENV === 'production') throw new Error('SHOP_API_SECRET не задан')
  return 'dev-only-session-secret'
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(`session:${payload}`, 'utf8').digest('base64url')
}

export function encodeSession(phone: string, name: string, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ phone, name, exp: now + SESSION_DAYS * 24 * 3600 * 1000 } satisfies CustomerSession),
    'utf8',
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function decodeSession(value: string | undefined, now = Date.now()): CustomerSession | null {
  if (!value) return null
  const [payload, signature] = value.split('.')
  if (!payload || !signature) return null
  const expected = Buffer.from(sign(payload))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as CustomerSession
    if (!/^\+996\d{9}$/.test(data.phone) || typeof data.exp !== 'number' || data.exp < now) return null
    return data
  } catch {
    return null
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DAYS * 24 * 3600,
}
