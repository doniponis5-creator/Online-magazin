'use client'

import Link from 'next/link'
import { useFavorites } from '@/lib/favorites/FavoritesProvider'
import { getProduct } from '@/data/products'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { ProductCard } from '@/components/ProductCard'
import { IconHeart } from '@/components/Icons'

export default function FavoritesPage() {
  const { t, lang } = useI18n()
  const fav = useFavorites()

  const items = fav.ids
    .map((id) => getProduct(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  return (
    <div className="container">
      <div className="page-head">
        <h1 className="page-head__title">{t.favorites.title}</h1>
      </div>

      {!fav.hydrated ? null : items.length === 0 ? (
        <div className="empty">
          <span className="empty__icon">
            <IconHeart size={36} />
          </span>
          <div className="empty__title">{t.favorites.empty}</div>
          <p className="empty__hint">{t.favorites.emptyHint}</p>
          <Link href={`/${lang}/catalog`} className="btn btn--primary empty__cta">
            {t.favorites.toCatalog}
          </Link>
        </div>
      ) : (
        <>
          <div className="product-grid">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={fav.clear}>
              {t.favorites.clear}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
