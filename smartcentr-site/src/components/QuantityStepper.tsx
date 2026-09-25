'use client'

import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconMinus, IconPlus } from './Icons'

export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  ariaLabel,
}: {
  value: number
  min?: number
  max: number
  onChange: (next: number) => void
  ariaLabel: string
}) {
  const { t } = useI18n()
  return (
    <span className="stepper" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className="stepper__btn"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="−"
      >
        <IconMinus size={18} />
      </button>
      <span className="stepper__value" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="stepper__btn"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="+"
        title={value >= max ? t.cart.maxStock : undefined}
      >
        <IconPlus size={18} />
      </button>
    </span>
  )
}
