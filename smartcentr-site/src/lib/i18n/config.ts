export const languages = ['ru', 'ky'] as const

export type Lang = (typeof languages)[number]

export const defaultLang: Lang = 'ru'

export function isLang(value: string): value is Lang {
  return (languages as readonly string[]).includes(value)
}

/** Language shown for the other locale switcher */
export const otherLang: Record<Lang, Lang> = { ru: 'ky', ky: 'ru' }
