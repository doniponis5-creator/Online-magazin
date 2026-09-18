import { recordVisit } from '@/lib/customer/gateway'

/**
 * Отметка о посещении страницы для «Панели сайта» в 1С.
 *
 * Всегда отвечает ok: счётчик не должен мешать покупателю, даже если сервер
 * статистики молчит. Идентификатор посетителя сервер превращает в необратимый
 * отпечаток — тут он просто передаётся дальше.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { visitor?: string; path?: string }
  const visitor = String(body.visitor ?? '').slice(0, 64)
  const path = String(body.path ?? '/').slice(0, 200)
  if (!visitor) return Response.json({ ok: true, counted: false })
  try {
    await recordVisit(visitor, path)
  } catch {
    return Response.json({ ok: true, counted: false })
  }
  return Response.json({ ok: true, counted: true })
}
