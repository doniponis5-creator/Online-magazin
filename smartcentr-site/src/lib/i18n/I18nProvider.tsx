'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Lang } from './config'
import type { Dict } from './dictionaries'

type I18nValue = { lang: Lang; t: Dict }

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({
  lang,
  dict,
  children,
}: {
  lang: Lang
  dict: Dict
  children: ReactNode
}) {
  const value = useMemo(() => ({ lang, t: dict }), [lang, dict])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
