'use client'

import { useEffect } from 'react'
import type { Lang } from '@/lib/i18n/config'

/** Keeps <html lang> in sync with the active locale (root layout is shared). */
export function HtmlLang({ lang }: { lang: Lang }) {
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  return null
}
