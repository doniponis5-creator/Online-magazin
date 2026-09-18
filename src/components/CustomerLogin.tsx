'use client'

import { useState, type FormEvent } from 'react'
import { formatSom } from '@/lib/format'
import { IconTelegram, IconWhatsApp } from '@/components/Icons'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { normalizePhone } from '@/lib/orders/order'
import type { CustomerProfile } from '@/lib/customer/gateway'

type Step = 'phone' | 'code' | 'name'

/**
 * Вход без пароля: телефон → код → (новый номер) имя.
 * Код приходит в Telegram; если Telegram на этом номере нет — в WhatsApp.
 * Экран кода подписан по месту, чтобы человек не искал код не в том приложении.
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
  const [channel, setChannel] = useState<'telegram' | 'whatsapp'>('telegram')

  const post = async (url: string, body: unknown) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null)
    const data = response ? await response.json().catch(() => null) : null
    return { status: response?.status ?? 0, data }
  }

  const serverError = (status: number, data: { error?: string } | null) =>
    status >= 400 && status < 500 && data?.error && data.error.length > 8 ? data.error : a.errorServer

  const requestCode = async (e?: FormEvent) => {
    e?.preventDefault()
    const value = normalizePhone(phone) || normalized
    if (!value) return setError(a.errorPhone)
    setBusy(true)
    setError('')
    const { status, data } = await post('/api/customer/send-code', { phone: value })
    setBusy(false)
    if (!data?.ok) return setError(status === 422 ? a.errorPhone : serverError(status, data))
    setNormalized(value)
    setChannel(data.channel === 'whatsapp' ? 'whatsapp' : 'telegram')
    setCode('')
    setStep('code')
  }

  const verify = async (e: FormEvent) => {
    e.preventDefault()
    if (!/^\d{4}$/.test(code)) return setError(a.errorCode)
    setBusy(true)
    setError('')
    const { status, data } = await post('/api/customer/verify', { phone: normalized, code })
    setBusy(false)
    if (!data?.ok) return setError(status === 422 ? a.errorCode : serverError(status, data))
    if (data.needName) {
      setTicket(data.ticket)
      setWelcome(data.welcomeBonus ?? 0)
      setStep('name')
    } else {
      onDone(data.customer, 0)
    }
  }

  const registerName = async (e: FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return setError(a.errorName)
    setBusy(true)
    setError('')
    const { status, data } = await post('/api/customer/register', { ticket, name })
    setBusy(false)
    if (!data?.ok) {
      if (status === 401) setStep('phone')
      return setError(status === 422 ? a.errorName : serverError(status, data))
    }
    onDone(data.customer, data.welcomeBonus ?? 0)
  }

  return (
    <div className="login-card">
      {step === 'phone' && (
        <form onSubmit={requestCode} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="login-phone">{a.phone}</label>
            <input
              id="login-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+996 700 000 000"
              inputMode="tel"
              autoComplete="tel"
              aria-describedby="login-phone-hint"
              aria-invalid={Boolean(error)}
            />
            <p className="field__hint login-card__channel" id="login-phone-hint">
              <IconTelegram size={18} />
              <span>{a.phoneHint}</span>
            </p>
          </div>
          <button type="submit" className="btn btn--primary btn--block" disabled={busy} aria-busy={busy}>
            {busy ? a.sending : a.sendCode}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={verify} noValidate>
          <p className="login-card__hint login-card__channel">
            {channel === 'whatsapp' ? <IconWhatsApp size={20} /> : <IconTelegram size={20} />}
            <span>
              {channel === 'whatsapp' ? a.codeSent : a.codeSentTelegram} <strong>{normalized}</strong>
            </span>
          </p>
          <div className="field">
            <label className="field__label" htmlFor="login-code">
              {channel === 'whatsapp' ? a.code : a.codeTelegram}
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

      {error && <p role="alert" className="field__error">{error}</p>}
    </div>
  )
}
