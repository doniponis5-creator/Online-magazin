'use client'

import { useEffect, useState } from 'react'
import { HomeStory } from './HomeStory'
import { HomeStoryReveal } from './HomeStoryReveal'
import { HomeStoryKitchens } from './HomeStoryKitchens'
import { HERO_VARIANTS, type HeroVariant } from '@/lib/hero'

/**
 * Главная витрина. Какую анимацию показать, решает сервер по выбору владельца в 1С
 * («Панель сайта» → «Анимация баннера»: один вариант или по дням недели); страница передаёт ответ сюда.
 * 'classic' — прежняя сцена; 'kitchens' — готовые 3D-кухни; остальные — HomeStoryReveal.
 */
export function StorefrontHero({ variant }: { variant: HeroVariant }) {
  const [shown, setShown] = useState(variant)
  useEffect(() => {
    // Только на компьютере разработчика: ?hero=shutter — посмотреть вариант, не трогая 1С.
    if (process.env.NODE_ENV !== 'development') return
    const asked = new URLSearchParams(location.search).get('hero')
    if (asked && (HERO_VARIANTS as readonly string[]).includes(asked)) setShown(asked as HeroVariant)
  }, [])
  if (shown === 'classic') return <HomeStory />
  if (shown === 'kitchens') return <HomeStoryKitchens />
  return <HomeStoryReveal key={shown} mode={shown} />
}
