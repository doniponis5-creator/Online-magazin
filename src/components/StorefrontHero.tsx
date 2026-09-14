'use client'

import { useMemo } from 'react'
import { Hero3D } from './Hero3D'
import { I18nProvider, useI18n } from '@/lib/i18n/I18nProvider'

/** Тексты новой витрины отделены от незавершённой логики анимации TASK_05. */
export function StorefrontHero() {
  const { t, lang } = useI18n()
  const dictionary = useMemo(() => ({
    ...t,
    hero: {
      ...t.hero,
      badge: '',
      title: lang === 'ky' ? 'Үйүңүзгө ылайыктуу техника' : 'Техника, с которой дома лучше',
      subtitle: lang === 'ky' ? 'Өзүңүз жана жакындарыңыз үчүн тандаңыз.' : 'Выбирайте для себя и близких.',
      scrollHint: lang === 'ky' ? 'LG F4X5ES5SB · Ар тараптан караңыз' : 'LG F4X5ES5SB · Рассмотрите со всех сторон',
      frontLabel: 'LG F4X5ES5SB',
      frontNote: 'AI DD · 11 кг · ThinQ',
      finalNote: lang === 'ky' ? 'Үйүңүз үчүн ыңгайлуу тандоо.' : 'Найдите технику для вашего дома.',
      cta: lang === 'ky' ? 'Үй техникасын көрүү' : 'Выбрать технику для дома',
    },
  }), [t, lang])
  return <I18nProvider lang={lang} dict={dictionary}><Hero3D /></I18nProvider>
}
