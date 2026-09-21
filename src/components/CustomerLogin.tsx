'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { formatSom } from '@/lib/format'
import { IconGift, IconTelegram, IconWhatsApp } from '@/components/Icons'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { normalizePhone } from '@/lib/orders/order'
import type { CustomerProfile } from '@/lib/customer/gateway'

type Step = 'phone' | 'code' | 'name' | 'wa'

/**
 * Вход без пароля.
 *
 * Главный путь — WhatsApp «наоборот»: сайт открывает wa.me с готовым
 * сообщением «Код входа: 482913», покупатель отправляет его магазину, сайт
 * ждёт и входит сам. Магазин ничего не шлёт — Green API нечего блокировать,
 * а номер подтверждён самим WhatsApp.
 *
 * Запасной путь — код: телефон → код в Telegram (если Telegram нет — в
 * WhatsApp) → (новый номер) имя.
 */
const WA_POLL_MS = 3000
const WA_WAIT_MS = 5 * 60_000
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
  const [wa, setWa] = useState<{ code: string; waPhone: string; startedAt: number } | null>(null)
  // Код в Telegram — запасной путь: форма свёрнута, пока не попросят.
  const [showCode, setShowCode] = useState(false)
  const waTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const waStart = async () => {
    setBusy(true)
    setError('')
    const { status, data } = await post('/api/customer/wa-login/start', {})
    setBusy(false)
    if (!data?.ok) return setError(serverError(status, data))
    setWa({ code: data.code, waPhone: data.waPhone, startedAt: Date.now() })
    setStep('wa')
  }

  const waStop = () => {
    if (waTimer.current) clearTimeout(waTimer.current)
    waTimer.current = null
  }

  // Пока открыт экран WhatsApp — спрашиваем сервер, пришло ли сообщение.
  useEffect(() => {
    if (step !== 'wa' || !wa) return
    let stopped = false
    const tick = async () => {
      if (stopped) return
      if (Date.now() - wa.startedAt > WA_WAIT_MS) {
        setError(a.waExpired)
        setStep('phone')
        return
      }
      const { status, data } = await post('/api/customer/wa-login/check', { code: wa.code })
      if (stopped) return
      if (data?.ok && !data.pending) {
        if (data.needName) {
          setTicket(data.ticket)
          setWelcome(data.welcomeBonus ?? 0)
          setStep('name')
        } else {
          onDone(data.customer, 0)
        }
        return
      }
      if (!data?.ok && status !== 0 && status !== 502) {
        setError(status === 410 ? a.waExpired : serverError(status, data))
        setStep('phone')
        return
      }
      waTimer.current = setTimeout(tick, WA_POLL_MS)
    }
    waTimer.current = setTimeout(tick, WA_POLL_MS)
    return () => {
      stopped = true
      waStop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, wa])

  const waMessage = wa ? a.waMessage.replace('{code}', wa.code) : ''
  const waHref = wa ? `https://wa.me/${wa.waPhone}?text=${encodeURIComponent(waMessage)}` : '#'

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
          <button type="button" className="btn btn--block login-card__wa" onClick={() => void waStart()} disabled={busy} aria-busy={busy}>
            <IconWhatsApp size={22} />
            {a.waLogin}
          </button>
          <p className="login-card__hint">{a.waHint}</p>
          {!showCode && (
            <button type="button" className="link-btn login-card__other" onClick={() => setShowCode(true)}>
              {a.waOther}
            </button>
          )}
          {showCode && <p className="login-card__or">{a.waOther}</p>}
          {showCode && (
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
          )}
          {showCode && (
          <button type="submit" className="btn btn--primary btn--block" disabled={busy} aria-busy={busy}>
            {busy ? a.sending : a.sendCode}
          </button>
          )}
        </form>
      )}

      {step === 'wa' && wa && (
        <div className="login-card__wa-step">
          <h3 className="login-card__title">{a.waTitle}</h3>
          <p className="login-card__hint">{a.waText}</p>
          <a className="btn btn--block login-card__wa" href={waHref} target="_blank" rel="noopener">
            <IconWhatsApp size={22} />
            {a.waOpen}
          </a>
          <p className="login-card__wait" aria-live="polite">
            <span className="login-card__spinner" aria-hidden="true" />
            <span>{a.waWaiting}</span>
          </p>
          <p className="login-card__manual">
            {a.waManual} +{wa.waPhone}
            <br />
            <code>{waMessage}</code>
          </p>
          <div className="login-card__links">
            <button type="button" className="link-btn" onClick={() => { waStop(); setWa(null); setStep('phone'); setError('') }}>
              {a.waBack}
            </button>
          </div>
        </div>
      )}

      {step === 'code' && (
        <form onSubmit={verify} noValidate>
          <p className="login-card__hint login-card__channel">
            {channel === 'telegram' && <IconTelegram size={20} />}
            <span>
              {channel === 'telegram' ? a.codeSentTelegram : a.codeSent} <strong>{normalized}</strong>
            </span>
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
            <p className="login-card__welcome"><IconGift size={22} className="login-card__welcome-icon" />{a.welcomePromo.replace('{amount}', formatSom(welcome))}</p>
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
