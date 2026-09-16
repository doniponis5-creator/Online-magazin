'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useCart } from '@/lib/cart/CartProvider'
import { unitPrice } from '@/lib/cart/logic'
import { getProduct } from '@/data/products'
import { variantLabel } from '@/lib/cart/sku'
import { formatSom } from '@/lib/format'
import { useI18n } from '@/lib/i18n/I18nProvider'

type Delivery = 'pickup' | 'taxi'

/** Демо-проверка телефона: +996 XXX XXX XXX (пробелы и скобки игнорируются) */
function isValidPhone(value: string): boolean {
  const digits = value.replace(/[\s()-]/g, '')
  return /^\+996\d{9}$/.test(digits)
}

export default function CheckoutPage() {
  const { t, lang } = useI18n()
  const cart = useCart()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [delivery, setDelivery] = useState<Delivery>('pickup')
  const [region, setRegion] = useState('')
  const [address, setAddress] = useState('')
  const [comment, setComment] = useState('')
  const [errors, setErrors] = useState<{
    name?: string
    phone?: string
    region?: string
    address?: string
    cart?: string
  }>({})
  const [orderNumber, setOrderNumber] = useState<string | null>(null)

  const resultTitle = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const first = ['name', 'phone', 'region', 'address'].find(key => errors[key as keyof typeof errors])
    if (first) {
      const field = document.getElementById(`co-${first}`)
      field?.focus({ preventScroll: true })
      field?.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
  }, [errors])
  useEffect(() => {
    if (orderNumber) resultTitle.current?.focus()
  }, [orderNumber])

  // До восстановления корзины не показываем ни форму, ни ложное «пусто».
  if (!cart.hydrated) {
    return (
      <div className="container">
        <div className="page-head">
          <h1 className="page-head__title">{t.checkout.title}</h1>
        </div>
      </div>
    )
  }

  if (orderNumber !== null) {
    return (
      <div className="container">
        <div className="demo-result">
          <div className="demo-result__card">
            <span className="demo-result__ok">✓</span>
            <h1 ref={resultTitle} tabIndex={-1} className="demo-result__title">{t.demoOrder.title}</h1>
            <span className="demo-result__number">
              {t.demoOrder.orderLabel}: DEMO-{orderNumber}
            </span>
            <h2 className="details-card__title" style={{ marginBottom: 0 }}>
              {t.demoOrder.nightTitle}
            </h2>
            <ol className="demo-result__steps">
              {t.demoOrder.nightSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="demo-result__warning">{t.demoOrder.warning}</p>
            <div className="demo-result__actions">
              <Link href={`/${lang}`} className="btn btn--primary">
                {t.demoOrder.backHome}
              </Link>
              <Link href={`/${lang}/catalog`} className="btn btn--outline">
                {t.demoOrder.toCatalog}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (name.trim().length < 2) next.name = t.checkout.errorName
    if (!isValidPhone(phone)) next.phone = t.checkout.errorPhone
    if (delivery === 'taxi' && region.trim().length < 2) next.region = t.checkout.errorRegion
    if (delivery === 'taxi' && address.trim().length < 4) next.address = t.checkout.errorAddress
    if (cart.lines.length === 0) next.cart = t.checkout.errorCart
    setErrors(next)
    if (Object.keys(next).length > 0) return

    // Локальная демо-заявка: ничего не отправляется и не сохраняется,
    // номер генерируется в браузере. Персональные данные в localStorage не пишем.
    setOrderNumber(String(Math.floor(1000 + Math.random() * 9000)))
  }

  if (cart.hydrated && cart.lines.length === 0) {
    return (
      <div className="container">
        <div className="page-head">
          <h1 className="page-head__title">{t.checkout.title}</h1>
        </div>
        <div className="empty">
          <div className="empty__title">{t.cart.empty}</div>
          <p className="empty__hint">{t.checkout.errorCart}</p>
          <Link href={`/${lang}/catalog`} className="btn btn--primary empty__cta">
            {t.cart.toCatalog}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="page-head">
        <h1 className="page-head__title">{t.checkout.title}</h1>
        <p className="page-head__sub">{t.checkout.demoNote}</p>
      </div>

      <form className="checkout-layout" onSubmit={submit} noValidate>
        <div className="form-card">
          {Object.keys(errors).length > 0 && <p role="alert" className="field__error">
            {lang === 'ky' ? 'Белгиленген талааларды текшериңиз.' : 'Проверьте отмеченные поля.'}
          </p>}
          <section aria-labelledby="contact-title">
            <h2 className="form-section__title" id="contact-title">
              {t.checkout.contact}
            </h2>
            <div className="form-grid-2">
              <div className="field">
                <label className="field__label" htmlFor="co-name">
                  {t.checkout.name} <span aria-hidden="true">*</span>
                </label>
                <input
                  id="co-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.checkout.namePlaceholder}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? 'co-name-error' : undefined}
                  autoComplete="name"
                  style={errors.name ? { borderColor: 'var(--color-danger)' } : undefined}
                />
                {errors.name && <span id="co-name-error" className="field__error">{errors.name}</span>}
              </div>
              <div className="field">
                <label className="field__label" htmlFor="co-phone">
                  {t.checkout.phone} <span aria-hidden="true">*</span>
                </label>
                <input
                  id="co-phone"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t.checkout.phonePlaceholder}
                  inputMode="tel"
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? 'co-phone-error' : 'co-phone-hint'}
                  autoComplete="tel"
                />
                {errors.phone ? (
                  <span id="co-phone-error" className="field__error">{errors.phone}</span>
                ) : (
                  <span id="co-phone-hint" className="field__hint">{t.checkout.phoneHint}</span>
                )}
              </div>
            </div>
          </section>

          <section aria-labelledby="delivery-title">
            <h2 className="form-section__title" id="delivery-title">
              {t.checkout.delivery}
            </h2>
            <div className="radio-cards">
              <label className={`radio-card${delivery === 'pickup' ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="delivery"
                  value="pickup"
                  checked={delivery === 'pickup'}
                  onChange={() => setDelivery('pickup')}
                />
                <span>
                  <span className="radio-card__title">{t.checkout.pickup}</span>
                  <span className="radio-card__note" style={{ display: 'block' }}>
                    {t.checkout.pickupNote}
                  </span>
                </span>
              </label>
              <label className={`radio-card${delivery === 'taxi' ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="delivery"
                  value="taxi"
                  checked={delivery === 'taxi'}
                  onChange={() => setDelivery('taxi')}
                />
                <span>
                  <span className="radio-card__title">{t.checkout.taxi}</span>
                  <span className="radio-card__note" style={{ display: 'block' }}>
                    {t.checkout.taxiNote}
                  </span>
                </span>
              </label>
            </div>
          </section>

          {delivery === 'taxi' && (
              <div className="form-grid-2">
                <div className="field">
                  <label className="field__label" htmlFor="co-region">
                    {t.checkout.region} <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="co-region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder={t.city}
                    aria-invalid={Boolean(errors.region)}
                  aria-describedby={errors.region ? 'co-region-error' : undefined}
                    required
                  />
                  {errors.region && <span id="co-region-error" className="field__error">{errors.region}</span>}
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="co-address">
                    {t.checkout.address} <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="co-address"
                  required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t.checkout.addressPlaceholder}
                    aria-invalid={Boolean(errors.address)}
                  aria-describedby={errors.address ? 'co-address-error' : undefined}
                  />
                  {errors.address && <span id="co-address-error" className="field__error">{errors.address}</span>}
                </div>
              </div>
            )}

          <div className="field">
            <label className="field__label" htmlFor="co-comment">
              {t.checkout.comment}
            </label>
            <textarea
              id="co-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t.checkout.commentPlaceholder}
            />
          </div>
        </div>

        <aside className="summary-card">
          <h2 className="form-section__title">{t.checkout.summary}</h2>
          <div className="order-rows">
            {cart.lines.map((line) => {
              const product = getProduct(line.productId)
              if (!product) return null
              const variant = product.variants.find((v) => v.id === line.variantId)
              if (!variant) return null
              const price = unitPrice(product, line.variantId) ?? product.price
              return (
                <div className="order-row" key={`${line.productId}:${line.variantId}`}>
                  <span>
                    {lang === 'ky' ? product.nameKy : product.nameRu} × {line.qty}
                    {variantLabel(product, variant, lang) && (
                      <span style={{ color: 'var(--color-muted)' }}>
                        {' '}
                        ({variantLabel(product, variant, lang)})
                      </span>
                    )}
                  </span>
                  <strong>{formatSom(price * line.qty)}</strong>
                </div>
              )
            })}
          </div>
          <div className="summary-card__total">
            <span>{t.cart.total}</span>
            <span>{formatSom(cart.subtotal)}</span>
          </div>
          <p className="summary-card__note">{t.cart.totalNote}</p>
          <p className="summary-card__note">{t.checkout.sbonusNote}</p>
          {errors.cart && <span className="field__error">{errors.cart}</span>}
          <button type="submit" className="btn btn--primary btn--block">
            {t.checkout.submit}
          </button>
        </aside>
      </form>
    </div>
  )
}
