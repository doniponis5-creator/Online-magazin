'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Brand } from '@/components/Brand'
import { CustomerLogin } from '@/components/CustomerLogin'
import { IconCart, IconGift, IconHeart } from '@/components/Icons'
import { formatSom } from '@/lib/format'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { forgetFaceId, hasLockKey, lockKind, loginWithFaceId, rememberForFaceId } from '@/lib/native/appLock'
import { clearBonusCard, inNativeApp, saveBonusCard, showBonusCard } from '@/lib/native/bonusCard'
import { enablePush, pushState, resumePush } from '@/lib/native/push'
import type { CustomerProfile } from '@/lib/customer/gateway'

const CABINET_URL = 'https://cabinet.smartcentr.store'

/** Загрузка профиля вошедшего покупателя (null — не вошёл, undefined — ещё грузится). */
export function useCustomer(amount = 0, full = false) {
  const [customer, setCustomer] = useState<CustomerProfile | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  // Заказ без входа разрешает владелец в 1С. Пока ответа нет — считаем, что можно:
  // иначе кнопка оплаты мигает запретом на каждой загрузке страницы.
  const [guestCheckout, setGuestCheckout] = useState(true)

  const reload = useCallback(async () => {
    const response = await fetch(`/api/customer/me?amount=${Math.round(amount)}${full ? '&full=1' : ''}`, { cache: 'no-store' }).catch(() => null)
    if (!response) return setFailed(true)
    const data = await response.json().catch(() => null)
    if (data && 'guestCheckout' in data) setGuestCheckout(data.guestCheckout !== false)
    if (response.status === 401) return setCustomer(null)
    if (data?.ok) {
      setFailed(false)
      setCustomer(data.customer)
    } else setFailed(true)
  }, [amount, full])

  useEffect(() => {
    reload()
  }, [reload])

  const logout = useCallback(async () => {
    await fetch('/api/customer/me', { method: 'DELETE' }).catch(() => null)
    setCustomer(null)
  }, [])

  return { customer, failed, guestCheckout, reload, logout, setCustomer }
}

function formatDate(value: string | null, lang: string) {
  if (!value) return ''
  return new Date(value).toLocaleDateString(lang === 'ky' ? 'ky-KG' : 'ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function AccountView() {
  const { t, lang } = useI18n()
  const a = t.account
  const { customer, failed, reload, logout } = useCustomer(0, true)
  const [welcome, setWelcome] = useState(0)
  const [nativeApp] = useState(inNativeApp)
  // 'none' — телефон не умеет или ключ ещё не сохранён; иначе 'face' или 'touch'.
  const [faceId, setFaceId] = useState<'face' | 'touch' | 'passcode' | 'none'>('none')
  const [faceIdFailed, setFaceIdFailed] = useState(false)
  // 'ask' — можно предложить включить уведомления; иначе кнопку не показываем.
  const [push, setPush] = useState<'granted' | 'denied' | 'ask' | 'none'>('none')
  // Быстрый вход в «Кабинете»: что умеет телефон и лежит ли уже ключ.
  const [lock, setLock] = useState<{
    kind: 'face' | 'touch' | 'passcode' | 'none'
    saved: boolean
  }>({ kind: 'none', saved: false })
  // Результат кнопки «Проверить»: null — ещё не нажимали.
  const [lockCheck, setLockCheck] = useState<boolean | null>(null)

  /** Перечитать состояние быстрого входа: умеет ли телефон и есть ли ключ. */
  const refreshLock = useCallback(async () => {
    const [kind, saved] = await Promise.all([lockKind(), hasLockKey()])
    setLock({ kind, saved })
  }, [])

  /** Включить быстрый вход: попросить у сайта ключ и спрятать его в телефон. */
  const lockEnable = useCallback(async () => {
    setLockCheck(null)
    await rememberForFaceId()
    await refreshLock()
  }, [refreshLock])

  /** Выключить: ключ с телефона стираем, из кабинета не выходим. */
  const lockDisable = useCallback(async () => {
    setLockCheck(null)
    await forgetFaceId()
    await refreshLock()
  }, [refreshLock])

  /**
   * Проверка лицом прямо сейчас — чтобы не ждать, пока вход закончится.
   * Ключ только достаём из телефона: в кабинет заново не входим, он уже открыт.
   */
  const lockTry = useCallback(async () => {
    const reason = 'Проверка быстрого входа S Маркет'
    setLockCheck(await loginWithFaceId(reason))
  }, [])

  // Уведомления. Если уже разрешены — тихо обновляем адрес телефона на сервере.
  // Если ещё не спрашивали — спрашиваем сами, сразу после входа: искать кнопку
  // покупатель не должен. iPhone показывает это окно один раз за установку,
  // поэтому повторно мы не пристаём.
  useEffect(() => {
    if (!customer) return
    resumePush()
    let alive = true
    pushState().then(async (state) => {
      if (!alive) return
      if (state !== 'ask') return setPush(state)
      const ok = await enablePush()
      if (alive) setPush(ok ? 'granted' : 'denied')
    })
    return () => {
      alive = false
    }
  }, [customer])

  // Вход закончился, но на телефоне остался ключ — предлагаем войти по лицу.
  useEffect(() => {
    if (customer !== null) return
    let alive = true
    Promise.all([lockKind(), hasLockKey()]).then(([kind, saved]) => {
      if (alive) setFaceId(saved && kind !== 'none' ? kind : 'none')
    })
    return () => {
      alive = false
    }
  }, [customer])

  // Внутри приложения для телефона храним карту на самом телефоне:
  // на кассе она откроется и без интернета.
  useEffect(() => {
    if (!customer) return
    rememberForFaceId().then(refreshLock)
    saveBonusCard({
      qrCode: customer.qrCode,
      name: customer.name,
      phone: customer.phone,
      balance: customer.balance,
      tier: customer.tier,
      lang,
    })
  }, [customer, lang, refreshLock])

  const leave = useCallback(async () => {
    await clearBonusCard()
    await forgetFaceId()
    await logout()
  }, [logout])

  const unlock = useCallback(async () => {
    const reason = 'Вход в личный кабинет S Маркет'
    if (await loginWithFaceId(reason)) {
      setFaceIdFailed(false)
      reload()
    } else setFaceIdFailed(true)
  }, [reload])

  const links = (
    <div className="account-links">
      <Link href={`/${lang}/favorites`}><IconHeart size={20} />{a.favorites}</Link>
      <Link href={`/${lang}/cart`}><IconCart size={20} />{a.cart}</Link>
    </div>
  )

  if (customer === undefined) {
    return <div className="account-layout" aria-busy="true">{failed && <p className="field__error">{a.errorServer}</p>}</div>
  }

  if (!customer) {
    return (
      <div className="account-layout">
        <section className="account-loyalty">
          <Brand bonus />
          <h2>{a.loyaltyTitle}</h2>
          <p>{a.loyaltyText}</p>
          <p className="account-welcome"><IconGift size={22} className="account-welcome__icon" />{a.welcomePromo.replace('{amount}', formatSom(1000))}</p>
          <p className="account-welcome__note">{a.welcomeNote}</p>
        </section>
        <section className="account-access">
          <h2>{a.loginTitle}</h2>
          {faceId !== 'none' && (
            <div className="account-faceid">
              <button type="button" className="btn btn--primary" onClick={unlock}>
                {faceId === 'touch' ? a.touchIdLogin : a.faceIdLogin}
              </button>
              {faceIdFailed && <p className="field__error">{a.faceIdFailed}</p>}
            </div>
          )}
          <p>{a.loginText}</p>
          <CustomerLogin
            onDone={(_, bonus) => {
              setWelcome(bonus)
              reload()
            }}
          />
          {links}
        </section>
      </div>
    )
  }

  return (
    <div className="account-layout">
      <section className="account-loyalty">
        <Brand bonus />
        <h2>{customer.name}</h2>
        {welcome > 0 && <p className="account-welcome" role="status">🎉 {a.welcomeDone.replace('{amount}', formatSom(welcome))}</p>}
        <div className="account-balance">
          <span className="account-balance__label">{a.balance}</span>
          <strong className="account-balance__value">{formatSom(customer.balance)}</strong>
        </div>
        <p>
          {a.tier}: <strong>{customer.tier}</strong> · {a.tierPercent.replace('{pct}', String(customer.tierPercent))}
        </p>
        <p>{a.bonusRule.replace('{pct}', String(customer.maxSpendPct))}</p>
        <div className="account-actions">
          {nativeApp && customer.qrCode && (
            <button type="button" className="btn btn--primary" onClick={showBonusCard}>{a.bonusCard}</button>
          )}
          {push === 'ask' && (
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => enablePush().then((ok) => setPush(ok ? 'granted' : 'denied'))}
            >
              🔔 {a.pushOn}
            </button>
          )}
          <a href={CABINET_URL} className="btn btn--outline" target="_blank" rel="noopener noreferrer">{a.cabinetLink}</a>
          <button type="button" className="btn btn--ghost" onClick={leave}>{a.logout}</button>
        </div>
        {push === 'denied' && <p className="account-push-off">{a.pushDenied}</p>}
      </section>

      {nativeApp && (
        <section className="account-lock">
          <h2>{a.lockTitle}</h2>
          {lock.kind === 'none' ? (
            <p className="account-lock__note">{a.lockUnsupported}</p>
          ) : (
            <>
              <p className="account-lock__state">
                {lock.kind === 'touch' ? a.lockTouch : lock.kind === 'passcode' ? a.lockPasscode : a.lockFace}
                {' · '}
                <strong className={lock.saved ? 'is-on' : 'is-off'}>
                  {lock.saved ? a.lockOn : a.lockOff}
                </strong>
              </p>
              <p className="account-lock__note">{lock.saved ? a.lockText : a.lockTextOff}</p>
              <div className="account-actions">
                {lock.saved ? (
                  <>
                    <button type="button" className="btn btn--outline" onClick={lockTry}>
                      {a.lockCheck}
                    </button>
                    <button type="button" className="btn btn--ghost" onClick={lockDisable}>
                      {a.lockDisable}
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn--primary" onClick={lockEnable}>
                    {a.lockEnable}
                  </button>
                )}
              </div>
              {lockCheck !== null && (
                <p className={lockCheck ? 'account-lock__ok' : 'field__error'} role="status">
                  {lockCheck ? `✓ ${a.lockCheckOk}` : a.lockCheckFail}
                </p>
              )}
            </>
          )}
        </section>
      )}

      <section className="account-access">
        <h2>{a.orders}</h2>
        {customer.orders?.length ? (
          <ul className="account-list">
            {customer.orders.map((o) => (
              <li key={o.orderId}>
                <Link href={`/${lang}/order/${encodeURIComponent(o.orderId)}?token=${o.token}`}>
                  <span>
                    <strong>{o.orderId}</strong>
                    <small>{formatDate(o.createdAt, lang)} · {t.order[o.status as keyof typeof t.order] ?? o.status}</small>
                  </span>
                  <span className="account-list__sum">
                    {formatSom(o.total)}
                    {o.bonusSpent > 0 && <small>−{formatSom(o.bonusSpent)} {a.bonusPaid}</small>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>{a.ordersEmpty}</p>
        )}

        <h2 className="account-access__second">{a.history}</h2>
        {customer.history?.length ? (
          <ul className="account-list">
            {customer.history.map((h, i) => {
              const minus = h.type === 'spend' || h.type === 'expire'
              return (
                <li key={`${h.date}-${i}`}>
                  <div>
                    <span>
                      <strong>{a.types[h.type as keyof typeof a.types] ?? h.type}</strong>
                      <small>{formatDate(h.date, lang)}{h.note ? ` · ${h.note}` : ''}</small>
                    </span>
                    <span className={`account-list__sum${minus ? ' is-minus' : ' is-plus'}`}>
                      {minus ? '−' : '+'}{formatSom(Math.abs(h.amount))}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p>{a.historyEmpty}</p>
        )}
        {links}
      </section>
    </div>
  )
}
