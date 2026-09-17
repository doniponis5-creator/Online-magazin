import 'server-only'
import { cookies } from 'next/headers'
import { CustomerApiError } from '@/lib/customer/gateway'
import { SESSION_COOKIE, decodeSession, encodeSession, sessionCookieOptions } from '@/lib/customer/session'

/** IP покупателя (nginx передаёт X-Forwarded-For) — для ограничения частоты кодов на сервере. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? ''
  return forwarded.split(',')[0].trim().slice(0, 45)
}

export async function currentSession() {
  const store = await cookies()
  return decodeSession(store.get(SESSION_COOKIE)?.value)
}

export async function startSession(phone: string, name: string) {
  const store = await cookies()
  store.set(SESSION_COOKIE, encodeSession(phone, name), sessionCookieOptions)
}

export async function endSession() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export function errorResponse(error: unknown) {
  if (error instanceof CustomerApiError) {
    const status = error.status >= 400 && error.status < 500 ? error.status : 502
    return Response.json({ ok: false, error: status === 502 ? 'server-unavailable' : error.message }, { status })
  }
  console.error('[customer]', error)
  return Response.json({ ok: false, error: 'server-unavailable' }, { status: 502 })
}
