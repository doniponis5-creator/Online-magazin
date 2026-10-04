'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { inNativeApp } from '@/lib/native/bonusCard'
import { formatSom } from '@/lib/format'
import { APP_BAR_OFF, APP_STORE_URL, appBarWanted, isIos } from '@/lib/native/appStore'
import { IconArrowUpRight, IconClose } from './Icons'

/**
 * «Скачайте приложение» — полоса вверху для iPhone, открывшего сайт из Instagram, WhatsApp, Telegram
 * или в Chrome: там родной полосы Apple нет (в Safari её показывает сам iPhone — metadata `itunes`).
 *
 * Чтобы не надоедать: закрыл — молчим неделю; в приложении, на оформлении заказа и в конструкторе кухни
 * (там свои панели внизу и вверху) — не показываем.
 * Есть бонусы — говорим о них: «У вас 1 000 сом бонусов — бонусная карта всегда с вами в приложении».
 * Полоса бонусов при этом молчит (BonusReminder → appBarWanted), чтобы не было двух полос подряд.
 */

export function AppBanner() {
  const { t, lang } = useI18n()
  const a = t.app
  const pathname = usePathname() || ''
  const [show, setShow] = useState(false)
  const [bonus, setBonus] = useState(0)

  useEffect(() => {
    if (!appBarWanted(inNativeApp())) return
    setShow(true)
    // Вошёл и есть бонусы — скажем сумму. Не вошёл — 401, просто без суммы.
    let cancelled = false
    fetch('/api/customer/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setBonus(Number(data?.customer?.balance ?? 0))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const quiet = ['checkout', 'kitchen'].some((p) => pathname.startsWith(`/${lang}/${p}`))
  if (!show || quiet) return null

  const hide = () => {
    setShow(false)
    try {
      window.localStorage.setItem(APP_BAR_OFF, String(Date.now()))
    } catch {
      // в этой вкладке полоса всё равно скрыта
    }
  }

  return (
    <div className="app-bar" role="region" aria-label={a.barTitle}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="app-bar__icon" src="/icon.jpg" alt="" width={40} height={40} />
      <span className="app-bar__text">
        <b>{bonus > 0 ? a.barBonusTitle.replace('{amount}', formatSom(bonus)) : a.barTitle}</b>
        <span>{bonus > 0 ? a.barBonusText : a.barText}</span>
      </span>
      <a className="btn btn--lime btn--sm app-bar__cta" href={APP_STORE_URL} target="_blank" rel="noopener" onClick={hide}>
        {a.barCta}
        <IconArrowUpRight size={16} />
      </a>
      <button type="button" className="app-bar__close" onClick={hide} aria-label={a.barClose}>
        <IconClose size={18} />
      </button>
    </div>
  )
}

/** На странице заказа: «следите за заказом в приложении» — iPhone, не в приложении (и в Safari тоже). */
export function AppOrderPromo() {
  const { t } = useI18n()
  const [show, setShow] = useState(false)
  useEffect(() => {
    setShow(!inNativeApp() && isIos(navigator.userAgent, navigator.maxTouchPoints))
  }, [])
  if (!show) return null
  return (
    <div className="app-promo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="app-bar__icon" src="/icon.jpg" alt="" width={40} height={40} />
      <p className="app-promo__text">{t.app.orderText}</p>
      <a className="btn btn--outline btn--sm" href={APP_STORE_URL} target="_blank" rel="noopener">
        {t.app.orderCta}
        <IconArrowUpRight size={16} />
      </a>
    </div>
  )
}
