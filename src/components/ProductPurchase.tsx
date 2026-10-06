'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { phones, whatsappHref } from '@/data/contacts'
import { SITE_URL } from '@/lib/seo'
import { IconWhatsApp } from './Icons'
import { ShareButton } from './ShareButton'
import type { Product, ProductVariant } from '@/data/products'
import { unitPrice } from '@/lib/cart/logic'
import { formatSom } from '@/lib/format'
import { ADAL_APP_LINK, adalMonthly, INSTALLMENT, MBANK_STORES, mbankFits } from '@/lib/installment'
import { suggestCombos, variantLabel } from '@/lib/cart/sku'
import { categoryName } from '@/data/categories'
import { AddToCartButton } from './AddToCartButton'
import { FavoriteButton } from './FavoriteButton'
import { PromoCountdown } from './PromoCountdown'

function StockLine({ stock, hidden, preorder }: { stock: number; hidden?: boolean; preorder?: boolean }) {
  const { t } = useI18n()
  if (preorder) {
    return (
      <span className="stock-line">
        <span className="stock-dot stock-dot--soon" />
        {t.product.preorderStock}
      </span>
    )
  }
  if (stock <= 0) {
    return (
      <span className="stock-line">
        <span className="stock-dot stock-dot--out" />
        {t.catalog.outOfStock}
      </span>
    )
  }
  // «В наличии» из 1С без остатка: число выдуманное, его не пишем.
  if (hidden) {
    return (
      <span className="stock-line">
        <span className="stock-dot" />
        {t.product.inStock}
      </span>
    )
  }
  if (stock <= 3) {
    return (
      <span className="stock-line">
        <span className="stock-dot stock-dot--low" />
        {t.product.lowStock}: {stock}
      </span>
    )
  }
  return (
    <span className="stock-line">
      <span className="stock-dot" />
      {t.product.inStock}: {stock}
    </span>
  )
}

/** 12 → «1 год», 24 → «2 года», 18 → «18 мес.»: целые годы читаются легче месяцев. */
export function warrantyText(
  months: number,
  words: { warrantyMonths: string; warrantyYear1: string; warrantyYear2: string; warrantyYear5: string },
): string {
  if (months % 12 !== 0) return `${months} ${words.warrantyMonths}`
  const years = months / 12
  const tail = years % 10
  const teen = years % 100 >= 11 && years % 100 <= 14
  const word = teen || tail === 0 || tail >= 5 ? words.warrantyYear5 : tail === 1 ? words.warrantyYear1 : words.warrantyYear2
  return `${years} ${word}`
}

/** Гарантия из карточки товара в 1С. Не указана (0) — плашки нет: пустое обещание хуже никакого. */
function WarrantyBadge({ months }: { months: number }) {
  const { t } = useI18n()
  if (months <= 0) return null
  return (
    <div className="warranty-badge">
      <span className="warranty-badge__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />
          <path d="M8.5 12l2.5 2.5 4.5-5" />
        </svg>
      </span>
      <span className="warranty-badge__text">
        <strong>
          {t.product.warranty} {warrantyText(months, t.product)}
        </strong>
        <span>{t.product.warrantyNote}</span>
      </span>
    </div>
  )
}

/**
 * «Бөлүп төлөө: айына 5 975 сом × 4 ай» (владелец 06.10: самое частое в чатах — «кымбат»). До 40 000 —
 * «Адал рассрочка» MIslamic: сумма в месяц точная, без переплаты. Дороже, до 200 000 — «МРассрочка» MBANK
 * без суммы: там переплата, её считает банк. Рассрочку даёт банк — так и подписано.
 */
function InstallmentBadge({ price, name }: { price: number; name: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const monthly = adalMonthly(price)
  if (!monthly && !mbankFits(price)) return null
  return (
    <>
    <div className="warranty-badge installment-badge">
      <span className="warranty-badge__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </span>
      <span className="warranty-badge__text">
        {monthly ? (
          <strong>
            {t.product.installmentLine.replace('{sum}', formatSom(monthly)).replace('{n}', String(INSTALLMENT.adal.months))}
          </strong>
        ) : (
          <strong>{t.product.installmentLong}</strong>
        )}
        <span>{monthly ? t.product.installmentNote : t.product.installmentLongNote}</span>
        {/* Владелец 06.10: «Адал рассрочкани қандай олишни одамлар билмаяпти» — три шага и кнопка прямо в MBANK */}
        {monthly && (
          <button type="button" className="installment-badge__how" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {t.product.installmentHow}
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </span>
    </div>
    {monthly && open && (
      <div className="installment-how">
        <img className="installment-how__logo" src="/brand/mislamic.svg" alt="MIslamic" width="120" height="26" />
        <ol className="installment-how__steps">
          <li>{t.product.installmentStep1}</li>
          <li>{t.product.installmentStep2}</li>
          <li>
            {t.product.installmentStep3}{' '}
            <a href={whatsappHref(phones[0], `${t.contactWidget.askAbout} ${name} — Адал рассрочка`)} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </li>
        </ol>
        <a className="btn btn--outline btn--block installment-how__connect" href={ADAL_APP_LINK} target="_blank" rel="noopener noreferrer">
          {t.product.installmentConnect}
        </a>
        <p className="installment-how__stores">
          {t.product.installmentNoApp}{' '}
          <a href={MBANK_STORES.ios} target="_blank" rel="noopener noreferrer">App Store</a>
          {' · '}
          <a href={MBANK_STORES.android} target="_blank" rel="noopener noreferrer">Google Play</a>
        </p>
      </div>
    )}
    </>
  )
}

export function ProductPurchase({
  product,
  variant,
  colorKey,
  memoryKey,
  onColorChange,
  onMemoryChange,
}: {
  product: Product
  /** Комбинация выбрана точно; null — выбранной комбинации нет в каталоге */
  variant: ProductVariant | null
  colorKey: string | null
  memoryKey: string | null
  onColorChange: (colorKey: string | null) => void
  onMemoryChange: (memoryKey: string | null) => void
}) {
  const { t, lang } = useI18n()
  const name = lang === 'ky' ? product.nameKy : product.nameRu
  const price = variant ? (unitPrice(product, variant.id) ?? product.price) : null
  const colorOptions = product.colorOptions ?? []
  const memoryOptions = product.memoryOptions ?? []
  const label = variant ? variantLabel(product, variant, lang) : null
  const suggestions = variant ? [] : suggestCombos(product, colorKey, memoryKey)
  const chosenColorLabel = colorOptions.find((c) => c.key === colorKey)
  const chosenMemoryLabel = memoryOptions.find((m) => m.key === memoryKey)

  return (
    <div className="purchase">
      <span className="purchase__cat">
        {categoryName(product.categoryId, lang)}
      </span>
      <h1 className="purchase__name">{name}</h1>

      {label && (
        <span className="purchase__variant" aria-label={t.a11y.currentVariant}>
          {t.product.option}: {label}
        </span>
      )}

      {variant && price !== null && product.price <= 0 ? (
        <div className="purchase__prices">
          <span className="purchase__price purchase__price--request">{t.catalog.priceOnRequest}</span>
        </div>
      ) : variant && price !== null ? (
        <div className="purchase__prices">
          <span className={`purchase__price${product.oldPrice ? ' purchase__price--sale' : ''}`}>{formatSom(price)}</span>
          {product.oldPrice && <span className="purchase__old">{formatSom(product.oldPrice)}</span>}
          {/* Отсчёт рядом с ценой: решение о покупке принимают здесь */}
          {product.promoUntil && <PromoCountdown until={product.promoUntil} />}
        </div>
      ) : null}

      {variant ? (
        <div>
          <StockLine stock={variant.stock} hidden={product.stockHidden} preorder={product.preorder} />
          <p className="stock-note">{product.preorder ? t.product.preorderNote : t.product.stockNote}</p>
          {price !== null && price > 0 && product.price > 0 && <InstallmentBadge price={price} name={name} />}
          <WarrantyBadge months={product.warrantyMonths} />
        </div>
      ) : (
        <div className="combo-missing" role="status">
          <strong>{t.product.comboMissing}</strong>
          <p>{t.product.comboMissingNote}</p>
          <div className="combo-missing__list">
            {suggestions.map((v) => (
              <button
                key={v.id}
                type="button"
                className="swatch"
                onClick={() => {
                  if (product.colorOptions && v.colorKey) onColorChange(v.colorKey)
                  if (product.memoryOptions && v.memoryKey) onMemoryChange(v.memoryKey)
                }}
              >
                {variantLabel(product, v, lang)}
                {v.priceDelta ? ` · +${formatSom(v.priceDelta)}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {colorOptions.length > 1 && (
        <div className="option-group">
          <span className="option-group__label">
            {t.product.color}
            {': '}
            <span>{chosenColorLabel ? (lang === 'ky' ? chosenColorLabel.labelKy : chosenColorLabel.labelRu) : '—'}</span>
          </span>
          <div className="swatch-row">
            {colorOptions.map((c) => {
              const exists = product.variants.some((v) => v.colorKey === c.key)
              return (
                <button
                  key={c.key}
                  type="button"
                  className="swatch"
                  aria-pressed={colorKey === c.key}
                  disabled={!exists}
                  onClick={() => onColorChange(c.key)}
                >
                  <span className="swatch__dot" style={{ background: c.hex }} />
                  {lang === 'ky' ? c.labelKy : c.labelRu}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {memoryOptions.length > 1 && (
        <div className="option-group">
          <span className="option-group__label">
            {t.product.memory}
            {': '}
            <span>{chosenMemoryLabel ? (lang === 'ky' ? chosenMemoryLabel.labelKy : chosenMemoryLabel.labelRu) : '—'}</span>
          </span>
          <div className="swatch-row">
            {memoryOptions.map((m) => {
              const exists = product.variants.some((v) => v.memoryKey === m.key)
              return (
                <button
                  key={m.key}
                  type="button"
                  className="swatch"
                  aria-pressed={memoryKey === m.key}
                  disabled={!exists}
                  onClick={() => onMemoryChange(m.key)}
                >
                  {lang === 'ky' ? m.labelKy : m.labelRu}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="purchase__actions">
        {variant ? (
          <AddToCartButton
            productId={product.id}
            variantId={variant.id}
            disabled={variant.stock <= 0}
            label={product.preorder ? t.product.preorderButton : undefined}
          />
        ) : (
          <button type="button" className="btn btn--primary" disabled aria-live="polite">
            {t.product.comboMissing}
          </button>
        )}
        <FavoriteButton productId={product.id} variant="floating" />
      </div>

      <span className="bonus-hint">{t.checkout.sbonusNote}</span>

      {/* Одно нажатие — и в WhatsApp уже написано, о каком товаре речь:
          покупателю не надо объяснять, сотруднику не надо переспрашивать. */}
      <a
        className="btn purchase__ask"
        href={whatsappHref(phones[0], askText(t.contactWidget.askAbout, name, price, `${SITE_URL}/${lang}/product/${product.id}`))}
        target="_blank"
        rel="noopener"
      >
        <IconWhatsApp size={22} />
        {t.product.askWhatsApp}
      </a>

      {/* Отправить товар семье или другу — одним нажатием, без копирования адреса */}
      <ShareButton
        title={name}
        text={price ? `${name} — ${formatSom(price)}` : name}
        path={`/${lang}/product/${product.id}`}
        className="purchase__ask purchase__share"
      />
    </div>
  )
}

function askText(intro: string, name: string, price: number | null, url: string): string {
  return `${intro} ${name}${price ? ` — ${formatSom(price)}` : ''}\n${url}`
}
