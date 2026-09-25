import type { NextRequest } from 'next/server'
import { registerPushDevice } from '@/lib/customer/gateway'
import { currentSession } from '../../customer/route-helpers'

/**
 * Приложение прислало «адрес» телефона для уведомлений.
 *
 * Адрес привязываем к покупателю, если он вошёл. Не вошёл — всё равно запоминаем:
 * он войдёт позже, и адрес допишется к нему.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { token?: string; platform?: string } | null
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  // Токен APNs — шестнадцатеричная строка. Чужое сюда не пускаем.
  if (!/^[0-9a-fA-F]{60,200}$/.test(token)) {
    return Response.json({ ok: false, error: 'token' }, { status: 400 })
  }
  const session = await currentSession()
  try {
    await registerPushDevice(token, session?.phone ?? null)
    return Response.json({ ok: true })
  } catch (error) {
    // Уведомления — не повод ломать приложение: молча забываем.
    console.error('[push] не удалось сохранить адрес телефона:', error)
    return Response.json({ ok: true, saved: false })
  }
}
