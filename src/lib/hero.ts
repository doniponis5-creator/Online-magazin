/** Варианты анимации баннера на главной. Те же коды хранит сервер (SITE_HERO_VARIANT). */
export const HERO_VARIANTS = ['classic', 'reveal', 'glow', 'kitchens'] as const
export type HeroVariant = (typeof HERO_VARIANTS)[number]
/**
 * Сервер не ответил, прислал незнакомое или владелец ещё не выбрал — прежняя сцена.
 * Так выкладка сайта сама ничего не меняет: новый баннер включают только из 1С.
 */
export const HERO_FALLBACK: HeroVariant = 'classic'

export function asHeroVariant(value: unknown): HeroVariant {
  return (HERO_VARIANTS as readonly unknown[]).includes(value) ? (value as HeroVariant) : HERO_FALLBACK
}
