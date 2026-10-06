'use client'

import Link from 'next/link'
import { useState } from 'react'
import { getProduct, type Product } from '@/data/products'
import { useCompare } from '@/lib/compare/CompareProvider'
import { compareRows } from '@/lib/compare/table'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { AddToCartButton } from '@/components/AddToCartButton'
import { IconCheck, IconClose, IconCompare } from '@/components/Icons'
import { ProductImage } from '@/components/ProductImage'
import { warrantyText } from '@/components/ProductPurchase'
import '@/components/compare.css'

/**
 * Сравнение товаров: сверху карточки (фото, название, цена, «В корзину», убрать), ниже строки —
 * цена, рассрочка, гарантия, наличие, бренд и характеристики 1С. На телефоне колонки листаются вбок,
 * подпись строки стоит над значениями и не уезжает.
 */
export default function ComparePage() {
  const { t, lang } = useI18n()
  const compare = useCompare()
  const [onlyDiff, setOnlyDiff] = useState(false)

  const items = compare.ids.map((id) => getProduct(id)).filter((p): p is Product => Boolean(p))
  const rows = compareRows(items, lang, {
    price: t.compare.price,
    installment: t.compare.installment,
    perMonth: (sum) => t.compare.perMonth.replace('{sum}', sum),
    warranty: t.product.warranty,
    warrantyOf: (months) => warrantyText(months, t.product),
    stock: t.compare.stock,
    inStock: t.product.inStock,
    outOfStock: t.catalog.outOfStock,
    preorder: t.catalog.preorder,
    brand: t.compare.brand,
  })
  const shown = onlyDiff && items.length > 1 ? rows.filter((r) => r.differ) : rows

  return (
    <div className="container">
      <div className="page-head">
        <h1 className="page-head__title">{t.compare.title}</h1>
      </div>

      {!compare.hydrated ? null : items.length === 0 ? (
        <div className="empty">
          <span className="empty__icon">
            <IconCompare size={36} />
          </span>
          <div className="empty__title">{t.compare.empty}</div>
          <p className="empty__hint">{t.compare.emptyHint}</p>
          <Link href={`/${lang}/catalog`} className="btn btn--primary empty__cta">
            {t.compare.toCatalog}
          </Link>
        </div>
      ) : (
        <>
          <div className="compare__bar">
            {items.length > 1 ? (
              <button type="button" className="chip" aria-pressed={onlyDiff} onClick={() => setOnlyDiff((v) => !v)}>
                {t.compare.onlyDiff}
              </button>
            ) : (
              <p className="compare__hint">{t.compare.addMore}</p>
            )}
            <Link href={`/${lang}/catalog`} className="btn btn--ghost btn--sm">
              {t.compare.toCatalog}
            </Link>
            <button type="button" className="btn btn--ghost btn--sm" onClick={compare.clear}>
              {t.compare.clear}
            </button>
          </div>

          <div className="compare__scroll">
            <div className="compare__grid" style={{ ['--compare-cols' as string]: items.length }}>
              {items.map((p) => {
                const name = lang === 'ky' ? p.nameKy : p.nameRu
                const variant = p.variants.find((v) => v.stock > 0) ?? p.variants[0]
                return (
                  <div key={p.id} className="compare__head">
                    <button
                      type="button"
                      className="compare__remove"
                      aria-label={`${t.compare.removeOne}: ${name}`}
                      title={t.compare.removeOne}
                      onClick={() => compare.remove(p.id)}
                    >
                      <IconClose size={18} />
                    </button>
                    <Link href={`/${lang}/product/${p.id}`} className="compare__photo" tabIndex={-1} aria-hidden="true">
                      <ProductImage kind={p.art} image={p.image} alt="" />
                    </Link>
                    <Link href={`/${lang}/product/${p.id}`} className="compare__name">
                      {name}
                    </Link>
                    {variant && p.price > 0 && (
                      <AddToCartButton productId={p.id} variantId={variant.id} disabled={variant.stock <= 0} small block />
                    )}
                  </div>
                )
              })}

              {shown.map((r) => (
                <div key={r.key} className="compare__row" role="group" aria-label={r.label}>
                  <div className="compare__label">{r.label}</div>
                  {r.values.map((v, i) => {
                    const best = r.best.includes(i)
                    const note = t.compare.best[r.key as keyof typeof t.compare.best]
                    return (
                      <div
                        key={items[i].id}
                        className={`compare__cell${r.key === 'price' ? ' compare__cell--price' : ''}${best ? ' compare__cell--best' : ''}`}
                      >
                        {v ?? '—'}
                        {best && note && (
                          <span className="compare__best">
                            <IconCheck size={14} />
                            {note}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
