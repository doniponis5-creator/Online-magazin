/**
 * «Я не робот» (Cloudflare Turnstile) перед действиями, которые стоят денег:
 * каждый код входа — платное сообщение в WhatsApp или Telegram, каждый заказ
 * без входа — счёт O!Деньги. Именно их и дёргают боты.
 *
 * Выключатель — две настройки сервера (docker env_file). Читаем их при каждом
 * запросе, а не при сборке: включить или выключить можно без пересборки сайта.
 *   TURNSTILE_SITE_KEY   — открытый ключ, его получает браузер;
 *   TURNSTILE_SECRET_KEY — секрет, только для сервера.
 * Не задан хотя бы один — проверки нет, всё работает как раньше.
 *
 * Сам Cloudflare не ответил (сеть, 5xx, ответ не JSON) — пропускаем:
 * сбой у Cloudflare не должен запереть вход всем покупателям сразу.
 *
 * Модуль только для сервера: секрет не должен попасть в браузер.
 */
import 'server-only'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const MAX_TOKEN = 2048
const TIMEOUT_MS = 5000

/** ok — человек (или Cloudflare недоступен), fail — не прошёл, off — проверка выключена. */
export type TurnstileResult = 'ok' | 'fail' | 'off'

function keys(): { siteKey: string; secret: string } | null {
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim()
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  return siteKey && secret ? { siteKey, secret } : null
}

/** Открытый ключ для браузера; null — проверка выключена. */
export function turnstileSiteKey(): string | null {
  return keys()?.siteKey ?? null
}

export async function verifyTurnstile(token: unknown, ip?: string): Promise<TurnstileResult> {
  const config = keys()
  if (!config) return 'off'
  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN) return 'fail'

  const form = new URLSearchParams({ secret: config.secret, response: token })
  if (ip) form.set('remoteip', ip)
  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (response.status >= 500) throw new Error(`ответил ${response.status}`)
    const data = (await response.json()) as { success?: unknown; 'error-codes'?: unknown }
    if (data.success === true) return 'ok'
    if (data.success === false) {
      // Секрет вписан с ошибкой — вина наша, а не покупателя: не запираем всех.
      const codes = Array.isArray(data['error-codes']) ? data['error-codes'] : []
      if (codes.includes('invalid-input-secret') || codes.includes('missing-input-secret')) {
        console.error('[turnstile] Cloudflare не принял TURNSTILE_SECRET_KEY — проверьте настройку; пропускаем без проверки')
        return 'ok'
      }
      return 'fail'
    }
    throw new Error('в ответе нет success')
  } catch (error) {
    // Ни токен, ни секрет в журнал не пишем — только что случилось.
    console.warn('[turnstile] Cloudflare не ответил, пропускаем без проверки:', (error as Error)?.message ?? 'ошибка')
    return 'ok'
  }
}
