'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { categories, type CategoryId } from '@/data/categories'
import { brands, products } from '@/data/products'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { buildCatalogHref } from '@/lib/links'
import { ProductCard } from '@/components/ProductCard'
import { IconSearch } from '@/components/Icons'

type SortKey = 'popular' | 'price-asc' | 'price-desc'

const SORTS: SortKey[] = ['popular', 'price-asc', 'price-desc']

function parseCat(value: string | null): CategoryId | 'all' {
  if (value && categories.some((c) => c.id === value)) return value as CategoryId
  return 'all'
}

function parseSort(value: string | null): SortKey {
  return SORTS.includes(value as SortKey) ? (value as SortKey) : 'popular'
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').trim()
}

function CatalogViewInner() {
  const { t, lang } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL — единственный источник состояния фильтров. Назад/вперёд, reload
  // и ссылки категорий восстанавливают видимые результаты.
  const q = searchParams.get('q') ?? ''
  const cat = parseCat(searchParams.get('cat'))
  const brand = searchParams.get('brand') ?? 'all'
  const sort = parseSort(searchParams.get('sort'))

  // Локальное значение поля поиска — только для ввода; в URL уходит с задержкой.
  const [input, setInput] = useState(q)
  useEffect(() => {
    setInput(q)
  }, [q])

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

  const filtered = useMemo(() => {
    const needle = normalize(q)
    let list = products.filter((p) => {
      if (cat !== 'all' && p.categoryId !== cat) return false
      if (brand !== 'all' && p.brand !== brand) return false
      if (needle) {
        const haystack = normalize(`${p.nameRu} ${p.nameKy} ${p.brand} ${p.descRu} ${p.descKy}`)
        if (!haystack.includes(needle)) return false
      }
      return true
    })
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price)
    else if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price)
    else
      list = [...list].sort((a, b) => {
        const rank = (badge?: string) => (badge === 'hit' ? 0 : badge === 'new' ? 1 : 2)
        return rank(a.badge) - rank(b.badge)
      })
    return list
  }, [q, cat, brand, sort])

  const hasFilters = Boolean(q) || cat !== 'all' || brand !== 'all' || sort !== 'popular'

  const reset = () => {
    setInput('')
    router.push(buildCatalogHref(lang, {}), { scroll: false })
  }

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

          <div className="catalog-toolbar">
            <label className="select-field">
              <span className="select-field__label">{t.catalog.brand}</span>
              <select value={brand} onChange={(e) => update({ brand: e.target.value || null })}>
                <option value="all">{t.catalog.brandAll}</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label className="select-field">
              <span className="select-field__label">{t.catalog.sort}</span>
              <select
                value={sort}
                onChange={(e) => update({ sort: e.target.value === 'popular' ? null : e.target.value })}
              >
                <option value="popular">{t.catalog.sortPopular}</option>
                <option value="price-asc">{t.catalog.sortPriceAsc}</option>
                <option value="price-desc">{t.catalog.sortPriceDesc}</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="catalog-meta">
        <span aria-live="polite">
          {t.catalog.found}: {filtered.length}
        </span>
        {hasFilters && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>
            {t.catalog.reset}
          </button>
        )}
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
  )
}

export function CatalogView() {
  return (
    <Suspense fallback={<div className="container page-head" />}>
      <CatalogViewInner />
    </Suspense>
  )
}
