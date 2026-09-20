import { describe, expect, it } from 'vitest'
import { onlyExisting } from '@/lib/favorites/FavoritesProvider'
import { products } from '@/data/products'

/**
 * Значок «Избранное» показывал 1, а страница была пустая: товар сохранили,
 * потом его скрыли в 1С. Счётчик обязан считать только то, что человек увидит.
 */
describe('избранное: только существующие товары', () => {
  it('выбрасывает товары, которых больше нет в каталоге', () => {
    expect(onlyExisting(['нет-такого-товара'])).toEqual([])
  })

  it('оставляет товар, который есть в каталоге', () => {
    const id = products[0].id
    expect(onlyExisting([id, 'нет-такого-товара'])).toEqual([id])
  })
})
