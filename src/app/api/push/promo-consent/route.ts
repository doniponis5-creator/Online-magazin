import type { NextRequest } from 'next/server'
import { promoConsent, setPromoConsent } from '@/lib/customer/gateway'
import { currentSession } from '../../customer/route-helpers'

/**
 * Согласие покупателя на уведомления «Новинки и скидки».
 *
 * Их отправляет владелец из 1С — это реклама, поэтому только тем, кто сам сказал «да»
 * (правило Apple 4.5.4). Согласие отдельное от напоминаний о корзине.
 * Спрашиваем и меняем ответ в «Кабинете». Номер — только из сессии; без входа — 401.
 */

/** Текущий ответ: true / false, null — ещё не спрашивали. */
export async function GET(_request: NextRequest) {
  const session = await currentSession()
  if (!session) return Response.json({ ok: false, error: 'login' }, { status: 401 })
  try {
    return Response.json({ ok: true, consent: await promoConsent(session.phone) })
  } catch (error) {
    console.error('[push] не удалось прочитать согласие на рассылки:', error)
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
    await setPromoConsent(session.phone, consent)
    return Response.json({ ok: true, consent })
  } catch (error) {
    // Здесь молчать нельзя: покупатель должен увидеть, что его ответ не сохранился.
    console.error('[push] не удалось сохранить согласие на рассылки:', error)
    return Response.json({ ok: false, error: 'server-unavailable' }, { status: 502 })
  }
}
