import 'server-only'

/**
 * «Знания для чата» — то, что владелец написал в 1С обычными словами.
 *
 * Часы работы, гарантия, возврат, акции: этого нет в каталоге, а спрашивают
 * это чаще всего. Владелец пишет текст в 1С («Онлайн магазин → Панель сайта»),
 * текст лежит на сервере SBonus, чат забирает его раз в 10 минут.
 *
 * Сервер не ответил — работаем с прошлым текстом. Текста нет — чат, как и
 * раньше, на такие вопросы даёт телефон магазина.
 */

import { createHmac } from 'node:crypto'
import { store } from '@/lib/store'

const PATH = '/api/v1/webhook/site/notes'
const EVERY_MS = 10 * 60_000
/** Столько знаков чат читает. Сервер больше и не примет. */
const MAX_CHARS = 8000

type Cache = { at: number; text: string }

const cache = store<Cache>('assistant-notes', () => ({ at: 0, text: '' }))

/** Текст владельца. Никогда не бросает исключение; нет текста — пустая строка. */
export async function ownerNotes(): Promise<string> {
  const url = (process.env.SHOP_API_URL ?? '').replace(/\/+$/, '')
  const secret = process.env.SHOP_API_SECRET ?? ''
  if (!url || !secret) return ''
  if (Date.now() - cache.at < EVERY_MS) return cache.text

  // Время отмечаем до запроса: лежащий сервер не спрашиваем на каждое сообщение.
  cache.at = Date.now()
  try {
    const signature = createHmac('sha256', secret).update(PATH, 'utf8').digest('hex')
    const response = await fetch(`${url}${PATH}`, {
      headers: { 'X-Signature': signature },
      signal: AbortSignal.timeout(10_000),
    })
    // 404 — сервер ещё без этой части. Это не ошибка, просто знаний пока нет.
    if (response.status === 404) return cache.text
    if (!response.ok) {
      console.error('[assistant] знания для чата: сервер ответил', response.status)
      return cache.text
    }
    const data = (await response.json()) as { text?: unknown }
    cache.text = typeof data.text === 'string' ? data.text.trim().slice(0, MAX_CHARS) : ''
  } catch (error) {
    console.error('[assistant] знания для чата:', error instanceof Error ? error.message : error)
  }
  return cache.text
}
