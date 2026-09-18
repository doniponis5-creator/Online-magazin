import { MAX_PASSWORD, MIN_PASSWORD, dropPassword, setPassword } from '@/lib/customer/gateway'
import { errorResponse } from '../route-helpers'

/**
 * Пароль покупателя. Пропуск pwTicket сайт получает от сервера после входа по коду —
 * значит, номер только что подтверждён и паролем можно распоряжаться.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { pwTicket?: string; password?: string }
  const password = String(body.password ?? '')
  if (!body.pwTicket) return Response.json({ ok: false, error: 'ticket' }, { status: 422 })
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return Response.json({ ok: false, error: 'password' }, { status: 422 })
  }
  try {
    await setPassword(body.pwTicket, password)
    return Response.json({ ok: true, hasPassword: true })
  } catch (error) {
    return errorResponse(error)
  }
}

/** Убрать пароль — вход снова по коду из WhatsApp. */
export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { pwTicket?: string }
  if (!body.pwTicket) return Response.json({ ok: false, error: 'ticket' }, { status: 422 })
  try {
    await dropPassword(body.pwTicket)
    return Response.json({ ok: true, hasPassword: false })
  } catch (error) {
    return errorResponse(error)
  }
}
