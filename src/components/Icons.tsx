import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 24, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  }
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  )
}

export function IconHeart(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 20.3 4.9 13a4.7 4.7 0 0 1 0-6.6 4.5 4.5 0 0 1 6.5 0l.6.6.6-.6a4.5 4.5 0 0 1 6.5 0 4.7 4.7 0 0 1 0 6.6Z" />
    </svg>
  )
}

export function IconHeartFilled(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M12 20.3 4.9 13a4.7 4.7 0 0 1 0-6.6 4.5 4.5 0 0 1 6.5 0l.6.6.6-.6a4.5 4.5 0 0 1 6.5 0 4.7 4.7 0 0 1 0 6.6Z" />
    </svg>
  )
}

export function IconCart(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 5h2l2.2 10.4a1.6 1.6 0 0 0 1.6 1.3h7.6a1.6 1.6 0 0 0 1.6-1.2L20.6 9H6.4" />
      <circle cx="10.2" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="17.2" cy="20" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconHome(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m4 11 8-7 8 7" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  )
}

export function IconGrid(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
    </svg>
  )
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

export function IconChevronLeft(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  )
}

export function IconTruck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 6h11v10H3z" />
      <path d="M14 9h4l3 3v4h-7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </svg>
  )
}

export function IconCard(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5.5" width="18" height="13" rx="3" />
      <path d="M3 10h18" />
      <path d="M7 14.5h4" />
    </svg>
  )
}

export function IconShield(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5 5 6v5.2c0 4.4 3 8.1 7 9.3 4-1.2 7-4.9 7-9.3V6Z" />
      <path d="m9.2 12 2 2 3.6-3.8" />
    </svg>
  )
}

export function IconHeadset(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 13a8 8 0 0 1 16 0" />
      <rect x="3" y="13" width="4.5" height="6" rx="2" />
      <rect x="16.5" y="13" width="4.5" height="6" rx="2" />
      <path d="M19 19a3 3 0 0 1-3 3h-2" />
    </svg>
  )
}

export function IconGift(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="10" width="16" height="4" rx="1" />
      <path d="M6 14v6h12v-6" />
      <path d="M12 10v10" />
      <path d="M12 10S10.5 4 8 4a2.2 2.2 0 0 0 0 6Zm0 0s1.5-6 4-6a2.2 2.2 0 0 1 0 6Z" />
    </svg>
  )
}

export function IconMoon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 6.5h15" />
      <path d="M9 6V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8V6.5" />
      <path d="M6.5 6.5 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-12.5" />
      <path d="M10 10.5v6M14 10.5v6" />
    </svg>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  )
}

export function IconMinus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5.5 12h13" />
    </svg>
  )
}

export function IconMapPin(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  )
}

export function IconPhone(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.8 3.5h3l1.4 4-2 1.4a12.5 12.5 0 0 0 5.9 5.9l1.4-2 4 1.4v3a1.8 1.8 0 0 1-2 1.8A16.5 16.5 0 0 1 5 6.5a1.8 1.8 0 0 1 1.8-3Z" />
    </svg>
  )
}

export function IconUser(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  )
}

export function IconFilter(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  )
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

/** «Поделиться» — стрелка из коробки, как на iPhone: этот знак покупатели узнают сразу. */
export function IconShare(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
    </svg>
  )
}

/*
 * Знак Telegram — основной канал кода входа. Нарисован фирменным цветом
 * и намеренно не подчиняется currentColor: узнаваемость тут важнее палитры.
 */

export function IconTelegram({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <circle cx="12" cy="12" r="12" fill="#2AABEE" />
      <path
        d="M5.6 11.9c3.6-1.6 6-2.6 7.2-3.1 3.4-1.4 4.1-1.7 4.6-1.7.1 0 .3 0 .5.1.1.1.2.2.2.4v.4c-.2 1.8-.9 6.2-1.3 8.2-.2.9-.5 1.2-.8 1.2-.7.1-1.2-.4-1.9-.8-1-.7-1.6-1.1-2.6-1.8-1.1-.8-.4-1.2.2-1.9.2-.2 2.9-2.6 2.9-2.8 0-.1 0-.1-.1-.1h-.2c-.1.1-1.9 1.3-5.4 3.6-.5.3-1 .5-1.4.5-.5 0-1.3-.2-2-.4-.8-.3-1.4-.4-1.3-.9 0-.3.4-.6 1.4-.9Z"
        fill="#fff"
      />
    </svg>
  )
}


/*
 * Знак WhatsApp — второй способ написать в магазин. Как и Telegram, нарисован
 * фирменным цветом и не подчиняется currentColor: его узнают по зелёному.
 */

export function IconWhatsApp({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <circle cx="12" cy="12" r="12" fill="#25D366" />
      <path
        d="M17.07 14.13c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.17-1.34-.8-.72-1.34-1.6-1.5-1.87-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.44-.46-.61-.47h-.52c-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.27s.98 2.63 1.11 2.81c.14.18 1.92 2.93 4.65 4.11.65.28 1.16.45 1.55.58.65.21 1.25.18 1.72.11.52-.08 1.6-.65 1.83-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.32Z"
        fill="#fff"
      />
      <path
        d="M12 5.4a6.6 6.6 0 0 0-5.6 10.1l-.7 2.5 2.6-.68A6.6 6.6 0 1 0 12 5.4Z"
        stroke="#fff"
        strokeWidth="1.1"
        fill="none"
      />
    </svg>
  )
}

/*
 * Знак Instagram — там у магазина 73 тысячи подписчиков, это витрина не хуже
 * сайта. Фирменный перелив, а не currentColor: его узнают по цвету.
 */

export function IconInstagram({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <defs>
        <linearGradient id="ig-grad" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FEDA75" />
          <stop offset="0.35" stopColor="#FA7E1E" />
          <stop offset="0.6" stopColor="#D62976" />
          <stop offset="0.85" stopColor="#962FBF" />
          <stop offset="1" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="7" fill="url(#ig-grad)" />
      <rect x="6" y="6" width="12" height="12" rx="4" stroke="#fff" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.9" stroke="#fff" strokeWidth="1.7" />
      <circle cx="17.1" cy="6.9" r="1.05" fill="#fff" />
    </svg>
  )
}

/** Витрина магазина — метка «только в магазине» у рассрочки. */
export function IconStore(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 9.5V20h16V9.5" />
      <path d="M3 9.5 4.8 4.5h14.4L21 9.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z" />
      <path d="M9.8 20v-5.2h4.4V20" />
    </svg>
  )
}

/** Стрелка «уходим на другой сайт» — как в кнопке «Выбрать технику». */
export function IconArrowUpRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  )
}

/** Стрелка вниз — подсказка «листайте дальше». */
export function IconArrowDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14" />
      <path d="m6 13 6 6 6-6" />
    </svg>
  )
}

/** Часы — рядом с обратным отсчётом акции. */
export function IconClock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  )
}

/**
 * Круглосуточно: циферблат, разомкнутый сверху, и стрелка, которая идёт по
 * кругу дальше. Для блока «Заказ 24/7» — луна там говорила про ночь, а заказ
 * принимается в любое время суток.
 */
export function IconClock24(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M19.1 7.9A8.2 8.2 0 1 1 12 3.8" />
      <path d="M10.7 2.5 12 3.8l-1.3 1.3" />
      <path d="M12 7.8V12l2.9 1.7" />
    </svg>
  )
}

export function IconCamera(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8.5a2 2 0 0 1 2-2h2.2l1.3-2h5l1.3 2H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  )
}

/** Звезда оценки. filled — закрашенная. */
export function IconStar({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(props)} fill={filled ? 'currentColor' : 'none'}>
      <path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z" />
    </svg>
  )
}
