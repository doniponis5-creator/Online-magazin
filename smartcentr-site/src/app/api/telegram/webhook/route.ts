import { handleUpdate, telegramConfigured, type TelegramUpdate } from '@/lib/telegram/bot'

/**
 * Сюда Telegram приносит сообщения покупателей.
 *
 * Адрес знает только Telegram, но знать его мало: в заголовке должно лежать
 * условное слово из TELEGRAM_WEBHOOK_SECRET. Без него любой, кто угадал
 * адрес, мог бы слать боту сообщения от чужого имени.
 *
 * Отвечаем «ok» почти всегда: если вернуть ошибку, Telegram будет слать одно
 * и то же сообщение снова и снова.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!telegramConfigured() || !secret) {
    return new Response('Not found', { status: 404 })
  }
  if (request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return new Response('Not found', { status: 404 })
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return Response.json({ ok: true })
  }

  try {
    await handleUpdate(update)
  } catch (error) {
    console.error('[telegram] обработка:', error instanceof Error ? error.message : error)
  }
  return Response.json({ ok: true })
}
