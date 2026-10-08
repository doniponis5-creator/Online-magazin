'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconClock } from './Icons'

/**
 * Обратный отсчёт до конца акции «Специально для вас».
 *
 * Срок ставит владелец в 1С: «Панель сайта» → «Акция идёт до». Пусто или срок
 * прошёл — блока нет вовсе. Врать про «осталось 2 часа» каждый день нельзя:
 * покупатель проверяет, и доверие теряется навсегда.
 *
 * Время из 1С бишкекское, а телефон покупателя может стоять в любом поясе,
 * поэтому считаем от явного +06:00, а не от местного времени устройства.
 */
const BISHKEK = '+06:00'

function msLeft(until: string): number {
  const iso = /[+-]\d{2}:\d{2}$|Z$/.test(until) ? until : `${until}${BISHKEK}`
  const end = Date.parse(iso)
  return Number.isNaN(end) ? 0 : end - Date.now()
}

const two = (n: number) => String(n).padStart(2, '0')

export function PromoCountdown({
  until,
  variant = 'inline',
}: {
  until: string | null
  /** 'card' — наклейка поверх картинки товара, 'inline' — строкой в заголовке */
  variant?: 'inline' | 'card'
}) {
  const { t } = useI18n()
  const [left, setLeft] = useState<number | null>(null)

  // Сотые доли секунды бегут только у крупного таймера (страница товара, главная — владелец 08.10): у карточек
  // каталога их десятки, и телефон тратил бы кадры. «Меньше движения» в настройках телефона — без них.
  const [fast, setFast] = useState(false)
  useEffect(() => {
    setFast(variant === 'inline' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [variant])

  useEffect(() => {
    if (!until) return setLeft(null)
    // Считаем после монтирования: на сервере и на клиенте «сейчас» разное,
    // и React ругался бы на расхождение разметки.
    const tick = () => setLeft(msLeft(until))
    tick()
    if (!fast) {
      const id = setInterval(tick, 1000)
      return () => clearInterval(id)
    }
    // ~25 раз в секунду, и только пока вкладка видна (requestAnimationFrame сам засыпает в фоне)
    let frame = 0
    let last = 0
    const loop = (now: number) => {
      if (now - last >= 40) {
        last = now
        tick()
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [until, fast])

  if (left === null || left <= 0) return null

  const total = Math.floor(left / 1000)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const hundredths = Math.floor((left % 1000) / 10)

  const soon = left < 3600_000

  return (
    <span
      className={`promo-timer promo-timer--${variant}${soon ? ' is-soon' : ''}`}
      role="timer"
      title={t.promo.endsIn}
    >
      {variant === 'card' ? (
        <i className="promo-timer__dot" aria-hidden="true" />
      ) : (
        <IconClock size={16} />
      )}
      <span className="promo-timer__label">{t.promo.endsIn}</span>
      <strong className="promo-timer__value">
        {days > 0 && `${days} ${t.promo.days} `}
        {two(hours)}:{two(minutes)}:{two(seconds)}
        {fast && <span className="promo-timer__ms">.{two(hundredths)}</span>}
      </strong>
    </span>
  )
}
