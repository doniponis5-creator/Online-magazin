'use client'

import { useEffect, useState } from 'react'
import { HomeStory } from './HomeStory'
import { HomeStoryReveal } from './HomeStoryReveal'
import { HomeStoryKitchens } from './HomeStoryKitchens'
import { HomeStorySale } from './HomeStorySale'
import { HERO_VARIANTS, type HeroVariant } from '@/lib/hero'
import { SALE_MIN, type SaleCard } from '@/lib/hero-sale'

/**
 * Главная витрина. Какую анимацию показать, решает сервер по выбору владельца в 1С
 * («Панель сайта» → «Анимация баннера»: один вариант или по дням недели); страница передаёт ответ сюда.
 * 'classic' — прежняя сцена; 'kitchens' — готовые 3D-кухни; 'sale' — товары со скидкой; остальные — HomeStoryReveal.
 */
export function StorefrontHero({ variant, sale }: { variant: HeroVariant; sale: SaleCard[] }) {
  const [shown, setShown] = useState(variant)
  useEffect(() => {
    // Только на компьютере разработчика: ?hero=shutter — посмотреть вариант, не трогая 1С.
    if (process.env.NODE_ENV !== 'development') return
    const asked = new URLSearchParams(location.search).get('hero')
    if (asked && (HERO_VARIANTS as readonly string[]).includes(asked)) setShown(asked as HeroVariant)
  }, [])
  if (shown === 'classic') return <HomeStory />
  // скидок меньше трёх — колода не складывается, показываем «Готовые кухни в 3D»
  if (shown === 'sale' && sale.length >= SALE_MIN) return <HomeStorySale cards={sale} />
  if (shown === 'kitchens' || shown === 'sale') return <HomeStoryKitchens />
  return <HomeStoryReveal key={shown} mode={shown} />
}
