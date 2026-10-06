'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useCompare } from '@/lib/compare/CompareProvider'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconCompare } from './Icons'
import './compare.css'

/**
 * Значок «Сравнить» рядом с сердечком (та же форма и те же состояния, что у «Избранного»).
 * Список полон — кнопка не молчит: под ней на 3 секунды подсказка «до 4 товаров».
 */
export function CompareButton({ productId }: { productId: string }) {
  const { t } = useI18n()
  const compare = useCompare()
  const [full, setFull] = useState(false)
  const active = compare.has(productId)
  const label = active ? t.compare.remove : t.compare.add

  return (
    <span className="compare-btn">
      <button
        type="button"
        className={`fav-btn${active ? ' is-active' : ''}`}
        aria-pressed={active}
        aria-label={label}
        title={label}
        onClick={() => {
          if (compare.toggle(productId)) return
          setFull(true)
          window.setTimeout(() => setFull(false), 3000)
        }}
      >
        <IconCompare size={21} />
      </button>
      {full && (
        <span className="compare-btn__note" role="status">
          {t.compare.full}
        </span>
      )}
    </span>
  )
}

/** Ссылка на страницу сравнения со счётчиком; пустой список — ссылки нет. */
export function CompareLink({ className = '' }: { className?: string }) {
  const { t, lang } = useI18n()
  const compare = useCompare()
  if (!compare.hydrated || compare.ids.length === 0) return null
  return (
    <Link href={`/${lang}/compare`} className={`compare-link ${className}`.trim()}>
      <IconCompare size={18} />
      {t.compare.open} ({compare.ids.length})
    </Link>
  )
}
