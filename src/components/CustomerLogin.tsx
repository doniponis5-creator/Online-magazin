'use client'

import { useState, type FormEvent } from 'react'
import { formatSom } from '@/lib/format'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { normalizePhone } from '@/lib/orders/order'
import type { CustomerProfile } from '@/lib/customer/gateway'

type Step = 'phone' | 'password' | 'code' | 'name' | 'setpw'

/** Столько же требует сервер (MIN_PASSWORD в gateway.ts). */
const MIN_PASSWORD = 6

/**
 * Вход покупателя: телефон → пароль (если задан) или код из WhatsApp → (новый номер) имя.
 * После входа по коду сайт предлагает задать пароль, чтобы в следующий раз кода не было.
 */
export function CustomerLogin({ onDone }: { onDone: (customer: CustomerProfile, welcomeBonus: number) => void }) {
  const { t } = useI18n()
  const a = t.account
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [normalized, setNormalized] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [ticket, setTicket] = useState('')
  const [welcome, setWelcome] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Пароль: пропуск от сервера и поля формы
  const [pwTicket, setPwTicket] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [hadPassword, setHadPassword] = useState(false)
  // Куда ушёл код — иначе человек ищет его не в том приложении
  const [channel, setChannel] = useState<'telegram' | 'whatsapp'>('whatsapp')
  // Клиент уже вошёл (cookie стоит) — отдаём его наверх, когда закончим с паролем
  const [pending, setPending] = useState<{ customer: CustomerProfile; welcomeBonus: number } | null>(null)

  const send = async (url: string, body: unknown, method: 'POST' | 'DELETE' = 'POST') => {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null)
    const data = response ? await response.json().catch(() => null) : null
    return { status: response?.status ?? 0, data }
  }

  const serverError = (status: number, data: { error?: string } | null) =>
    status >= 400 && status < 500 && data?.error && data.error.length > 8 ? data.error : a.errorServer

  /** Конец входа: отдаём покупателя в личный кабинет. */
  const finish = (result?: { customer: CustomerProfile; welcomeBonus: number } | null) => {
    const done = result ?? pending
    if (done) onDone(done.customer, done.welcomeBonus)
  }

  /** Шаг после кода: предложить пароль, а если сервер пропуска не дал — сразу в кабинет. */
  const afterCodeLogin = (customer: CustomerProfile, welcomeBonus: number, newPwTicket?: string) => {
    if (!newPwTicket) return onDone(customer, welcomeBonus)
    setPending({ customer, welcomeBonus })
    setPwTicket(newPwTicket)
    setHadPassword(Boolean(customer.hasPassword))
    setPassword('')
    setPassword2('')
    setStep('setpw')
  }

  const requestCode = async (target?: string) => {
    const value = target ?? normalized
    setBusy(true)
    setError('')
    const { status, data } = await send('/api/customer/send-code', { phone: value })
    setBusy(false)
    if (!data?.ok) return setError(status === 422 ? a.errorPhone : serverError(status, data))
    setNormalized(value)
    setChannel(data.channel === 'telegram' ? 'telegram' : 'whatsapp')
    setCode('')
    setStep('code')
  }

  /** Шаг 1: узнаём, есть ли у номера пароль. */
  const startLogin = async (e: FormEvent) => {
    e.preventDefault()
    const value = normalizePhone(phone)
    if (!value) return setError(a.errorPhone)
    setBusy(true)
    setError('')
    const { status, data } = await send('/api/customer/start', { phone: value })
    setBusy(false)
    if (!data?.ok) return setError(status === 422 ? a.errorPhone : serverError(status, data))
    setNormalized(value)
    if (data.hasPassword) {
      setPassword('')
      return setStep('password')
    }
    await requestCode(value)
  }

  const loginWithPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!password) return setError(a.errorPassword)
    setBusy(true)
    setError('')
    const { status, data } = await send('/api/customer/login', { phone: normalized, password })
    setBusy(false)
    if (!data?.ok) return setError(status === 401 ? a.errorLogin : serverError(status, data))
    onDone(data.customer, 0)
  }

  const verify = async (e: FormEvent) => {
    e.preventDefault()
    if (!/^\d{4}$/.test(code)) return setError(a.errorCode)
    setBusy(true)
    setError('')
    const { status, data } = await send('/api/customer/verify', { phone: normalized, code })
    setBusy(false)
    if (!data?.ok) return setError(status === 422 ? a.errorCode : serverError(status, data))
    if (data.needName) {
      setTicket(data.ticket)
      setWelcome(data.welcomeBonus ?? 0)
      return setStep('name')
    }
    afterCodeLogin(data.customer, 0, data.pwTicket)
  }

  const registerName = async (e: FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return setError(a.errorName)
    setBusy(true)
    setError('')
    const { status, data } = await send('/api/customer/register', { ticket, name })
    setBusy(false)
    if (!data?.ok) {
      if (status === 401) setStep('phone')
      return setError(status === 422 ? a.errorName : serverError(status, data))
    }
    afterCodeLogin(data.customer, data.welcomeBonus ?? 0, data.pwTicket)
  }

  const savePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) return setError(a.errorPassword)
    if (password !== password2) return setError(a.errorPasswordRepeat)
    setBusy(true)
    setError('')
    const { status, data } = await send('/api/customer/password', { pwTicket, password })
    setBusy(false)
    // Пропуск одноразовый: если он уже потрачен, входу это не мешает — просто идём в кабинет
    if (!data?.ok) return setError(status === 422 ? a.errorPassword : serverError(status, data))
    finish(pending && { customer: { ...pending.customer, hasPassword: true }, welcomeBonus: pending.welcomeBonus })
  }

  const removePassword = async () => {
    setBusy(true)
    setError('')
    const { status, data } = await send('/api/customer/password', { pwTicket }, 'DELETE')
    setBusy(false)
    if (!data?.ok) return setError(serverError(status, data))
    finish(pending && { customer: { ...pending.customer, hasPassword: false }, welcomeBonus: pending.welcomeBonus })
  }

  return (
    <div className="login-card">
      {step === 'phone' && (
        <form onSubmit={startLogin} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="login-phone">{a.phone}</label>
            <input
              id="login-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+996 700 000 000"
              inputMode="tel"
              autoComplete="tel"
              aria-invalid={Boolean(error)}
            />
          </div>
          <button type="submit" className="btn btn--primary btn--block" disabled={busy} aria-busy={busy}>
            {busy ? a.sending : a.continueBtn}
          </button>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={loginWithPassword} noValidate>
          <p className="login-card__hint">
            <strong>{normalized}</strong>
          </p>
          <div className="field">
            <label className="field__label" htmlFor="login-password">{a.password}</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              aria-invalid={Boolean(error)}
            />
          </div>
          <button type="submit" className="btn btn--primary btn--block" disabled={busy} aria-busy={busy}>
            {busy ? a.checking : a.verify}
          </button>
          <div className="login-card__links">
            <button type="button" className="link-btn" onClick={() => { setStep('phone'); setError('') }}>
              {a.changePhone}
            </button>
            <button type="button" className="link-btn" onClick={() => requestCode()} disabled={busy}>
              {a.loginByCode}
            </button>
          </div>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={verify} noValidate>
          <p className="login-card__hint">
            {channel === 'telegram' ? a.codeSentTelegram : a.codeSent} <strong>{normalized}</strong>
          </p>
          <div className="field">
            <label className="field__label" htmlFor="login-code">
              {channel === 'telegram' ? a.codeTelegram : a.code}
            </label>
            <input
              id="login-code"
              className="login-card__code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="• • • •"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              aria-invalid={Boolean(error)}
            />
          </div>
          <button type="submit" className="btn btn--primary btn--block" disabled={busy} aria-busy={busy}>
            {busy ? a.checking : a.verify}
          </button>
          <div className="login-card__links">
            <button type="button" className="link-btn" onClick={() => { setStep('phone'); setError('') }}>
              {a.changePhone}
            </button>
            <button type="button" className="link-btn" onClick={() => requestCode()} disabled={busy}>
              {a.resend}
            </button>
          </div>
        </form>
      )}

      {step === 'name' && (
        <form onSubmit={registerName} noValidate>
          <h3 className="login-card__title">{a.nameTitle}</h3>
          <p className="login-card__hint">{a.nameText}</p>
          {welcome > 0 && (
            <p className="login-card__welcome">🎁 {a.welcomePromo.replace('{amount}', formatSom(welcome))}</p>
          )}
          <div className="field">
            <label className="field__label" htmlFor="login-name">{a.name}</label>
            <input
              id="login-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              autoFocus
              aria-invalid={Boolean(error)}
            />
          </div>
          <button type="submit" className="btn btn--primary btn--block" disabled={busy} aria-busy={busy}>
            {busy ? a.checking : a.register}
          </button>
        </form>
      )}

      {step === 'setpw' && (
        <form onSubmit={savePassword} noValidate>
          <h3 className="login-card__title">{hadPassword ? a.pwChangeTitle : a.pwOfferTitle}</h3>
          <p className="login-card__hint">{hadPassword ? a.pwChangeText : a.pwOfferText}</p>
          <div className="field">
            <label className="field__label" htmlFor="login-newpw">{a.password}</label>
            <input
              id="login-newpw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
              aria-invalid={Boolean(error)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="login-newpw2">{a.passwordRepeat}</label>
            <input
              id="login-newpw2"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
              aria-invalid={Boolean(error)}
            />
          </div>
          <button type="submit" className="btn btn--primary btn--block" disabled={busy} aria-busy={busy}>
            {busy ? a.checking : a.pwSave}
          </button>
          <div className="login-card__links">
            <button type="button" className="link-btn" onClick={() => finish()} disabled={busy}>
              {a.pwSkip}
            </button>
            {hadPassword && (
              <button type="button" className="link-btn" onClick={removePassword} disabled={busy}>
                {a.pwDrop}
              </button>
            )}
          </div>
        </form>
      )}

      {error && <p role="alert" className="field__error">{error}</p>}
    </div>
  )
}
