'use client'

import { useState, type FormEvent } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'

/**
 * Демо-состояние рассрочки: различаем нового клиента и существующего
 * клиента SBonus. Реальных решений о кредите нет; заявка никуда
 * не отправляется и персональные данные не сохраняются.
 */
export function InstallmentDemo() {
  const { t } = useI18n()
  const [customerType, setCustomerType] = useState<'new' | 'existing'>('new')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const valid = name.trim().length >= 2 && /^\+996\d{9}$/.test(phone.replace(/[\s()-]/g, ''))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setSubmitted(true)
  }

  return (
    <div className="install-demo">
      <fieldset className="install-demo__types">
        <legend className="option-group__label">{t.installmentDemo.customerType}</legend>
        <div className="swatch-row" role="radiogroup" aria-label={t.installmentDemo.customerType}>
          <button
            type="button"
            role="radio"
            aria-checked={customerType === 'new'}
            className="swatch"
            onClick={() => {
              setCustomerType('new')
              setSubmitted(false)
            }}
          >
            {t.installmentDemo.newClient}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={customerType === 'existing'}
            className="swatch"
            onClick={() => {
              setCustomerType('existing')
              setSubmitted(false)
            }}
          >
            {t.installmentDemo.existing}
          </button>
        </div>
      </fieldset>

      {customerType === 'new' ? (
        <p className="promo__note">{t.installmentDemo.newNote}</p>
      ) : submitted ? (
        <p className="promo__note" role="status">
          <strong>{t.demoOrder.title}.</strong> {t.installmentDemo.resultNote}
        </p>
      ) : (
        <form className="install-demo__form" onSubmit={onSubmit} noValidate>
          <span className="install-demo__form-title">{t.installmentDemo.formTitle}</span>
          <p className="promo__note">{t.installmentDemo.existingNote}</p>
          <div className="form-grid-2">
            <label className="field">
              <span className="field__label">{t.checkout.name}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.checkout.namePlaceholder}
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span className="field__label">{t.checkout.phone}</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t.checkout.phonePlaceholder}
                inputMode="tel"
                autoComplete="off"
              />
            </label>
          </div>
          <button type="submit" className="btn btn--primary" disabled={!valid}>
            {t.checkout.submit}
          </button>
          <span className="demo-strip">{t.installmentDemo.resultNote}</span>
        </form>
      )}
    </div>
  )
}
