'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import { AccountReviews, ReviewLoginHint } from '@/components/AccountReviews'
import { Brand } from '@/components/Brand'
import { CustomerLogin } from '@/components/CustomerLogin'
import { IconCart, IconCheck, IconChevronLeft, IconChevronRight, IconGift, IconHeart, IconMapPin, IconTruck, IconUser } from '@/components/Icons'
import { WelcomeCard } from '@/components/WelcomeCard'
import { addressLine, cleanAddress, type SavedAddress } from '@/lib/customer/address-rules'
import { bonusRule } from '@/lib/customer/bonusRule'
import { useFavorites } from '@/lib/favorites/FavoritesProvider'
import { formatSom } from '@/lib/format'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { forgetFaceId, hasLockKey, lockKind, loginWithFaceId, rememberForFaceId } from '@/lib/native/appLock'
import { clearBonusCard, inNativeApp, saveBonusCard, showBonusCard } from '@/lib/native/bonusCard'
import { cartSignedIn, cartSignedOut } from '@/lib/native/cartSync'
import { enablePush, pushPlatform, pushState, resumePush } from '@/lib/native/push'
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
    // Корзина в приложении уходит на сервер только вошедшим — сообщаем, вошёл ли покупатель.
    if (response.status === 401) {
      cartSignedOut()
      return setCustomer(null)
    }
    if (data?.ok) {
      setFailed(false)
      cartSignedIn()
      setCustomer(data.customer)
    } else setFailed(true)
  }, [amount, full])

  useEffect(() => {
    reload()
  }, [reload])

  const logout = useCallback(async () => {
    await fetch('/api/customer/me', { method: 'DELETE' }).catch(() => null)
    cartSignedOut()
    setCustomer(null)
  }, [])

  return { customer, failed, guestCheckout, reload, logout, setCustomer }
}

/** Разделы кабинета; избранное — своя страница, в меню оно ссылкой. */
type Section = 'orders' | 'bonus' | 'address' | 'settings'
const SECTIONS: readonly string[] = ['orders', 'bonus', 'address', 'settings']
const sectionFromHash = (): Section | null => {
  const id = typeof window === 'undefined' ? '' : window.location.hash.slice(1)
  return SECTIONS.includes(id) ? (id as Section) : null
}

/**
 * Открытый раздел живёт в адресе (#orders): «Назад» телефона закрывает раздел,
 * а ссылку можно открыть сразу на нужном месте. null — меню (на компьютере
 * справа тогда «Мои заказы»).
 */
function useSection(cab: RefObject<HTMLElement | null>) {
  const [section, setSection] = useState<Section | null>(null)
  // Раздел открыли нажатием (есть куда вернуться history.back) или пришли по ссылке с #
  const pushed = useRef(false)

  useEffect(() => {
    const sync = () => setSection(sectionFromHash())
    sync()
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])

  const open = useCallback(
    (next: Section | null) => {
      const now = sectionFromHash()
      if (next === now) return
      if (next) {
        if (now) window.history.replaceState(null, '', `#${next}`)
        else {
          window.history.pushState(null, '', `#${next}`)
          pushed.current = true
        }
      } else if (pushed.current) {
        pushed.current = false
        window.history.back()
      } else window.history.replaceState(null, '', window.location.pathname + window.location.search)
      setSection(next)
      // Телефон: раздел встаёт на место меню — поднимаем его к началу кабинета
      requestAnimationFrame(() => {
        const box = cab.current
        if (box && box.getBoundingClientRect().top < 0) box.scrollIntoView({ block: 'start' })
      })
    },
    [cab],
  )

  return [section, open] as const
}

/** Постоянный адрес доставки: один раз указал — при оформлении подставится сам. */
function AddressSection({ saved, onSaved }: { saved: SavedAddress | null | undefined; onSaved: (value: SavedAddress | null) => void }) {
  const { t } = useI18n()
  const a = t.account
  const [city, setCity] = useState(saved?.city ?? '')
  const [line, setLine] = useState(saved?.address ?? '')
  const [state, setState] = useState<'idle' | 'busy' | 'saved' | 'failed'>('idle')

  // Адрес пришёл с сервера после открытия раздела — подставляем, пока поля не трогали
  useEffect(() => {
    if (!saved) return
    setCity((v) => v || saved.city)
    setLine((v) => v || saved.address)
  }, [saved])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const clean = cleanAddress({ city, address: line })
    if (!clean) return setState('failed')
    setState('busy')
    const response = await fetch('/api/customer/address', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clean),
    }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (data?.ok) {
      onSaved(data.address)
      setCity(data.address.city)
      setLine(data.address.address)
      setState('saved')
    } else setState('failed')
  }

  const remove = async () => {
    setState('busy')
    const response = await fetch('/api/customer/address', { method: 'DELETE' }).catch(() => null)
    if (response?.ok) {
      onSaved(null)
      setCity('')
      setLine('')
      setState('idle')
    } else setState('failed')
  }

  const edited = () => state !== 'busy' && setState('idle')

  return (
    <section className="cab-section" aria-labelledby="cab-address">
      <h2 className="cab-section__title" id="cab-address">{a.addressTitle}</h2>
      <p className="cab-section__lead">{a.addressText}</p>
      <form className="cab-address" onSubmit={save} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="cab-city">{t.checkout.region}</label>
          <input
            id="cab-city"
            value={city}
            onChange={(e) => {
              setCity(e.target.value)
              edited()
            }}
            placeholder={t.city}
            autoComplete="address-level2"
            maxLength={60}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="cab-line">{t.checkout.address}</label>
          <input
            id="cab-line"
            value={line}
            onChange={(e) => {
              setLine(e.target.value)
              edited()
            }}
            placeholder={t.checkout.addressPlaceholder}
            autoComplete="street-address"
            maxLength={200}
          />
        </div>
        <div className="account-actions cab-address__actions">
          <button type="submit" className="btn btn--primary" disabled={state === 'busy'} aria-busy={state === 'busy'}>
            {a.addressSave}
          </button>
          {saved && (
            <button type="button" className="btn btn--ghost" onClick={remove} disabled={state === 'busy'}>
              {a.addressRemove}
            </button>
          )}
        </div>
        <p className="cab-address__status" role="status" aria-live="polite">
          {state === 'saved' && (
            <span className="cab-address__ok">
              <IconCheck size={16} /> {a.addressSaved}
            </span>
          )}
        </p>
        {state === 'failed' && <p className="field__error" role="alert">{a.addressFailed}</p>}
      </form>
    </section>
  )
}

function formatDate(value: string | null, lang: string) {
  if (!value) return ''
  return new Date(value).toLocaleDateString(lang === 'ky' ? 'ky-KG' : 'ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Согласие на рекламные уведомления по адресу сайта (`/api/push/consent` или `/api/push/promo-consent`).
 * consent: undefined — не знаем (грузим или сервер молчит), null — ещё не спрашивали,
 * true/false — ответ покупателя. Без номера (не вошёл или уведомления не разрешены) сервер не спрашиваем.
 */
function usePushConsent(url: string, phone: string | undefined) {
  const [consent, setConsent] = useState<boolean | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  // Ответ уже дан: чтение, начатое раньше ответа, его не перетирает.
  const answered = useRef(false)

  useEffect(() => {
    if (!phone) return
    let alive = true
    fetch(url, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (alive && data?.ok && !answered.current) setConsent(typeof data.consent === 'boolean' ? data.consent : null)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [url, phone])

  /** Ответ покупателя — на сервер. Не сохранилось — остаёмся на прежнем и говорим об этом. */
  const save = useCallback(async (value: boolean) => {
    setBusy(true)
    setFailed(false)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ consent: value }),
    }).catch(() => null)
    setBusy(false)
    if (response?.ok) {
      answered.current = true
      setConsent(value)
    } else setFailed(true)
  }, [url])

  return { consent, busy, failed, save }
}

export function AccountView() {
  const { t, lang } = useI18n()
  const a = t.account
  const { customer, failed, guestCheckout, reload, logout } = useCustomer(0, true)
  const m = a.menu
  const favorites = useFavorites()
  const cabRef = useRef<HTMLDivElement>(null)
  const [section, open] = useSection(cabRef)
  // Постоянный адрес: undefined — ещё не знаем, null — не указан
  const [savedAddress, setSavedAddress] = useState<SavedAddress | null | undefined>(undefined)
  const signedPhone = customer?.phone
  useEffect(() => {
    if (!signedPhone) return
    let alive = true
    fetch('/api/customer/address', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (alive) setSavedAddress(data?.ok ? cleanAddress(data.address) : null)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [signedPhone])
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
  // Удаление учётной записи: 'idle' → 'confirm' → 'busy' → 'failed'.
  const [wipe, setWipe] = useState<'idle' | 'confirm' | 'busy' | 'failed'>('idle')
  // Скидки, новинки и напоминания о корзине — реклама, поэтому только с явного «да»
  // в самом приложении (Apple 4.5.4): окно телефона «Разрешить» согласием на рекламу
  // не считается. На сервере это два согласия, но покупателя спрашиваем один раз:
  // один ответ пишется в оба. Читаем их, только когда уведомления уже разрешены.
  const consentPhone = push === 'granted' ? customer?.phone : undefined
  const remind = usePushConsent('/api/push/consent', consentPhone)
  const promo = usePushConsent('/api/push/promo-consent', consentPhone)
  const [notifyBusy, setNotifyBusy] = useState(false)
  // Вопрос: телефон ещё не спрашивал разрешение, или разрешение есть, а ответа про рекламу нет.
  const notifyAsk = push === 'ask' || (push === 'granted' && (remind.consent === null || promo.consent === null))
  const notifyOn = remind.consent === true || promo.consent === true
  const notifyKnown = remind.consent !== undefined || promo.consent !== undefined

  /**
   * Один ответ на один вопрос. «Да» и «Только о заказах» оба сначала просят у телефона
   * разрешение (без него не дойдут и уведомления о заказах), потом записывают ответ про рекламу.
   * Телефон не разрешил — рекламу не записываем: доставить её всё равно нельзя.
   */
  const answerNotify = useCallback(async (yes: boolean) => {
    setNotifyBusy(true)
    let state = push
    if (state === 'ask') {
      state = (await enablePush()) ? 'granted' : 'denied'
      setPush(state)
    }
    if (state === 'granted') await Promise.all([remind.save(yes), promo.save(yes)])
    setNotifyBusy(false)
  }, [push, remind.save, promo.save])

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
  // Если телефон ещё не спрашивал — сразу после входа показываем наш вопрос вверху
  // кабинета, а окно телефона «Разрешить» идёт следом за ответом. Искать кнопку
  // покупатель не должен.
  useEffect(() => {
    if (!customer) return
    resumePush()
    let alive = true
    pushState().then((state) => {
      if (alive) setPush(state)
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

  /**
   * Удалить учётную запись. Apple требует, чтобы это делалось прямо здесь, а не
   * звонком в магазин (правило 5.1.1).
   *
   * Порядок важен: сначала просим сервер убрать адрес телефона для уведомлений,
   * и только потом стираем всё с самого телефона и закрываем вход. Иначе, если
   * связь оборвётся, человек уже вышел, а уведомления продолжают приходить.
   */
  const removeAccount = useCallback(async () => {
    setWipe('busy')
    const response = await fetch('/api/customer/delete', { method: 'POST' }).catch(() => null)
    if (!response?.ok) {
      setWipe('failed')
      return
    }
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
          <ReviewLoginHint />
          <h2>{a.loginTitle}</h2>
          {faceId !== 'none' && (
            <div className="account-faceid">
              <button type="button" className="btn btn--primary" onClick={unlock}>
                {faceId === 'touch' ? a.touchIdLogin : a.faceIdLogin}
              </button>
              {faceIdFailed && <p className="field__error">{a.faceIdFailed}</p>}
            </div>
          )}
          {/* Правда только пока заказ без входа включён в «Панели сайта». Apple
              проверяет именно это: приложение работает без чужих мессенджеров. */}
          {guestCheckout && <p className="account-optional">{a.loginOptional}</p>}
          <p>{nativeApp ? a.loginTextApp : a.loginText}</p>
          <CustomerLogin
            onDone={(_, bonus) => {
              // Баланс изменился — полоска «у вас есть бонусы» пусть спросит заново.
              try {
                window.sessionStorage.removeItem('sc-bonus-cache')
              } catch {
                // приватный режим
              }
              setWelcome(bonus)
              reload()
            }}
          />
          {links}
        </section>
      </div>
    )
  }

  const orders = customer.orders ?? []
  const waiting = orders.filter((o) => o.status === 'awaiting_payment').length
  const active: Section = section ?? 'orders'
  const menu: { id: Section | 'favorites'; icon: ReactNode; title: string; sub: string }[] = [
    {
      id: 'orders',
      icon: <IconTruck size={20} />,
      title: m.orders,
      sub: orders.length
        ? m.ordersCount.replace('{n}', String(orders.length)) + (waiting ? ` · ${m.ordersWaiting.replace('{n}', String(waiting))}` : '')
        : m.ordersNone,
    },
    { id: 'bonus', icon: <IconGift size={20} />, title: m.bonus, sub: `${formatSom(customer.balance)} · ${customer.tier}` },
    { id: 'address', icon: <IconMapPin size={20} />, title: m.address, sub: savedAddress ? addressLine(savedAddress) : m.addressNone },
    {
      id: 'favorites',
      icon: <IconHeart size={20} />,
      title: m.favorites,
      sub: favorites.hydrated && favorites.ids.length ? m.favoritesCount.replace('{n}', String(favorites.ids.length)) : m.favoritesNone,
    },
    { id: 'settings', icon: <IconUser size={20} />, title: m.settings, sub: nativeApp ? m.settingsApp : m.settingsWeb },
  ]

  return (
    <div className="cab-wrap">
      {/* Сразу после входа — один вопрос про уведомления, дальше окно телефона «Разрешить». */}
      {notifyAsk && (push === 'ask' || notifyKnown) && (
        <section className="account-remind" aria-busy={notifyBusy}>
          <h2>{a.notifyAsk}</h2>
          <p className="account-remind__note">{a.notifyText}</p>
          {push === 'ask' && <p className="account-remind__note">{a.notifyPhoneNext}</p>}
          <div className="account-actions">
            <button type="button" className="btn btn--primary" disabled={notifyBusy} onClick={() => answerNotify(true)}>
              {a.notifyYes}
            </button>
            <button type="button" className="btn btn--ghost" disabled={notifyBusy} onClick={() => answerNotify(false)}>
              {a.notifyOrdersOnly}
            </button>
          </div>
          {(remind.failed || promo.failed) && <p className="field__error" role="alert">{a.remindFailed}</p>}
        </section>
      )}

      {/* Подарок за регистрацию — во всю ширину над кабинетом: в колонке он растягивал меню вниз */}
      {welcome > 0 && <WelcomeCard amount={welcome} pct={customer.maxSpendPct} cap={customer.maxSpendCap ?? 0} />}

      {/* Первым делом — «Оцените покупку»: внизу кабинета её не находили. */}
      <AccountReviews orders={orders} />

      {/*
        Кабинет — меню и раздел (владелец, 28.09.2026: «всё в одном месте, по порядку»).
        Компьютер: меню слева, раздел справа. Телефон: сначала меню, нажали — раздел
        на весь экран с «← Кабинет»; раздел живёт в адресе (#orders), поэтому кнопка
        «Назад» телефона возвращает к меню.
      */}
      <div className={`cab${section ? ' cab--open' : ''}`} id="cab" ref={cabRef}>
        <aside className="cab__side">
          <section className="cab-profile">
            <Brand bonus />
            <h2 className="cab-profile__name">{customer.name}</h2>
            <p className="cab-profile__phone">{customer.phone}</p>
            <div className="account-balance">
              <span className="account-balance__label">{a.balance}</span>
              <strong className="account-balance__value">{formatSom(customer.balance)}</strong>
            </div>
            <p className="cab-profile__tier">
              {a.tier}: <strong>{customer.tier}</strong> · {a.tierPercent.replace('{pct}', String(customer.tierPercent))}
            </p>
            {nativeApp && customer.qrCode && (
              <button type="button" className="btn btn--primary cab-profile__card" onClick={showBonusCard}>
                {a.bonusCard}
              </button>
            )}
          </section>

          <nav className="cab-menu" aria-label={a.title}>
            <ul>
              {menu.map((item) => {
                const body = (
                  <>
                    <span className="cab-menu__icon" aria-hidden="true">{item.icon}</span>
                    <span className="cab-menu__text">
                      <strong>{item.title}</strong>
                      <small>{item.sub}</small>
                    </span>
                    <IconChevronRight size={18} className="cab-menu__go" />
                  </>
                )
                return (
                  <li key={item.id}>
                    {item.id === 'favorites' ? (
                      <Link href={`/${lang}/favorites`} className="cab-menu__item">{body}</Link>
                    ) : (
                      <button
                        type="button"
                        className="cab-menu__item"
                        aria-current={item.id === active ? 'true' : undefined}
                        onClick={() => open(item.id as Section)}
                      >
                        {body}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
            <button type="button" className="cab-menu__logout" onClick={leave}>{a.logout}</button>
          </nav>
        </aside>

        <div className="cab__main">
          <button type="button" className="cab__back" onClick={() => open(null)}>
            <IconChevronLeft size={18} />
            {m.back}
          </button>

          {active === 'orders' && (
            <section className="cab-section" aria-labelledby="cab-orders">
              <h2 className="cab-section__title" id="cab-orders">{m.orders}</h2>
              {orders.length ? (
                <ul className="account-list">
                  {orders.map((o) => (
                    <li key={o.orderId}>
                      <Link href={`/${lang}/order/${encodeURIComponent(o.orderId)}?token=${o.token}`}>
                        <span>
                          <strong>{o.orderId}</strong>
                          <small>{formatDate(o.createdAt, lang)}</small>
                          <em className={`cab-status cab-status--${o.status}`}>
                            {t.order[o.status as keyof typeof t.order] ?? o.status}
                          </em>
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
                <p className="cab-section__empty">{a.ordersEmpty}</p>
              )}
            </section>
          )}

          {active === 'bonus' && (
            <section className="cab-section" aria-labelledby="cab-bonus">
              <h2 className="cab-section__title" id="cab-bonus">{m.bonus}</h2>
              <p className="cab-section__lead">{a.bonusRule.replace('{rule}', bonusRule(customer.maxSpendPct, customer.maxSpendCap ?? 0, lang))}</p>
              <div className="account-actions cab-section__actions">
                <a href={CABINET_URL} className="btn btn--outline" target="_blank" rel="noopener noreferrer">{a.cabinetLink}</a>
              </div>
              <h3 className="cab-section__sub">{a.history}</h3>
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
                <p className="cab-section__empty">{a.historyEmpty}</p>
              )}
            </section>
          )}

          {active === 'address' && <AddressSection saved={savedAddress} onSaved={setSavedAddress} />}

          {active === 'settings' && (
            <section className="cab-section" aria-labelledby="cab-settings">
              <h2 className="cab-section__title" id="cab-settings">{m.settings}</h2>

              {/* Путь в настройках у iPhone и Android разный — показываем тот, что на руках */}
              {push === 'denied' && (
                <p className="account-push-off">{pushPlatform() === 'android' ? a.pushDeniedAndroid : a.pushDenied}</p>
              )}

              {/* После ответа — один переключатель: передумать можно в любой момент (Apple 4.5.4). */}
              {push === 'granted' && notifyKnown && !notifyAsk && (
                <section className="account-remind" aria-busy={remind.busy || promo.busy}>
                  <div className="account-remind__row">
                    <div>
                      <h2 id="account-notify-title">{a.notifyTitle}</h2>
                      <p className={`account-remind__state ${notifyOn ? 'is-on' : 'is-off'}`}>
                        {notifyOn ? a.remindOn : a.remindOff}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifyOn}
                      aria-labelledby="account-notify-title"
                      className="account-switch"
                      disabled={remind.busy || promo.busy}
                      onClick={() => Promise.all([remind.save(!notifyOn), promo.save(!notifyOn)])}
                    />
                  </div>
                  <p className="account-remind__note">{a.notifyText}</p>
                  {(remind.failed || promo.failed) && <p className="field__error" role="alert">{a.remindFailed}</p>}
                </section>
              )}

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

              <section className="account-wipe">
                <h2>{a.deleteTitle}</h2>
                <p className="account-wipe__text">{a.deleteText}</p>
                <p className="account-wipe__kept">{a.deleteKept}</p>
                {wipe === 'confirm' ? (
                  <>
                    <p className="account-wipe__ask" role="status">{a.deleteConfirm}</p>
                    <div className="account-actions">
                      <button type="button" className="btn btn--danger" onClick={removeAccount}>
                        {a.deleteYes}
                      </button>
                      <button type="button" className="btn btn--ghost" onClick={() => setWipe('idle')}>
                        {a.deleteNo}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="account-actions">
                    <button
                      type="button"
                      className="btn btn--outline account-wipe__start"
                      onClick={() => setWipe('confirm')}
                      disabled={wipe === 'busy'}
                    >
                      {a.deleteAction}
                    </button>
                  </div>
                )}
                {wipe === 'failed' && <p className="field__error">{a.deleteFailed}</p>}
              </section>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
