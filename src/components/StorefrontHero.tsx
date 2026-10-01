'use client'

import { useEffect, useState } from 'react'
import { HomeStory } from './HomeStory'
import { HomeStoryReveal } from './HomeStoryReveal'
import { HomeStoryKitchens } from './HomeStoryKitchens'
import { HERO_VARIANTS, type HeroVariant } from '@/lib/hero'

/**
 * Главная витрина: сцена «Дом просыпается». Какую анимацию показать, владелец
 * выбирает в 1С («Панель сайта» → «Анимация баннера»), страница передаёт выбор сюда.
 * 'classic' — прежняя, запасная; 'reveal' — окно и точки на технике; 'glow' — утро → вечер;
 * 'kitchens' — готовые 3D-кухни раскрываются веером.
 */
export function StorefrontHero({ variant }: { variant: HeroVariant }) {
  const [shown, setShown] = useState(variant)
  useEffect(() => {
    // Только на компьютере разработчика: ?hero=glow — посмотреть вариант, не трогая 1С.
    if (process.env.NODE_ENV !== 'development') return
    const asked = new URLSearchParams(location.search).get('hero')
    if (asked && (HERO_VARIANTS as readonly string[]).includes(asked)) setShown(asked as HeroVariant)
  }, [])
  if (shown === 'classic') return <HomeStory />
  if (shown === 'kitchens') return <HomeStoryKitchens />
  return <HomeStoryReveal key={shown} mode={shown} />
}
