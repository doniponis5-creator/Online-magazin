'use client'

import { useFavorites } from '@/lib/favorites/FavoritesProvider'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconHeart, IconHeartFilled } from './Icons'

export function FavoriteButton({
  productId,
  variant = 'floating',
}: {
  productId: string
  variant?: 'floating' | 'plain'
}) {
  const { t } = useI18n()
  const fav = useFavorites()
  const active = fav.has(productId)
  const cls = variant === 'floating' ? 'fav-btn' : 'fav-btn fav-btn--plain'

  return (
    <button
      type="button"
      className={`${cls}${active ? ' is-active' : ''}`}
      aria-pressed={active}
      aria-label={active ? t.product.removeFavorite : t.product.addFavorite}
      title={active ? t.product.removeFavorite : t.product.addFavorite}
      onClick={() => fav.toggle(productId)}
    >
      {active ? <IconHeartFilled size={22} /> : <IconHeart size={22} />}
    </button>
  )
}
