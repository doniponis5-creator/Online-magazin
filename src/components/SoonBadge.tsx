'use client'

import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconClock } from './Icons'

/**
 * «Скоро» — товар на предзаказе. Одна наклейка для карточки, ленты товаров и
 * подборок на главной: белая с синим, как точка «Скоро в продаже» на странице
 * товара. Часы отличают её от голубой «Новинки», с которой она часто стоит рядом.
 */
export function SoonBadge() {
  const { t } = useI18n()
  return (
    <span className="badge badge--soon">
      <IconClock size={12} strokeWidth={2.4} />
      {t.catalog.badgeSoon}
    </span>
  )
}
