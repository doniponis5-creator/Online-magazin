import 'server-only'

/**
 * authorId — непрозрачная метка автора вместо телефона: по ней работают
 * страница «Все кухни мастера» и фильтр, а телефон по ней не восстановить.
 *
 * HMAC с секретом сайта (SHOP_API_SECRET). Секрета нет: в продакшене — ошибка
 * (как у сессии, `session.ts`); в разработке — sha256 с постоянной солью и
 * предупреждением в журнале.
 * В этом модуле секрет, поэтому он отдельно от rules.ts, который читает браузер.
 */

import { createHash, createHmac } from 'node:crypto'

const DEV_SALT = 'smartcentr-gallery-dev-salt'
let warned = false

export function authorIdOf(phone: string): string {
  const secret = process.env.SHOP_API_SECRET
  if (secret) return createHmac('sha256', secret).update(`gallery-author:${phone}`, 'utf8').digest('hex').slice(0, 12)
  if (process.env.NODE_ENV === 'production') throw new Error('SHOP_API_SECRET не задан')
  if (!warned) {
    warned = true
    console.warn('[gallery] SHOP_API_SECRET не задан: authorId считается без секрета (только для разработки)')
  }
  return createHash('sha256').update(`${DEV_SALT}:${phone}`, 'utf8').digest('hex').slice(0, 12)
}
