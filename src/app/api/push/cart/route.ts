import type { NextRequest } from 'next/server'
import { saveCartSnapshot } from '@/lib/customer/gateway'
import { currentSession } from '../../customer/route-helpers'

/** Названий в снимке не больше трёх: серверу нужны только они для текста напоминания. */
const MAX_ITEMS = 3
const MAX_NAME = 200

/**
 * Приложение прислало снимок корзины вошедшего покупателя — для напоминаний о забытых товарах.
 *
 * Номер берём только из сессии: чужую корзину к чужому номеру не приписать.
 * Без входа ничего не сохраняем — 401.
 */
export async function POST(request: NextRequest) {
  const session = await currentSession()
  if (!session) return Response.json({ ok: false, error: 'login' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { items?: unknown; count?: unknown; total?: unknown } | null
  const items = body?.items
  if (
    !Array.isArray(items) ||
    items.length > MAX_ITEMS ||
    !items.every((name) => typeof name === 'string' && name.trim() && name.length <= MAX_NAME)
  ) {
    return Response.json({ ok: false, error: 'items' }, { status: 400 })
  }
  const count = body?.count
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    return Response.json({ ok: false, error: 'count' }, { status: 400 })
  }
  const total = body?.total
  if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) {
    return Response.json({ ok: false, error: 'total' }, { status: 400 })
  }

  try {
    await saveCartSnapshot(session.phone, { items: (items as string[]).map((name) => name.trim()), count, total })
    return Response.json({ ok: true })
  } catch (error) {
    // Напоминание — не повод ломать приложение: не сохранилось, и ладно, придёт следующий снимок.
    console.error('[push] не удалось сохранить корзину:', error)
    return Response.json({ ok: true, saved: false })
  }
}
