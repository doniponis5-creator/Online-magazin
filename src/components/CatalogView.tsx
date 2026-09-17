'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { categories, type CategoryId } from '@/data/categories'
import { brands, products, type Product } from '@/data/products'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { buildCatalogHref } from '@/lib/links'
import { formatSom } from '@/lib/format'
import { ProductCard } from '@/components/ProductCard'
import { FilterSelect } from '@/components/FilterSelect'
import { IconClose, IconFilter, IconSearch } from '@/components/Icons'
import './catalog-filters.css'

type SortKey = 'popular' | 'price-asc' | 'price-desc'
type Badge = 'hit' | 'new'

const SORTS: SortKey[] = ['popular', 'price-asc', 'price-desc']
const BADGES: Badge[] = ['hit', 'new']
const BRANDS_PREVIEW = 6

function parseCat(value: string | null): CategoryId | 'all' {
  if (value && categories.some((c) => c.id === value)) return value as CategoryId
  return 'all'
}

function parseSort(value: string | null): SortKey {
  return SORTS.includes(value as SortKey) ? (value as SortKey) : 'popular'
}

/** Список через запятую: ?brand=Aura,Nova — совместим со старыми ссылками ?brand=Aura */
function parseList(value: string | null): string[] {
  return value ? value.split(',').map((v) => v.trim()).filter(Boolean) : []
}

function parsePrice(value: string | null): number | null {
  const n = Number(value)
  return value && Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').trim()
}

const inStock = (p: Product) => p.variants.some((v) => v.stock > 0)
const onSale = (p: Product) => Boolean(p.oldPrice && p.oldPrice > p.price)

function CatalogViewInner() {
  const { t, lang } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL — единственный источник состояния фильтров. Назад/вперёд, reload
  // и ссылки категорий восстанавливают видимые результаты.
  const q = searchParams.get('q') ?? ''
  const cat = parseCat(searchParams.get('cat'))
  const selectedBrands = parseList(searchParams.get('brand')).filter((b) => brands.includes(b))
  const sort = parseSort(searchParams.get('sort'))
  const minPrice = parsePrice(searchParams.get('min'))
  const maxPrice = parsePrice(searchParams.get('max'))
  const stockOnly = searchParams.get('stock') === '1'
  const saleOnly = searchParams.get('sale') === '1'
  const selectedBadges = parseList(searchParams.get('badge')).filter((b): b is Badge =>
    BADGES.includes(b as Badge),
  )
  const brandKey = selectedBrands.join(',')
  const badgeKey = selectedBadges.join(',')

  // Локальные значения полей — только для ввода; в URL уходят с задержкой.
  const [input, setInput] = useState(q)
  const [minInput, setMinInput] = useState(minPrice ? String(minPrice) : '')
  const [maxInput, setMaxInput] = useState(maxPrice ? String(maxPrice) : '')
  const [panelOpen, setPanelOpen] = useState(false)
  const [allBrands, setAllBrands] = useState(false)

  // На телефоне панель открыта поверх страницы: Esc закрывает, фон не прокручивается
  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPanelOpen(false)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
    }
  }, [panelOpen])

  useEffect(() => setInput(q), [q])
  useEffect(() => setMinInput(minPrice ? String(minPrice) : ''), [minPrice])
  useEffect(() => setMaxInput(maxPrice ? String(maxPrice) : ''), [maxPrice])

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(patch)) {
        if (!value) sp.delete(key)
        else sp.set(key, value)
      }
      const qs = sp.toString()
      // push (а не replace): назад/вперёд восстанавливают состояния фильтров
      router.push(`/${lang}/catalog${qs ? `?${qs}` : ''}`, { scroll: false })
    },
    [searchParams, router, lang],
  )

  useEffect(() => {
    if (input === q) return
    const timer = setTimeout(() => update({ q: input || null }), 250)
    return () => clearTimeout(timer)
  }, [input, q, update])

  useEffect(() => {
    const nextMin = parsePrice(minInput)
    const nextMax = parsePrice(maxInput)
    if (nextMin === minPrice && nextMax === maxPrice) return
    const timer = setTimeout(
      () => update({ min: nextMin ? String(nextMin) : null, max: nextMax ? String(nextMax) : null }),
      600,
    )
    return () => clearTimeout(timer)
  }, [minInput, maxInput, minPrice, maxPrice, update])

  /** Все фильтры, кроме указанного, — чтобы счётчики у брендов были честными. */
  const matches = useCallback(
    (p: Product, skip?: 'brand') => {
      if (cat !== 'all' && p.categoryId !== cat) return false
      if (skip !== 'brand' && selectedBrands.length && !selectedBrands.includes(p.brand)) return false
      if (minPrice && p.price < minPrice) return false
      if (maxPrice && p.price > maxPrice) return false
      if (stockOnly && !inStock(p)) return false
      if (saleOnly && !onSale(p)) return false
      if (selectedBadges.length && !(p.badge && selectedBadges.includes(p.badge))) return false
      const needle = normalize(q)
      if (needle) {
        const haystack = normalize(`${p.nameRu} ${p.nameKy} ${p.brand} ${p.descRu} ${p.descKy}`)
        if (!haystack.includes(needle)) return false
      }
      return true
    },
    // brandKey/badgeKey — стабильные ключи массивов из URL
    [q, cat, brandKey, minPrice, maxPrice, stockOnly, saleOnly, badgeKey],
  )

  const filtered = useMemo(() => {
    let list = products.filter((p) => matches(p))
    // товары «цена по запросу» (0) всегда в конце списка
    const priceKey = (p: Product, dir: 1 | -1) => (p.price > 0 ? p.price * dir : Number.MAX_SAFE_INTEGER)
    if (sort === 'price-asc') list = [...list].sort((a, b) => priceKey(a, 1) - priceKey(b, 1))
    else if (sort === 'price-desc') list = [...list].sort((a, b) => priceKey(a, -1) - priceKey(b, -1))
    else
      list = [...list].sort((a, b) => {
        const rank = (badge?: string) => (badge === 'hit' ? 0 : badge === 'new' ? 1 : 2)
        return rank(a.badge) - rank(b.badge)
      })
    return list
  }, [matches, sort])

  const brandCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of products) if (matches(p, 'brand')) counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1)
    return counts
  }, [matches])

  const priceBounds = useMemo(() => {
    const pool = products.filter((p) => cat === 'all' || p.categoryId === cat)
    const prices = pool.map((p) => p.price).filter((price) => price > 0)
    return prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null
  }, [cat])

  // Бренды без товаров при текущих фильтрах скрыты; выбранные видны всегда
  const availableBrands = brands.filter((b) => (brandCounts.get(b) ?? 0) > 0 || selectedBrands.includes(b))
  const visibleBrands = allBrands
    ? availableBrands
    : availableBrands.filter((b, i) => i < BRANDS_PREVIEW || selectedBrands.includes(b))

  const activeCount =
    selectedBrands.length +
    (minPrice || maxPrice ? 1 : 0) +
    (stockOnly ? 1 : 0) +
    (saleOnly ? 1 : 0) +
    selectedBadges.length

  const hasFilters = Boolean(q) || cat !== 'all' || sort !== 'popular' || activeCount > 0

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

  const reset = () => {
    setInput('')
    setMinInput('')
    setMaxInput('')
    router.push(buildCatalogHref(lang, {}), { scroll: false })
  }

  const resetPanel = () => {
    setMinInput('')
    setMaxInput('')
    update({ brand: null, min: null, max: null, stock: null, sale: null, badge: null })
  }

  const badgeLabel: Record<Badge, string> = { hit: t.catalog.badgeHit, new: t.catalog.badgeNew }

  return (
    <div className="container">
      <div className="page-head">
        <h1 className="page-head__title">{t.catalog.title}</h1>
        <p className="page-head__sub">{t.catalog.subtitle}</p>
      </div>

      <div className="catalog-layout">
        <div className="filters">
          <div className="search">
            <span className="search__icon">
              <IconSearch size={19} />
            </span>
            <input
              type="search"
              className="search__input"
              placeholder={t.catalog.searchPlaceholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label={t.catalog.searchPlaceholder}
            />
          </div>

          <div className="chip-row" role="group" aria-label={t.categories.title}>
            <button
              type="button"
              className="chip"
              aria-pressed={cat === 'all'}
              onClick={() => update({ cat: null })}
            >
              {t.catalog.allCategories}
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip"
                aria-pressed={cat === c.id}
                onClick={() => update({ cat: c.id })}
              >
                {lang === 'ky' ? c.nameKy : c.nameRu}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="catalog-body">
        <aside
          id="catalog-filters"
          className={`filter-panel${panelOpen ? ' is-open' : ''}`}
          aria-label={t.catalog.filters}
        >
          <div className="filter-panel__head">
            <span className="filter-panel__title">{t.catalog.filters}</span>
            {activeCount > 0 && (
              <button type="button" className="filter-panel__reset" onClick={resetPanel}>
                {t.catalog.clearFilters}
              </button>
            )}
            <button
              type="button"
              className="filter-panel__close"
              aria-label={t.catalog.closeFilters}
              onClick={() => setPanelOpen(false)}
            >
              <IconClose size={22} />
            </button>
          </div>

          <fieldset className="filter-group">
            <legend className="filter-group__title">{t.catalog.price}</legend>
            <div className="price-range">
              <label className="price-range__field">
                <span>{t.catalog.priceFrom}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={100}
                  value={minInput}
                  placeholder={priceBounds ? String(priceBounds.min) : ''}
                  onChange={(e) => setMinInput(e.target.value)}
                />
              </label>
              <span className="price-range__dash" aria-hidden="true">—</span>
              <label className="price-range__field">
                <span>{t.catalog.priceTo}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={100}
                  value={maxInput}
                  placeholder={priceBounds ? String(priceBounds.max) : ''}
                  onChange={(e) => setMaxInput(e.target.value)}
                />
              </label>
            </div>
            {priceBounds && (
              <p className="filter-group__hint">
                {formatSom(priceBounds.min)} – {formatSom(priceBounds.max)}
              </p>
            )}
          </fieldset>

          <fieldset className="filter-group">
            <legend className="filter-group__title">{t.catalog.brand}</legend>
            <div className="check-list">
              {visibleBrands.map((b) => {
                const count = brandCounts.get(b) ?? 0
                const checked = selectedBrands.includes(b)
                return (
                  <label key={b} className="check">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => update({ brand: toggleIn(selectedBrands, b).join(',') || null })}
                    />
                    <span className="check__label">{b}</span>
                    <span className="check__count">{count}</span>
                  </label>
                )
              })}
              {availableBrands.length > BRANDS_PREVIEW && (
                <button
                  type="button"
                  className="check-list__more"
                  aria-expanded={allBrands}
                  onClick={() => setAllBrands((v) => !v)}
                >
                  {allBrands ? t.catalog.showLess : `${t.catalog.showAll} (${availableBrands.length})`}
                </button>
              )}
            </div>
          </fieldset>

          <fieldset className="filter-group">
            <legend className="filter-group__title">{t.catalog.availability}</legend>
            <div className="check-list">
              <label className="check">
                <input
                  type="checkbox"
                  checked={stockOnly}
                  onChange={() => update({ stock: stockOnly ? null : '1' })}
                />
                <span className="check__label">{t.catalog.inStockOnly}</span>
              </label>
            </div>
          </fieldset>

          <fieldset className="filter-group">
            <legend className="filter-group__title">{t.catalog.offers}</legend>
            <div className="check-list">
              <label className="check">
                <input
                  type="checkbox"
                  checked={saleOnly}
                  onChange={() => update({ sale: saleOnly ? null : '1' })}
                />
                <span className="check__label">{t.catalog.onSale}</span>
              </label>
              {BADGES.map((b) => (
                <label key={b} className="check">
                  <input
                    type="checkbox"
                    checked={selectedBadges.includes(b)}
                    onChange={() => update({ badge: toggleIn(selectedBadges, b).join(',') || null })}
                  />
                  <span className="check__label">{badgeLabel[b]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="button"
            className="btn btn--primary filter-panel__apply"
            onClick={() => setPanelOpen(false)}
          >
            {t.catalog.showResults} ({filtered.length})
          </button>
        </aside>

        <div className="catalog-results">
          <div className="catalog-meta">
            <button
              type="button"
              className="btn btn--secondary btn--sm filter-toggle"
              aria-expanded={panelOpen}
              aria-controls="catalog-filters"
              onClick={() => setPanelOpen((open) => !open)}
            >
              <IconFilter size={18} />
              {t.catalog.filters}
              {activeCount > 0 && <span className="filter-toggle__count">{activeCount}</span>}
            </button>
            <span aria-live="polite" className="catalog-meta__found">
              {t.catalog.found}: {filtered.length}
            </span>
            {hasFilters && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>
                {t.catalog.reset}
              </button>
            )}
            <div className="catalog-meta__sort">
              <FilterSelect
                label={t.catalog.sort}
                value={sort}
                onChange={(value) => update({ sort: value === 'popular' ? null : value })}
                options={[
                  { value: 'popular', label: t.catalog.sortPopular },
                  { value: 'price-asc', label: t.catalog.sortPriceAsc },
                  { value: 'price-desc', label: t.catalog.sortPriceDesc },
                ]}
              />
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="product-grid">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <span className="empty__icon">
                <IconSearch size={36} />
              </span>
              <div className="empty__title">{t.catalog.empty}</div>
              <p className="empty__hint">{t.catalog.emptyHint}</p>
              <button type="button" className="btn btn--secondary empty__cta" onClick={reset}>
                {t.catalog.reset}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function CatalogView() {
  return (
    <Suspense fallback={<div className="container page-head" />}>
      <CatalogViewInner />
    </Suspense>
  )
}
