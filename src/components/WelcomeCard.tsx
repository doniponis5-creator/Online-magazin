'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatSom } from '@/lib/format'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconArrowUpRight, IconGift } from './Icons'

/**
 * Карточка сразу после регистрации: «Поздравляем — 1 000 сом ваши».
 *
 * Один авторский момент на всю страницу: карточка поднимается, значок
 * подарка «выстреливает» лимонными и голубыми искрами, сумма набегает от нуля.
 * Дальше — обычный кабинет. При prefers-reduced-motion всё появляется сразу.
 */
const COUNT_MS = 900
/** Искры: угол и дальность каждой, чтобы они не летели одинаково. */
const SPARKS = [
  [-72, 74], [-38, 92], [-8, 70], [22, 96], [52, 78], [86, 88],
  [-100, 60], [116, 66], [-56, 52], [40, 50], [4, 104], [-24, 44],
]

export function WelcomeCard({ amount, pct }: { amount: number; pct: number }) {
  const { t, lang } = useI18n()
  const a = t.account
  const [shown, setShown] = useState(amount)

  useEffect(() => {
    const still = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (still || amount <= 0) return
    let frame = 0
    const started = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - started) / COUNT_MS)
      // Замедление к концу: сумма «докатывается», а не обрывается.
      const eased = 1 - Math.pow(1 - k, 3)
      setShown(Math.round(amount * eased))
      if (k < 1) frame = requestAnimationFrame(tick)
    }
    setShown(0)
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [amount])

  return (
    <section className="hello" role="status" aria-live="polite">
      <div className="hello__badge" aria-hidden="true">
        <span className="hello__sparks">
          {SPARKS.map(([angle, dist], i) => (
            <i
              key={i}
              className={`hello__spark hello__spark--${i % 3}`}
              style={{ '--a': `${angle}deg`, '--d': `${dist}px`, '--i': i } as React.CSSProperties}
            />
          ))}
        </span>
        <IconGift size={30} />
      </div>

      <h2 className="hello__title">{a.helloTitle}</h2>
      <p className="hello__amount">
        <span className="hello__sum">{formatSom(shown)}</span>
        <span className="hello__yours">{a.helloYours}</span>
      </p>
      <p className="hello__text">{a.helloText.replace('{pct}', String(pct))}</p>

      <Link href={`/${lang}/catalog`} className="btn btn--lime btn--block hello__cta">
        {a.helloCta}
        <IconArrowUpRight size={18} />
      </Link>
    </section>
  )
}
