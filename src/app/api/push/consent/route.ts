import type { NextRequest } from 'next/server'
import { cartConsent, setCartConsent } from '@/lib/customer/gateway'
import { currentSession } from '../../customer/route-helpers'

/**
 * Согласие покупателя на напоминания о корзине.
 *
 * Напоминание — это реклама, поэтому шлём его только тем, кто сам сказал «да»
 * (правило Apple 4.5.4). Спрашиваем и меняем ответ в «Кабинете».
 * Номер — только из сессии; без входа — 401.
 */

/** Текущий ответ: true / false, null — ещё не спрашивали. */
export async function GET(_request: NextRequest) {
  const session = await currentSession()
  if (!session) return Response.json({ ok: false, error: 'login' }, { status: 401 })
  try {
    return Response.json({ ok: true, consent: await cartConsent(session.phone) })
  } catch (error) {
    console.error('[push] не удалось прочитать согласие:', error)
    return Response.json({ ok: false, error: 'server-unavailable' }, { status: 502 })
  }
}

/** Записать ответ: тело `{consent: boolean}`. */
export async function POST(request: NextRequest) {
  const session = await currentSession()
  if (!session) return Response.json({ ok: false, error: 'login' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { consent?: unknown } | null
  const consent = body?.consent
  if (typeof consent !== 'boolean') return Response.json({ ok: false, error: 'consent' }, { status: 400 })
  try {
    await setCartConsent(session.phone, consent)
    return Response.json({ ok: true, consent })
  } catch (error) {
    // Здесь молчать нельзя: покупатель должен увидеть, что его ответ не сохранился.
    console.error('[push] не удалось сохранить согласие:', error)
    return Response.json({ ok: false, error: 'server-unavailable' }, { status: 502 })
  }
}
