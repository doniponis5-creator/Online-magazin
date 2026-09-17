'use client'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { formatSom } from '@/lib/format'
import { useI18n } from '@/lib/i18n/I18nProvider'
import type { PublicOrder } from '@/lib/orders/gateway'
import { readLastOrder } from '@/lib/orders/storage'
import '@/components/account.css'

const POLL_MS = 5000

function OrderView() {
  const { t, lang } = useI18n()
  const params = useParams<{ id: string }>()
  const search = useSearchParams()
  const orderId = decodeURIComponent(params.id)
  // токен из ссылки; если его нет (вернулись со страницы O!Деньги) — из последнего заказа в браузере
  const [token, setToken] = useState(search.get('token') ?? '')
  const [order, setOrder] = useState<PublicOrder | null>(null)
  const [missing, setMissing] = useState(false)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    if (token) return
    const last = readLastOrder()
    if (last?.orderId === orderId) setToken(last.token)
    else setMissing(true)
  }, [orderId, token])

  const load = useCallback(async () => {
    if (!token) return
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
    }).catch(() => null)
    if (!response) return
    if (response.status === 404) {
      setMissing(true)
      return
    }
    const data = await response.json().catch(() => null)
    if (data?.ok) setOrder(data.order)
  }, [orderId, token])

  const status = order?.status
  useEffect(() => {
    load()
    // после приёма в 1С или отмены опрашивать больше не нужно
    if (status === 'in_1c' || status === 'cancelled' || status === 'failed') return
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [load, status])

  const mockPay = async () => {
    setPaying(true)
    await fetch(`/api/orders/${encodeURIComponent(orderId)}/mock-pay?token=${encodeURIComponent(token)}`, { method: 'POST' })
    await load()
    setPaying(false)
  }

  if (missing) {
    return (
      <div className="empty">
        <div className="empty__title">{t.order.notFound}</div>
        <p className="empty__hint">{t.order.notFoundHint}</p>
        <Link href={`/${lang}/catalog`} className="btn btn--primary empty__cta">
          {t.order.toCatalog}
        </Link>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="page-head">
        <h1 className="page-head__title">
          {t.order.title} {orderId}
        </h1>
      </div>
    )
  }

  const paid = order.status === 'paid' || order.status === 'in_1c'
  const bonusSpend = order.bonusSpend ?? 0
  const payAmount = order.payAmount ?? order.total
  const isTest = orderId.startsWith('TEST-')

  return (
    <div className="order-page">
      <div className="page-head">
        <h1 className="page-head__title">
          {t.order.title} {order.orderId}
        </h1>
        <p className={`order-status order-status--${order.status}`} role="status" aria-live="polite">
          <span className="order-status__dot" aria-hidden="true" />
          {t.order[order.status]}
        </p>
      </div>

      <div className="checkout-layout">
        <div className="form-card">
          {paid ? (
            <p className="order-page__note">{t.order.paidNote}</p>
          ) : order.status === 'awaiting_payment' ? (
            <>
              <p className="order-page__note">{t.order.waitNote}</p>
              <div className="order-page__actions">
                {order.payUrl && (
                  <a href={order.payUrl} className="btn btn--primary">
                    {t.order.payNow} {formatSom(payAmount)}
                  </a>
                )}
                {isTest && (
                  <button type="button" className="btn btn--primary" onClick={mockPay} disabled={paying}>
                    {t.order.mockPay} {formatSom(payAmount)}
                  </button>
                )}
              </div>
              {isTest && <p className="summary-card__note">{t.checkout.testMode}</p>}
            </>
          ) : null}
          {order.number1c && (
            <p className="order-page__note">
              {t.order.number1c}: <strong>{order.number1c}</strong>
            </p>
          )}
          <div className="order-page__actions">
            <Link href={`/${lang}/catalog`} className="btn btn--outline">
              {t.order.toCatalog}
            </Link>
            <Link href={`/${lang}`} className="btn btn--ghost">
              {t.order.toHome}
            </Link>
          </div>
        </div>

        <aside className="summary-card">
          <h2 className="form-section__title">{t.checkout.summary}</h2>
          <div className="order-rows">
            {order.lines.map((line, i) => (
              <div className="order-row" key={`${line.name}-${i}`}>
                <span>
                  {line.name} × {line.qty}
                </span>
                <strong>{formatSom(line.sum)}</strong>
              </div>
            ))}
          </div>
          <div className="order-row">
            <span>{order.deliveryMethod === 'delivery' ? t.checkout.courier : t.checkout.pickup}</span>
            <strong>{order.deliveryPrice > 0 ? formatSom(order.deliveryPrice) : t.checkout.courierFree}</strong>
          </div>
          {bonusSpend > 0 && (
            <div className="order-row order-row--bonus">
              <span>{t.order.bonusPaid}</span>
              <strong>−{formatSom(bonusSpend)}</strong>
            </div>
          )}
          <div className="summary-card__total">
            <span>{paid ? t.order.moneyPaid : t.checkout.total}</span>
            <span>{formatSom(payAmount)}</span>
          </div>
          {(order.bonusEarned ?? 0) > 0 && (
            <div className="order-row order-row--bonus">
              <span>{t.order.bonusEarned}</span>
              <strong>+{formatSom(order.bonusEarned ?? 0)}</strong>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

export default function OrderPage() {
  return (
    <div className="container">
      <Suspense fallback={null}>
        <OrderView />
      </Suspense>
    </div>
  )
}
