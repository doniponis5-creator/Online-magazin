/**
 * Анимация баннера на главной. Владелец выбирает в 1С («Панель сайта»):
 * один вариант насовсем или «auto» — каждый день недели свой.
 * Те же коды хранит сервер (SITE_HERO_VARIANT в shop_admin.py).
 */
export const HERO_VARIANTS = ['classic', 'reveal', 'kitchens', 'word', 'shutter', 'marquee', 'collage'] as const
export type HeroVariant = (typeof HERO_VARIANTS)[number]
export const HERO_SETTINGS = ['auto', ...HERO_VARIANTS] as const
export type HeroSetting = (typeof HERO_SETTINGS)[number]
/** Пусто, мусор, старый сервер или сервер молчит — тоже «по дням». */
export const HERO_FALLBACK: HeroSetting = 'auto'

/** «auto»: понедельник … воскресенье по времени Бишкека. Семь дней — семь вариантов. */
export const HERO_WEEK: readonly HeroVariant[] = ['reveal', 'shutter', 'kitchens', 'collage', 'marquee', 'word', 'classic']
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function heroForDay(date: Date): HeroVariant {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bishkek', weekday: 'short' }).format(date)
  return HERO_WEEK[Math.max(0, WEEKDAYS.indexOf(day))]
}

export function asHeroSetting(value: unknown): HeroSetting {
  return (HERO_SETTINGS as readonly unknown[]).includes(value) ? (value as HeroSetting) : HERO_FALLBACK
}

/** Что показать сейчас: выбор владельца или вариант этого дня. */
export function resolveHero(value: unknown, date: Date = new Date()): HeroVariant {
  const setting = asHeroSetting(value)
  return setting === 'auto' ? heroForDay(date) : setting
}
