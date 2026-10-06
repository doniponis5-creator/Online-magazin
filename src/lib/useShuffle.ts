'use client'

import { useCallback, useSyncExternalStore } from 'react'

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
 * Одно зерно на заход на сайт (владелец 06.10): покупатель увидел кофемашину, зашёл в стиральную, нажал
 * «назад» — а витрина перемешалась заново, и кофемашины уже не найти. Теперь порядок держится, пока
 * открыта вкладка (переходы внутри сайта страницу не перезагружают), и меняется только после
 * «обновить», нового открытия сайта или перезапуска приложения — тогда переменная создаётся заново.
 */
let visitSeed = 0
function seedOfVisit(): number {
  if (!visitSeed) visitSeed = 1 + Math.floor(Math.random() * 0x7fffffff)
  return visitSeed
}
const neverChanges = () => () => {}
const serverSeed = () => 0

/**
 * Свой порядок товаров на каждый заход на сайт (владелец, 01.10.2026): блоки главной стоят на
 * месте, а товары в них меняются местами; внутри захода порядок тот же (seedOfVisit).
 *
 * Первая отрисовка — в исходном порядке, как её собрал сервер: иначе страница
 * не совпала бы с серверной разметкой. Сразу после загрузки — перемешивание.
 */
export function useShuffle(): Order {
  // useSyncExternalStore сам делает то, что нужно: пока страница «оживает» после сервера — серверное
  // значение (0, исходный порядок; так и блоки, которые оживают позже, не разойдутся с разметкой), сразу
  // после — зерно захода. Вернулся на главную внутри сайта — зерно уже есть: тот же порядок, без перескока.
  const seed = useSyncExternalStore(neverChanges, seedOfVisit, serverSeed)
  return useCallback(<T>(items: T[]) => (seed ? shuffleWithSeed(items, seed) : items), [seed]) as Order
}
