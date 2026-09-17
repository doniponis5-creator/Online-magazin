'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useCustomer } from '@/components/AccountView'
import { CustomerLogin } from '@/components/CustomerLogin'
import '@/components/account.css'
import { useCart } from '@/lib/cart/CartProvider'
import { unitPrice } from '@/lib/cart/logic'
import { getProduct, type Product } from '@/data/products'
import { variantLabel } from '@/lib/cart/sku'
import { formatSom } from '@/lib/format'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { deliveryPriceFor, normalizePhone, type DeliveryMethod, type OrderError } from '@/lib/orders/order'
import { LAST_ORDER_KEY } from '@/lib/orders/storage'

type FieldErrors = { name?: string; phone?: string; region?: string; address?: string; form?: string }

export default function CheckoutPage() {
  const { t, lang } = useI18n()
  const cart = useCart()
  const router = useRouter()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [delivery, setDelivery] = useState<DeliveryMethod>('pickup')
  const [region, setRegion] = useState('')
  const [address, setAddress] = useState('')
  const [comment, setComment] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const first = (['name', 'phone', 'region', 'address'] as const).find((key) => errors[key])
    if (first) {
      const field = document.getElementById(`co-${first}`)
      field?.focus({ preventScroll: true })
      field?.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
  }, [errors])

  const products = useMemo(
    () => cart.lines.map((l) => getProduct(l.productId)).filter((p): p is Product => Boolean(p)),
    [cart.lines],
  )
  const courierPrice = deliveryPriceFor(products, 'delivery')
  const deliveryCost = delivery === 'delivery' ? courierPrice : 0
  const total = cart.subtotal + deliveryCost

  // Покупатель входит по коду WhatsApp; телефон берётся из входа, бонусы — с его счёта SBonus.
  const { customer, reload: reloadCustomer, logout } = useCustomer(total)
  const [useBonus, setUseBonus] = useState(false)
  const [bonusInput, setBonusInput] = useState('')
  const maxBonus = customer?.maxSpend ?? 0
  const bonus = useBonus ? Math.max(0, Math.min(maxBonus, Math.floor(Number(bonusInput) || 0))) : 0
  const payTotal = total - bonus

  useEffect(() => {
    if (customer && !name) setName(customer.name)
    if (customer) setPhone(customer.phone)
  }, [customer]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!cart.hydrated) {
    return (
      <div className="container">
        <div className="page-head">
          <h1 className="page-head__title">{t.checkout.title}</h1>
        </div>
      </div>
    )
  }

  if (cart.lines.length === 0) {
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

  const serverErrorText = (codes: OrderError[] | string[]): FieldErrors => {
    const next: FieldErrors = {}
    for (const code of codes) {
      if (code === 'name') next.name = t.checkout.errorName
      else if (code === 'phone') next.phone = t.checkout.errorPhone
      else if (code === 'city') next.region = t.checkout.errorRegion
      else if (code === 'address') next.address = t.checkout.errorAddress
      else if (code === 'price-missing') next.form = t.checkout.errorPrice
      else if (code === 'out-of-stock') next.form = t.checkout.errorStock
      else if (code === 'product-missing') next.form = t.checkout.errorProduct
      else if (code === 'cart-empty') next.form = t.checkout.errorCart
      else if (code === 'login') next.form = t.checkout.errorLogin
      else if (code === 'bonus') next.form = t.checkout.errorBonus
      else next.form = t.checkout.errorServer
    }
    return next
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (sending) return
    if (!customer) {
      setErrors({ form: t.checkout.errorLogin })
      return
    }
    const next: FieldErrors = {}
    if (name.trim().length < 2) next.name = t.checkout.errorName
    if (!normalizePhone(phone)) next.phone = t.checkout.errorPhone
    if (delivery === 'delivery' && region.trim().length < 2) next.region = t.checkout.errorRegion
    if (delivery === 'delivery' && address.trim().length < 4) next.address = t.checkout.errorAddress
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSending(true)
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name, phone },
          delivery: { method: delivery, city: region, address },
          comment,
          lines: cart.lines,
          bonus,
          lang,
        }),
      })
      const data = await response.json().catch(() => ({ ok: false, errors: ['server'] }))
      if (!data.ok) {
        setErrors(serverErrorText(data.errors ?? ['server']))
        if (data.errors?.includes('login') || data.errors?.includes('bonus')) reloadCustomer()
        setSending(false)
        return
      }
      try {
        localStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ orderId: data.orderId, token: data.token }))
      } catch {
        // без localStorage покупатель вернётся к заказу по ссылке из WhatsApp
      }
      cart.clear()
      const orderPage = `/${lang}/order/${encodeURIComponent(data.orderId)}?token=${data.token}`
      if (data.mock || !/^https?:\/\//.test(data.payUrl)) router.push(orderPage)
      else window.location.assign(data.payUrl)
    } catch {
      setErrors({ form: t.checkout.errorServer })
      setSending(false)
    }
  }

  return (
    <div className="container">
      <div className="page-head">
        <h1 className="page-head__title">{t.checkout.title}</h1>
        <p className="page-head__sub">{t.checkout.subtitle}</p>
      </div>

      {customer === null && (
        <section className="form-card checkout-login" aria-labelledby="login-title">
          <h2 className="form-section__title" id="login-title">{t.checkout.loginTitle}</h2>
          <p>{t.checkout.loginText}</p>
          <CustomerLogin onDone={() => reloadCustomer()} />
        </section>
      )}

      <form className="checkout-layout" onSubmit={submit} noValidate>
        <div className="form-card">
          <section aria-labelledby="contact-title">
            <h2 className="form-section__title" id="contact-title">
              {t.checkout.contact}
            </h2>
            {customer === null ? (
              <p className="field__hint">{t.checkout.errorLogin}</p>
            ) : customer ? (
            <>
            <div className="checkout-user">
              <span>
                {t.checkout.loggedAs} <strong>{customer.phone}</strong>
              </span>
              <button type="button" className="link-btn" onClick={logout}>
                {t.checkout.notYou}
              </button>
            </div>
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
                  readOnly
                  value={phone}
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
            </>
            ) : null}
          </section>

          <section aria-labelledby="delivery-title">
            <h2 className="form-section__title" id="delivery-title">
              {t.checkout.delivery}
            </h2>
            <div className="radio-cards">
              <label className={`radio-card${delivery === 'pickup' ? ' is-selected' : ''}`}>
                <input type="radio" name="delivery" value="pickup" checked={delivery === 'pickup'} onChange={() => setDelivery('pickup')} />
                <span>
                  <span className="radio-card__title">{t.checkout.pickup}</span>
                  <span className="radio-card__note" style={{ display: 'block' }}>{t.checkout.pickupNote}</span>
                </span>
              </label>
              <label className={`radio-card${delivery === 'delivery' ? ' is-selected' : ''}`}>
                <input type="radio" name="delivery" value="delivery" checked={delivery === 'delivery'} onChange={() => setDelivery('delivery')} />
                <span>
                  <span className="radio-card__title">
                    {t.checkout.courier} · {courierPrice > 0 ? formatSom(courierPrice) : t.checkout.courierFree}
                  </span>
                  <span className="radio-card__note" style={{ display: 'block' }}>{t.checkout.courierNote}</span>
                </span>
              </label>
            </div>
          </section>

          {delivery === 'delivery' && (
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
                  autoComplete="address-level2"
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
                  autoComplete="street-address"
                />
                {errors.address && <span id="co-address-error" className="field__error">{errors.address}</span>}
              </div>
            </div>
          )}

          <div className="field">
            <label className="field__label" htmlFor="co-comment">
              {t.checkout.comment}
            </label>
            <textarea id="co-comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t.checkout.commentPlaceholder} />
          </div>
        </div>

        <aside className="summary-card">
          <h2 className="form-section__title">{t.checkout.summary}</h2>
          <div className="order-rows">
            {cart.lines.map((line) => {
              const product = getProduct(line.productId)
              const variant = product?.variants.find((v) => v.id === line.variantId)
              if (!product || !variant) return null
              const price = unitPrice(product, line.variantId) ?? product.price
              const label = variantLabel(product, variant, lang)
              return (
                <div className="order-row" key={`${line.productId}:${line.variantId}`}>
                  <span>
                    {lang === 'ky' ? product.nameKy : product.nameRu} × {line.qty}
                    {label && <span style={{ color: 'var(--color-muted)' }}> ({label})</span>}
                  </span>
                  <strong>{formatSom(price * line.qty)}</strong>
                </div>
              )
            })}
          </div>
          <div className="order-row">
            <span>{t.checkout.goods}</span>
            <strong>{formatSom(cart.subtotal)}</strong>
          </div>
          <div className="order-row">
            <span>{t.checkout.deliveryCost}</span>
            <strong>{deliveryCost > 0 ? formatSom(deliveryCost) : t.checkout.courierFree}</strong>
          </div>
          {customer && (
            <div className="checkout-bonus">
              <div className="checkout-bonus__head">
                <span>{t.checkout.bonusTitle}</span>
                <span>{formatSom(customer.balance)}</span>
              </div>
              {maxBonus > 0 ? (
                <>
                  <p>{t.checkout.bonusMax.replace('{max}', formatSom(maxBonus)).replace('{pct}', String(customer.maxSpendPct))}</p>
                  <div className="checkout-bonus__row">
                    <label>
                      <input
                        type="checkbox"
                        checked={useBonus}
                        onChange={(e) => {
                          setUseBonus(e.target.checked)
                          if (e.target.checked && !bonusInput) setBonusInput(String(maxBonus))
                        }}
                      />
                      {t.checkout.bonusUse}
                    </label>
                    {useBonus && (
                      <input
                        type="number"
                        min={1}
                        max={maxBonus}
                        step={1}
                        value={bonusInput}
                        onChange={(e) => setBonusInput(e.target.value)}
                        aria-label={t.checkout.bonusUse}
                      />
                    )}
                  </div>
                </>
              ) : (
                <p>{customer.balance > 0 ? t.checkout.bonusBalance.replace('{balance}', formatSom(customer.balance)) : t.checkout.bonusNone}</p>
              )}
            </div>
          )}
          {bonus > 0 && (
            <div className="order-row order-row--bonus">
              <span>{t.checkout.bonusLine}</span>
              <strong>−{formatSom(bonus)}</strong>
            </div>
          )}
          <div className="summary-card__total">
            <span>{t.checkout.total}</span>
            <span>{formatSom(payTotal)}</span>
          </div>
          {errors.form && <p role="alert" className="field__error">{errors.form}</p>}
          <button type="submit" className="btn btn--primary btn--block checkout-pay" disabled={sending || !customer} aria-busy={sending}>
            {sending ? t.checkout.paying : `${t.checkout.pay} ${formatSom(payTotal)} ${t.checkout.payVia}`}
          </button>
          <p className="summary-card__note">{t.checkout.payNote}</p>
        </aside>
      </form>
    </div>
  )
}
