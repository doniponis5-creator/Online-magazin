'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'

/**
 * «Я не робот» (Cloudflare Turnstile) над кнопками, которые стоят денег:
 * «Получить код», «Войти через WhatsApp» и заказ без входа.
 *
 * Ключ приходит с сервера (/api/site-settings): нет ключа — нет и виджета,
 * формы работают как раньше. Токен одноразовый и живёт ~5 минут, поэтому
 * после каждого запроса форма сбрасывает виджет (resetKey + 1) — Cloudflare
 * сам выдаст новый.
 */

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string | undefined
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

// Скрипт Cloudflare грузим один раз на всю страницу, сколько бы виджетов ни было.
let scriptPromise: Promise<TurnstileApi> | null = null

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')))
    script.onerror = () => {
      script.remove()
      reject(new Error('turnstile'))
    }
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    // Не загрузился — следующий виджет попробует ещё раз
    scriptPromise = null
    throw error
  })
  return scriptPromise
}

// Ключ спрашиваем у сервера один раз на страницу: вход и заказ делят один ответ.
let keyPromise: Promise<string | null> | null = null

function fetchSiteKey(): Promise<string | null> {
  keyPromise ??= fetch('/api/site-settings', { cache: 'no-store' })
    .then((response) => response.json())
    .then((data: { turnstileSiteKey?: unknown } | null) =>
      typeof data?.turnstileSiteKey === 'string' && data.turnstileSiteKey ? data.turnstileSiteKey : null,
    )
    .catch(() => {
      keyPromise = null
      return null
    })
  return keyPromise
}

/**
 * Открытый ключ Turnstile: undefined — ещё спрашиваем, null — проверка выключена.
 * reload() — спросить заново: сервер ответил «captcha», а виджета у нас нет
 * (владелец включил проверку, пока страница была открыта).
 */
export function useTurnstileKey() {
  const [siteKey, setSiteKey] = useState<string | null | undefined>(undefined)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    void fetchSiteKey().then((key) => {
      if (alive.current) setSiteKey(key)
    })
    return () => {
      alive.current = false
    }
  }, [])

  const reload = useCallback(() => {
    keyPromise = null
    void fetchSiteKey().then((key) => {
      if (alive.current) setSiteKey(key)
    })
  }, [])

  return { siteKey, reload }
}

export function Turnstile({
  siteKey,
  onToken,
  resetKey = 0,
}: {
  siteKey: string
  onToken: (token: string | null) => void
  /** увеличьте после каждого запроса — виджет выдаст новый токен */
  resetKey?: number
}) {
  const { t } = useI18n()
  const box = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const tokenTo = useRef(onToken)
  const lastReset = useRef(resetKey)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    tokenTo.current = onToken
  }, [onToken])

  useEffect(() => {
    let alive = true
    loadTurnstile()
      .then((turnstile) => {
        if (!alive || !box.current) return
        widget.current =
          turnstile.render(box.current, {
            sitekey: siteKey,
            // Кыргызского у Turnstile нет — для обоих языков русский
            language: 'ru',
            // Узкий телефон: обычный виджет (300 px) не влезет — берём компактный
            size: box.current.clientWidth < 300 ? 'compact' : 'normal',
            callback: (token: string) => tokenTo.current(token),
            'expired-callback': () => tokenTo.current(null),
            // Cloudflare сам повторит проверку; до тех пор токена нет
            'error-callback': () => tokenTo.current(null),
          }) ?? null
      })
      .catch(() => {
        if (!alive) return
        setFailed(true)
        tokenTo.current(null)
      })
    return () => {
      alive = false
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
      tokenTo.current(null)
    }
  }, [siteKey])

  // Токен уже потрачен — просим у Cloudflare новый
  useEffect(() => {
    if (lastReset.current === resetKey) return
    lastReset.current = resetKey
    tokenTo.current(null)
    if (widget.current) window.turnstile?.reset(widget.current)
  }, [resetKey])

  if (failed) {
    return (
      <p role="alert" className="field__error">
        {t.common.captchaLoad}
      </p>
    )
  }
  return <div ref={box} className="turnstile" />
}
