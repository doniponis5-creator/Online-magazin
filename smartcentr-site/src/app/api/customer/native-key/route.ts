import { getProfile } from '@/lib/customer/gateway'
import { decodeNativeKey, encodeNativeKey } from '@/lib/customer/session'
import { currentSession, errorResponse, startSession } from '../route-helpers'

/**
 * Ключ для входа по Face ID.
 *
 * GET  — покупатель уже вошёл по коду: выдаём ключ, приложение прячет его в Keychain
 *        телефона под защиту Face ID.
 * POST — покупатель приложил лицо, приложение вернуло ключ: проверяем подпись и
 *        снова пускаем его, без кода из Telegram.
 */
export async function GET() {
  const session = await currentSession()
  if (!session) return Response.json({ ok: false, error: 'login' }, { status: 401 })
  return Response.json({ ok: true, key: encodeNativeKey(session.phone, session.name) })
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { key?: string } | null
  const data = decodeNativeKey(body?.key)
  if (!data) return Response.json({ ok: false, error: 'key' }, { status: 401 })
  try {
    // Ключ мог остаться от удалённого клиента — проверяем, что он всё ещё есть в SBonus.
    const customer = await getProfile(data.phone, 0, false)
    if (!customer) return Response.json({ ok: false, error: 'key' }, { status: 401 })
    await startSession(customer.phone, customer.name)
    return Response.json({ ok: true, customer })
  } catch (error) {
    return errorResponse(error)
  }
}
