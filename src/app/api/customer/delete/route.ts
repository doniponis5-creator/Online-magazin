import { deleteAccount } from '@/lib/customer/gateway'
import { currentSession, endSession, errorResponse } from '../route-helpers'

/**
 * Удаление учётной записи — из приложения, в одно нажатие.
 *
 * Apple требует, чтобы человек мог удалить учётную запись там же, где её
 * завёл, а не письмом в магазин (правило 5.1.1). Поэтому точка есть.
 *
 * Что происходит: сервер стирает адреса телефона для уведомлений, сайт
 * закрывает вход, а приложение стирает со своей стороны бонусную карту и ключ
 * быстрого входа. Бонусный счёт в SBonus и прошлые заказы остаются: счёт общий
 * с кассой магазина, а заказы обязан хранить бухгалтерский учёт. Приложение
 * говорит об этом человеку и даёт телефон магазина.
 *
 * Вход закрываем в любом случае, даже если сервер не ответил: человек попросил
 * уйти — он должен уйти, а не упереться в ошибку.
 */
export async function POST() {
  const session = await currentSession()
  if (!session) return Response.json({ ok: false, error: 'login' }, { status: 401 })
  try {
    const result = await deleteAccount(session.phone)
    await endSession()
    return Response.json({ ok: true, pushRemoved: result.pushRemoved })
  } catch (error) {
    await endSession()
    // Сервер не ответил — человек всё равно вышел, а адреса уберём при
    // следующей попытке Apple достучаться до удалённого приложения.
    console.error('[customer] удаление учётной записи: сервер не ответил', error)
    return Response.json({ ok: true, pushRemoved: 0, serverPending: true })
  }
}
