'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { getProduct, type Product } from '@/data/products'
import { COMPARE_MAX, useCompare } from '@/lib/compare/CompareProvider'
import { compareRows, shortNames, type CompareRow } from '@/lib/compare/table'
import { formatSom } from '@/lib/format'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { AddToCartButton } from '@/components/AddToCartButton'
import { IconCheck, IconChevronLeft, IconChevronRight, IconClose, IconCompare, IconPlus } from '@/components/Icons'
import { ProductImage } from '@/components/ProductImage'
import { ShareButton } from '@/components/ShareButton'
import { warrantyText } from '@/components/ProductPurchase'
import '@/components/compare.css'

/**
 * Сравнение товаров. Компьютер: слева колонка подписей, справа товары; строка подсвечивается под
 * мышью, чтобы глаз не терял её по ширине. Телефон: подпись над значениями, колонки листаются вбок.
 * Одинаковое у всех — одна ячейка «8 кг · одинаково», лучшее — с разницей («дешевле на 6 600 сом»).
 * Карточки ушли вверх — сверху прилипает полоска «название + цена», едет вбок вместе с таблицей.
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
  const many = items.length > 1
  const diffCount = many ? rows.filter((r) => r.differ).length : 0
  const shown = onlyDiff && many ? rows.filter((r) => r.differ) : rows
  const groups = [
    { key: 'main', title: t.compare.main, rows: shown.filter((r) => r.group === 'main') },
    { key: 'specs', title: t.product.specs, rows: shown.filter((r) => r.group === 'specs') },
  ].filter((g) => g.rows.length)
  const slot = items.length < COMPARE_MAX

  const pin = usePinnedHead(items.length)

  // Чужая ссылка «…/compare?ids=a,b,c» (кнопка «Поделиться»): показываем её товары и убираем хвост из адреса
  const { hydrated, replace } = compare
  useEffect(() => {
    if (!hydrated) return
    const url = new URL(window.location.href)
    const shared = url.searchParams.get('ids')
    if (shared === null) return
    replace(shared.split(','))
    url.searchParams.delete('ids')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  }, [hydrated, replace])

  // «Коротко»: только где победитель один и «лучше» однозначно (те же строки, что с отметкой в таблице)
  const winners = many
    ? rows.flatMap((r) => {
        const title = t.compare.winner[r.key as keyof typeof t.compare.winner]
        if (!title || r.best.length !== 1) return []
        const i = r.best[0]
        return [{ key: r.key, title, product: items[i], value: r.values[i] as string }]
      })
    : []

  const name = (p: Product) => (lang === 'ky' ? p.nameKy : p.nameRu)
  const shorts = shortNames(items.map(name))
  const short = (p: Product) => shorts[items.indexOf(p)] ?? name(p)
  const lead = (r: CompareRow) => {
    if (r.lead === null) return null
    const by = t.compare.bestBy[r.key as keyof typeof t.compare.bestBy]
    if (!by) return null
    const v = r.key === 'warranty' ? warrantyText(r.lead, t.product) : formatSom(r.lead)
    return by.replace('{v}', v)
  }

  const cols = items.length + (slot ? 1 : 0)
  const share = {
    title: t.compare.title,
    text: t.compare.shareText.replace('{names}', shorts.join(', ')),
    path: `/${lang}/compare?ids=${items.map((p) => encodeURIComponent(p.id)).join(',')}`,
  }
  // «2–3 из 3»: считаем только товары, пустое место «Добавить» — не товар
  const shownText = (first: number) => {
    const n = items.length
    const from = Math.min(first + 1, n)
    const to = Math.min(first + 2, n)
    return (from === to ? t.compare.shownOne : t.compare.shown)
      .replace('{from}', String(from))
      .replace('{to}', String(to))
      .replace('{n}', String(n))
  }
  const vars = { '--cols': cols } as CSSProperties

  return (
    <>
      <div className="container">
        <div className="page-head">
          <h1 className="page-head__title">{t.compare.title}</h1>
        </div>
      </div>

      {!compare.hydrated ? null : items.length === 0 ? (
        <div className="container">
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
        </div>
      ) : (
        <div className="compare" style={vars} ref={pin.root}>
          <div className="container">
            <div className="compare__bar">
              {many ? (
                <button type="button" className="chip compare__diff" aria-pressed={onlyDiff} onClick={() => setOnlyDiff((v) => !v)}>
                  {t.compare.onlyDiff}
                  <span className="compare__count">{diffCount}</span>
                </button>
              ) : (
                <p className="compare__hint">{t.compare.addMore}</p>
              )}
              <Link href={`/${lang}/catalog`} className="btn btn--ghost btn--sm compare__to-catalog">
                {t.compare.toCatalog}
              </Link>
              {many && (
                <>
                  {/* компьютер — кнопка с подписью, телефон — круглый значок: иначе «Очистить» уезжает на вторую строку */}
                  <ShareButton className="btn--ghost btn--sm compare__share" {...share} />
                  <ShareButton variant="icon" className="compare__share-icon" {...share} />
                </>
              )}
              <button type="button" className="btn btn--ghost btn--sm" onClick={compare.clear}>
                {t.compare.clear}
              </button>
            </div>

            {winners.length > 0 && (
              <section className="compare__summary" aria-labelledby="compare-summary">
                <h2 id="compare-summary" className="compare__summary-title">
                  {t.compare.summary}
                </h2>
                <ul className="compare__wins">
                  {winners.map((w) => (
                    <li key={w.key} className="compare__win">
                      <span className="compare__win-title">
                        <IconCheck size={14} />
                        {w.title}
                      </span>
                      <Link href={`/${lang}/product/${w.product.id}`} className="compare__win-name">
                        {short(w.product)}
                      </Link>
                      <span className="compare__win-value">{w.value}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Полоска «название + цена»: копия шапки таблицы для глаз, читалке экрана не нужна. */}
          <div className="compare__pin" aria-hidden="true">
            <div className={`compare__mini${pin.on ? ' is-on' : ''}`}>
              <div className="container">
                <div className="compare__mini-clip">
                  <div className="compare__track compare__mini-track" ref={pin.track}>
                    <div className="compare__corner" />
                    {items.map((p) => (
                      <div key={p.id} className="compare__mini-item">
                        <span className="compare__mini-name">{short(p)}</span>
                        {p.price > 0 && <span className="compare__mini-price">{formatSom(p.price)}</span>}
                      </div>
                    ))}
                    {slot && <div className="compare__slot" />}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="container">
            {/* Телефон: на экране два товара; что дальше — видно по счётчику, листать — пальцем или стрелками */}
            {cols > 2 && (
              <div className="compare__pager">
                <button type="button" className="compare__step" aria-label={t.compare.prev} disabled={pin.first === 0} onClick={() => pin.step(-1)}>
                  <IconChevronLeft size={20} />
                </button>
                <span className="compare__shown" aria-live="polite">
                  {shownText(pin.first)}
                </span>
                <button type="button" className="compare__step" aria-label={t.compare.next} disabled={pin.first + 2 >= cols} onClick={() => pin.step(1)}>
                  <IconChevronRight size={20} />
                </button>
              </div>
            )}
            <div className="compare__scroll" ref={pin.scroll} onScroll={pin.sync}>
              <div className="compare__track compare__grid">
                <div className="compare__corner" />
                {items.map((p, i) => {
                  const variant = p.variants.find((v) => v.stock > 0) ?? p.variants[0]
                  return (
                    <div key={p.id} className="compare__head" ref={i === 0 ? pin.head : undefined}>
                      <button
                        type="button"
                        className="compare__remove"
                        aria-label={`${t.compare.removeOne}: ${name(p)}`}
                        title={t.compare.removeOne}
                        onClick={() => compare.remove(p.id)}
                      >
                        <IconClose size={18} />
                      </button>
                      <Link href={`/${lang}/product/${p.id}`} className="compare__photo" tabIndex={-1} aria-hidden="true">
                        <ProductImage kind={p.art} image={p.image} alt="" />
                      </Link>
                      <Link href={`/${lang}/product/${p.id}`} className="compare__name">
                        {name(p)}
                      </Link>
                      {variant && p.price > 0 && (
                        <AddToCartButton productId={p.id} variantId={variant.id} disabled={variant.stock <= 0} small block />
                      )}
                    </div>
                  )
                })}
                {slot && (
                  <Link href={`/${lang}/catalog`} className="compare__slot compare__add">
                    <span className="compare__add-icon">
                      <IconPlus size={22} />
                    </span>
                    <span className="compare__add-title">{t.compare.addSlot}</span>
                    <span className="compare__add-hint">{t.compare.addSlotHint}</span>
                  </Link>
                )}

                {groups.map((g) => (
                  <section key={g.key} className="compare__group" aria-label={g.title}>
                    <h2 className="compare__group-title">{g.title}</h2>
                    {g.rows.map((r) => (
                      <Row key={r.key} row={r} items={items} slot={slot} lead={lead(r)} same={t.compare.same} />
                    ))}
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Row({
  row: r,
  items,
  slot,
  lead,
  same,
}: {
  row: CompareRow
  items: Product[]
  slot: boolean
  lead: string | null
  same: string
}) {
  const merged = items.length > 1 && !r.differ
  return (
    <div className={`compare__row${merged ? ' compare__row--same' : ''}`} role="group" aria-label={r.label}>
      <div className="compare__label">
        {r.label}
        {merged && <span className="compare__same">{same}</span>}
      </div>
      {merged ? (
        <div className="compare__cell compare__cell--merged" style={{ gridColumn: `span ${items.length}` }}>
          <span className="compare__merged">
            <Value row={r} index={0} product={items[0]} />
          </span>
        </div>
      ) : (
        r.values.map((_, i) => {
          const best = r.best.includes(i)
          return (
            <div
              key={items[i].id}
              className={`compare__cell${r.key === 'price' ? ' compare__cell--price' : ''}${best ? ' compare__cell--best' : ''}`}
            >
              <Value row={r} index={i} product={items[i]} />
              {best && lead && (
                <span className="compare__best">
                  <IconCheck size={14} />
                  {lead}
                </span>
              )}
            </div>
          )
        })
      )}
      {slot && <div className="compare__cell compare__slot" />}
    </div>
  )
}

/** Значение ячейки. Цена — со старой ценой, если она есть в 1С; наличие — с точкой статуса. */
function Value({ row: r, index, product: p }: { row: CompareRow; index: number; product: Product }) {
  const v = r.values[index]
  if (v === null) return <span className="compare__none">—</span>
  if (r.key === 'price') {
    return (
      <span className="compare__price">
        <span>{v}</span>
        {p.oldPrice && p.oldPrice > p.price && <s className="compare__old">{formatSom(p.oldPrice)}</s>}
      </span>
    )
  }
  if (r.key === 'stock') {
    const ok = p.preorder || p.variants.some((x) => x.stock > 0)
    return <span className={`compare__stock${ok ? ' is-ok' : ''}`}>{v}</span>
  }
  return <>{v}</>
}

/**
 * Прилипающая полоска с названиями. Видна, пока карточки товаров ушли вверх, а таблица ещё на экране.
 * Сдвигается вниз на высоту шапки сайта, когда та показана (шапка прячется при прокрутке вниз).
 */
function usePinnedHead(count: number) {
  const root = useRef<HTMLDivElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  const [first, setFirst] = useState(0)

  /** ширина одной колонки товара вместе с промежутком — по первой карточке */
  const colWidth = () => {
    const card = head.current
    if (!card) return 0
    const gap = parseFloat(getComputedStyle(card.parentElement as Element).columnGap) || 0
    return card.offsetWidth + gap
  }

  const sync = useCallback(() => {
    const box = scroll.current
    if (!box) return
    if (track.current) track.current.style.transform = `translateX(${-box.scrollLeft}px)`
    const w = colWidth()
    if (w) setFirst(Math.round(box.scrollLeft / w))
  }, [])

  const step = useCallback((dir: 1 | -1) => {
    const box = scroll.current
    const w = colWidth()
    if (box && w) box.scrollBy({ left: dir * w, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    let frame = 0
    const header = document.querySelector<HTMLElement>('.header')
    const measure = () => {
      frame = 0
      const box = root.current
      const card = head.current
      if (!box || !card) return
      // куда шапка придёт, а не где она сейчас: полоска едет вместе с ней, а не догоняет
      const top = header && !header.classList.contains('is-hidden') ? header.offsetHeight : 0
      box.style.setProperty('--compare-top', `${top}px`)
      const end = box.getBoundingClientRect().bottom
      setOn(card.getBoundingClientRect().bottom < top && end > top + 140)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    sync()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    // шапка прячется и возвращается сменой класса — сразу двигаем полоску следом
    const watch = new MutationObserver(onScroll)
    if (header) watch.observe(header, { attributes: true, attributeFilter: ['class'] })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      watch.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [count, sync])

  return { root, head, scroll, track, on, sync, first, step }
}
