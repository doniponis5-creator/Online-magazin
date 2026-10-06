'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { onlyExisting } from '@/lib/favorites/FavoritesProvider'

/**
 * Сравнение товаров (владелец 06.10): покупатель отмечает до четырёх товаров и видит их рядом,
 * таблицей. Список живёт в браузере покупателя, как «Избранное»: localStorage, другие вкладки — через storage.
 */
const STORAGE_KEY = 'sc-compare-v1'
export const COMPARE_MAX = 4

type CompareContextValue = {
  ids: string[]
  hydrated: boolean
  has: (productId: string) => boolean
  /** добавить или убрать; false — список полон (COMPARE_MAX), товар не добавлен */
  toggle: (productId: string) => boolean
  remove: (productId: string) => void
  clear: () => void
}

const CompareContext = createContext<CompareContextValue | null>(null)

/** Только строки, только существующие товары, без повторов, не больше COMPARE_MAX. */
export function cleanCompare(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const ids = onlyExisting(value.filter((v): v is string => typeof v === 'string'))
  return [...new Set(ids)].slice(0, COMPARE_MAX)
}

function readStorage(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? cleanCompare(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

export function CompareProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setIds(readStorage())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    } catch {
      // хранилище недоступно — список живёт до перезагрузки
    }
  }, [ids, hydrated])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      try {
        setIds(e.newValue ? cleanCompare(JSON.parse(e.newValue)) : [])
      } catch {
        setIds([])
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggle = useCallback(
    (productId: string) => {
      if (ids.includes(productId)) {
        setIds((prev) => prev.filter((id) => id !== productId))
        return true
      }
      if (ids.length >= COMPARE_MAX) return false
      setIds((prev) => (prev.includes(productId) ? prev : [...prev, productId].slice(0, COMPARE_MAX)))
      return true
    },
    [ids],
  )

  const remove = useCallback((productId: string) => setIds((prev) => prev.filter((id) => id !== productId)), [])
  const clear = useCallback(() => setIds([]), [])

  const value = useMemo<CompareContextValue>(
    () => ({ ids, hydrated, has: (productId: string) => ids.includes(productId), toggle, remove, clear }),
    [ids, hydrated, toggle, remove, clear],
  )

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
}

export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext)
  if (!ctx) throw new Error('useCompare must be used inside CompareProvider')
  return ctx
}
