'use client'

import { useCallback, useEffect, useState } from 'react'

/** Порядок витрины: функция, которая переставляет товары списка. */
export type Order = <T>(items: T[]) => T[]

/**
 * Перемешивание по числу-зерну: одно зерно — всегда один и тот же порядок.
 * Без зерна баннер распродажи, который перерисовывается каждые 6 секунд,
 * тасовал бы карточки соседних витрин заново на каждом шаге.
 */
export function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const out = [...items]
  let state = seed >>> 0
  // mulberry32: короткий генератор с хорошим разбросом, для витрины хватает
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Свой порядок товаров на каждое открытие страницы (владелец, 01.10.2026):
 * блоки главной стоят на месте, а товары в них меняются местами.
 *
 * Первая отрисовка — в исходном порядке, как её собрал сервер: иначе страница
 * не совпала бы с серверной разметкой. Сразу после загрузки — перемешивание.
 */
export function useShuffle(): Order {
  const [seed, setSeed] = useState(0)
  useEffect(() => {
    setSeed(1 + Math.floor(Math.random() * 0x7fffffff))
  }, [])
  return useCallback(<T>(items: T[]) => (seed ? shuffleWithSeed(items, seed) : items), [seed]) as Order
}
