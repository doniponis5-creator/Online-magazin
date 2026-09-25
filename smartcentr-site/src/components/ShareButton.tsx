'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconCheck, IconShare } from './Icons'

/**
 * «Поделиться» товаром.
 *
 * На телефоне открывает системное окно — WhatsApp, Telegram, Instagram, что
 * стоит у человека. Покупатели советуются с семьёй в WhatsApp, и раньше для
 * этого копировали адрес из строки браузера. На компьютере, где такого окна
 * нет, ссылка копируется в буфер, и кнопка на две секунды говорит об этом.
 * Если и буфер недоступен (старый браузер, http) — открывается WhatsApp Web
 * с готовым текстом.
 */
export function ShareButton({
  title,
  text,
  path,
  variant = 'button',
  className,
}: {
  /** заголовок для системного окна — название товара */
  title: string
  /** текст рядом со ссылкой: название и цена */
  text: string
  /** путь на сайте, без домена: /ru/product/… */
  path: string
  /** button — обычная кнопка с подписью; icon — круглый значок (для ленты) */
  variant?: 'button' | 'icon'
  className?: string
}) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const share = async () => {
    const url = `${window.location.origin}${path}`
    const nav = navigator as Navigator & { share?: (data: { title: string; text: string; url: string }) => Promise<void> }
    if (typeof nav.share === 'function') {
      try {
        await nav.share({ title, text, url })
        return
      } catch (e) {
        // человек закрыл окно — это не ошибка, ничего не делаем
        if ((e as DOMException)?.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 2200)
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener')
    }
  }

  const label = copied ? t.product.linkCopied : t.product.share
  const icon = copied ? <IconCheck size={20} /> : <IconShare size={20} />

  if (variant === 'icon') {
    return (
      <button
        type="button"
        className={`share-btn${copied ? ' is-done' : ''}${className ? ` ${className}` : ''}`}
        onClick={share}
        aria-label={label}
        title={label}
      >
        {icon}
      </button>
    )
  }
  return (
    <button type="button" className={`btn${className ? ` ${className}` : ''}`} onClick={share} aria-live="polite">
      {icon}
      {label}
    </button>
  )
}
