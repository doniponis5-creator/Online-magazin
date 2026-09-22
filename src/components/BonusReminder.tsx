'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { bonusRule } from '@/lib/customer/bonusRule'
import { formatSom } from '@/lib/format'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconArrowUpRight, IconClose, IconGift } from './Icons'

/**
 * Полоска «у вас есть бонусы» — для вошедшего покупателя, который вернулся
 * на сайт. Человек получил 1 000 сом при регистрации и мог об этом забыть;
 * полоска напоминает и ведёт в каталог.
 *
 * Правила, чтобы не надоедать:
 *  • баланс спрашиваем у сервера не чаще раза в 10 минут (sessionStorage);
 *  • не показываем в кабинете, корзине и на оформлении — там бонусы и так видны;
 *  • закрыл крестиком — молчим до завтра (localStorage);
 *  • баланс нулевой или не вошёл — полоски нет.
 */
const CACHE_KEY = 'sc-bonus-cache'
const OFF_KEY = 'sc-bonus-bar-off'
const CACHE_MS = 10 * 60_000
const DELAY = 2200

type Cached = { at: number; balance: number; pct: number; cap?: number }

export function BonusReminder() {
  const { t, lang } = useI18n()
  const a = t.account
  const pathname = usePathname() || ''
  const [info, setInfo] = useState<Cached | null>(null)
  const [hidden, setHidden] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const off = window.localStorage.getItem(OFF_KEY)
      setHidden(Boolean(off && Date.now() - Number(off) < 24 * 3600_000))
    } catch {
      setHidden(false)
    }
    const id = setTimeout(() => setReady(true), DELAY)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!ready || hidden) return
    let cancelled = false
    const load = async () => {
      try {
        const raw = window.sessionStorage.getItem(CACHE_KEY)
        const cached = raw ? (JSON.parse(raw) as Cached) : null
        if (cached && Date.now() - cached.at < CACHE_MS) {
          setInfo(cached)
          return
        }
      } catch {
        // без кэша — просто спросим сервер
      }
      const response = await fetch('/api/customer/me').catch(() => null)
      const data = response && response.ok ? await response.json().catch(() => null) : null
      if (cancelled) return
      // Не вошёл — ничего не запоминаем: после входа полоска должна появиться сразу.
      if (!data?.customer) return
      const next: Cached = {
        at: Date.now(),
        balance: Number(data.customer.balance ?? 0),
        pct: Number(data.customer.maxSpendPct ?? 0),
        cap: Number(data.customer.maxSpendCap ?? 0),
      }
      setInfo(next)
      try {
        window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(next))
      } catch {
        // приватный режим — переспросим в следующий раз
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [ready, hidden])

  const quietPages = ['account', 'cart', 'checkout', 'order'].some((p) => pathname.startsWith(`/${lang}/${p}`))
  if (hidden || quietPages || !info || info.balance <= 0) return null

  const hide = () => {
    setHidden(true)
    try {
      window.localStorage.setItem(OFF_KEY, String(Date.now()))
    } catch {
      // в этой вкладке полоска всё равно скрыта
    }
  }

  return (
    <div className="bonus-bar" role="status">
      <span className="bonus-bar__icon" aria-hidden="true"><IconGift size={20} /></span>
      <span className="bonus-bar__text">
        {a.bonusBarText.replace('{amount}', formatSom(info.balance)).replace('{rule}', bonusRule(info.pct, info.cap ?? 0, lang))}
      </span>
      <Link href={`/${lang}/catalog`} className="btn btn--lime btn--sm bonus-bar__cta" onClick={hide}>
        <span className="bonus-bar__cta-long">{a.bonusBarCta}</span>
        <span className="bonus-bar__cta-short">{a.bonusBarShort}</span>
        <IconArrowUpRight size={16} />
      </Link>
      <button type="button" className="bonus-bar__close" onClick={hide} aria-label={a.bonusBarHide}>
        <IconClose size={18} />
      </button>
    </div>
  )
}
