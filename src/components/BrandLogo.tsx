import type { CSSProperties, ReactNode } from 'react'
import brandLogos from '@/data/brand-logos.json'

/**
 * Логотипы брендов витрины — собственная векторная графика проекта.
 * Знак + начертание подобраны под характер бренда; в покое логотипы
 * монохромные (спокойная стена брендов), при наведении — фирменный цвет.
 * Для бренда без описания рисуется аккуратное текстовое начертание.
 */

type LogoSpec = {
  color: string
  mark?: ReactNode
  weight?: number
  italic?: boolean
  spacing?: number
  upper?: boolean
  lower?: boolean
  /** Вторая часть названия другим весом: «Air» + «Book» */
  split?: number
}

const LOGOS: Record<string, LogoSpec> = {
  AeroChef: {
    color: '#e0572b',
    split: 4,
    mark: (
      <>
        <path d="M6 20c0-5 4-9 9-9h0c5 0 9 4 9 9v2H6z" />
        <path d="M9 11c0-3 2-5 6-5s6 2 6 5" fill="none" strokeWidth={2.2} stroke="currentColor" />
      </>
    ),
  },
  AirBook: {
    color: '#3b6fe8',
    split: 3,
    weight: 600,
    mark: <path d="M5 8h20v12H5zM2 22h26l-2 3H4z" />,
  },
  AirSound: {
    color: '#2b9fd9',
    split: 3,
    weight: 600,
    mark: (
      <path
        d="M4 15h3M9 10v10M14 6v18M19 10v10M24 13v4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    ),
  },
  Aura: {
    color: '#7b4de0',
    upper: true,
    spacing: 3,
    weight: 700,
    mark: (
      <>
        <circle cx="15" cy="15" r="11" fill="none" stroke="currentColor" strokeWidth={2.4} />
        <circle cx="15" cy="15" r="5" />
      </>
    ),
  },
  BaristaHome: {
    color: '#8a5a35',
    split: 7,
    italic: true,
    mark: <path d="M6 10h15v8a7 7 0 0 1-7 7h-1a7 7 0 0 1-7-7zM21 12h2a3 3 0 0 1 0 6h-2" />,
  },
  BoomMini: {
    color: '#e23d6d',
    split: 4,
    weight: 900,
    mark: (
      <>
        <rect x="6" y="4" width="18" height="22" rx="5" />
        <circle cx="15" cy="17" r="4.5" fill="#fff" />
      </>
    ),
  },
  CleanPure: {
    color: '#14a3a0',
    split: 5,
    weight: 600,
    mark: <path d="M15 3c5 7 8 11 8 15a8 8 0 0 1-16 0c0-4 3-8 8-15z" />,
  },
  CycloneClean: {
    color: '#2563eb',
    split: 7,
    mark: (
      <path
        d="M24 15a9 9 0 1 1-9-9M20 15a5 5 0 1 1-5-5M15 15h0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    ),
  },
  Midea: { color: '#0092d8', weight: 700, italic: true },
  Nova: {
    color: '#f0a500',
    upper: true,
    spacing: 4,
    weight: 800,
    mark: <path d="M15 2l3 10 10 3-10 3-3 10-3-10-10-3 10-3z" />,
  },
  ProWork: {
    color: '#263244',
    split: 3,
    weight: 800,
    mark: (
      <>
        <rect x="3" y="9" width="24" height="16" rx="3" />
        <path d="M11 9V6h8v3" fill="none" stroke="currentColor" strokeWidth={2.4} />
      </>
    ),
  },
  SmartView: {
    color: '#3b6fe8',
    split: 5,
    weight: 700,
    mark: (
      <>
        <rect x="2" y="5" width="26" height="17" rx="3" />
        <path d="M10 26h10" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
      </>
    ),
  },
  TabSlate: {
    color: '#4c5fd5',
    split: 3,
    weight: 700,
    mark: (
      <>
        <rect x="6" y="3" width="18" height="24" rx="3" />
        <circle cx="15" cy="23" r="1.4" fill="#fff" />
      </>
    ),
  },
  TimeFit: {
    color: '#15a05a',
    split: 4,
    weight: 800,
    italic: true,
    mark: (
      <>
        <circle cx="15" cy="15" r="11" fill="none" stroke="currentColor" strokeWidth={2.4} />
        <path d="M15 9v6l4 3" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
      </>
    ),
  },
  Vega: {
    color: '#1e2c3c',
    upper: true,
    spacing: 5,
    weight: 300,
    mark: <path d="M3 5h7l5 13 5-13h7L18 27h-6z" />,
  },
}

/**
 * Оригинальные логотипы брендов из каталога 1С (public/brands, обработаны
 * scripts/brand-logos/process.cjs: прозрачный фон, обрезка, исходные цвета).
 * Размеры — для оптического выравнивания: у всех логотипов примерно одна площадь,
 * поэтому квадратные знаки не выглядят крупнее длинных надписей.
 */
const IMAGE_LOGOS: Record<string, { src: string; w: number; h: number }> = brandLogos

export function hasBrandImage(brand: string): boolean {
  return brand.toUpperCase() in IMAGE_LOGOS
}

export function BrandLogo({ brand, className }: { brand: string; className?: string }) {
  const image = IMAGE_LOGOS[brand.toUpperCase()]
  if (image) {
    const aspect = image.w / image.h
    const height = Math.round(Math.min(52, Math.max(22, Math.sqrt(2600 / aspect))))
    const width = Math.round(Math.min(170, height * aspect))
    return (
      <span className={`brand-logo brand-logo--image${className ? ` ${className}` : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.src} alt={brand} width={width} height={Math.round(width / aspect)} loading="lazy" />
      </span>
    )
  }
  const spec = LOGOS[brand] ?? { color: 'currentColor', weight: 800 }
  const text = spec.upper ? brand.toUpperCase() : spec.lower ? brand.toLowerCase() : brand
  const first = spec.split ? text.slice(0, spec.split) : text
  const second = spec.split ? text.slice(spec.split) : ''

  return (
    <span
      className={`brand-logo${className ? ` ${className}` : ''}`}
      style={{ '--brand-color': spec.color } as CSSProperties}
      role="img"
      aria-label={brand}
    >
      {spec.mark && (
        <svg className="brand-logo__mark" viewBox="0 0 30 30" fill="currentColor" aria-hidden="true">
          {spec.mark}
        </svg>
      )}
      <span
        className="brand-logo__word"
        aria-hidden="true"
        style={{
          fontWeight: spec.weight ?? 700,
          fontStyle: spec.italic ? 'italic' : undefined,
          letterSpacing: spec.spacing ? `${spec.spacing * 0.04}em` : undefined,
        }}
      >
        {first}
        {second && <span className="brand-logo__word-light">{second}</span>}
      </span>
    </span>
  )
}
