'use client'

import Link from 'next/link'
import { useCart } from '@/lib/cart/CartProvider'
import { unitPrice } from '@/lib/cart/logic'
import { getProduct, colorHexOf } from '@/data/products'
import { variantLabel } from '@/lib/cart/sku'
import { formatSom } from '@/lib/format'
import { ProductImage } from '@/components/ProductImage'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { QuantityStepper } from '@/components/QuantityStepper'
import { IconCart, IconTrash } from '@/components/Icons'

export default function CartPage() {
  const { t, lang } = useI18n()
  const cart = useCart()

  if (!cart.hydrated) {
    return (
      <div className="container">
        <div className="page-head">
          <h1 className="page-head__title">{t.cart.title}</h1>
        </div>
      </div>
    )
  }

  const noticeText =
    cart.restoreNotice === 'corrupted' ? t.cart.corruptedNotice : t.cart.restoredNotice

  const noticeBlock = cart.restoreNotice ? (
    <div className="notice" role="status">
      <span>{noticeText}</span>
      <button
        type="button"
        className="notice__close"
        onClick={cart.dismissRestoreNotice}
        aria-label={t.cart.restoreDismiss}
      >
        ✕
      </button>
    </div>
  ) : null

  if (cart.lines.length === 0) {
    return (
      <div className="container">
        <div className="page-head">
          <h1 className="page-head__title">{t.cart.title}</h1>
        </div>
        {noticeBlock}
        <div className="empty">
          <span className="empty__icon">
            <IconCart size={36} />
          </span>
          <div className="empty__title">{t.cart.empty}</div>
          <p className="empty__hint">{t.cart.emptyHint}</p>
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
        <h1 className="page-head__title">
          {t.cart.title} · {cart.itemsCount}
        </h1>
        <p className="page-head__sub">{t.cart.demoNote}</p>
      </div>

      {noticeBlock}

      <div className="cart-layout">
        <div>
          <div className="cart-lines">
            {cart.lines.map((line) => {
              const product = getProduct(line.productId)
              if (!product) return null
              const variant = product.variants.find((v) => v.id === line.variantId)
              if (!variant) return null
              const price = unitPrice(product, line.variantId) ?? product.price
              const variantLabel$ = variantLabel(product, variant, lang)
              return (
                <div className="cart-line" key={`${line.productId}:${line.variantId}`}>
                  <Link
                    href={`/${lang}/product/${product.id}`}
                    className="cart-line__media"
                    aria-label={lang === 'ky' ? product.nameKy : product.nameRu}
                  >
                    <ProductImage
                      kind={product.art}
                      colorHex={colorHexOf(product, variant)}
                    />
                  </Link>
                  <div>
                    <Link href={`/${lang}/product/${product.id}`} className="cart-line__name">
                      {lang === 'ky' ? product.nameKy : product.nameRu}
                    </Link>
                    {variantLabel$ && <div className="cart-line__variant">{variantLabel$}</div>}
                    <div className="cart-line__unit">
                      {formatSom(price)} / {t.cart.perItem}
                    </div>
                    <div className="cart-line__controls">
                      <QuantityStepper
                        value={line.qty}
                        max={variant.stock}
                        onChange={(next) =>
                          cart.changeQty(line.productId, line.variantId, next)
                        }
                        ariaLabel={`${t.cart.quantity}: ${lang === 'ky' ? product.nameKy : product.nameRu}`}
                      />
                      <button
                        type="button"
                        className="remove-btn"
                        onClick={() => cart.remove(line.productId, line.variantId)}
                      >
                        <IconTrash size={16} />
                        {t.cart.remove}
                      </button>
                    </div>
                  </div>
                  <div className="cart-line__right">
                    <span className="cart-line__total">{formatSom(price * line.qty)}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                if (window.confirm(t.cart.clearConfirm)) cart.clear()
              }}
            >
              {t.cart.clear}
            </button>
          </div>
        </div>

        <aside className="summary-card" aria-label={t.cart.total}>
          <div className="summary-card__row">
            <span>{t.cart.items}</span>
            <span>{cart.itemsCount}</span>
          </div>
          <div className="summary-card__total">
            <span>{t.cart.total}</span>
            <span>{formatSom(cart.subtotal)}</span>
          </div>
          <p className="summary-card__note">{t.cart.totalNote}</p>
          <Link href={`/${lang}/checkout`} className="btn btn--primary btn--block">
            {t.cart.checkout}
          </Link>
        </aside>
      </div>
    </div>
  )
}
