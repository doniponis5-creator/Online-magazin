'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { getProduct } from '@/data/products'

const STORAGE_KEY = 'sc-favorites-v1'

/**
 * Оставляем только те товары, которые есть в каталоге сейчас.
 *
 * Иначе бывает так: покупатель сохранил товар, владелец скрыл его в 1С — и на
 * значке висит «1», а страница «Избранное» пустая. Счётчик обязан показывать
 * ровно то, что человек увидит, открыв страницу.
 */
export function onlyExisting(ids: string[]): string[] {
  return ids.filter((id) => Boolean(getProduct(id)))
}

type FavoritesContextValue = {
  ids: string[]
  hydrated: boolean
  has: (productId: string) => boolean
  toggle: (productId: string) => void
  clear: () => void
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

function readStorage(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return onlyExisting(parsed.filter((v): v is string => typeof v === 'string'))
  } catch {
    return []
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
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
      // storage unavailable — keep in memory
    }
  }, [ids, hydrated])

  // Синхронизация между вкладками: storage приходит только из ДРУГИХ вкладок,
  // поэтому цикла записи не возникает. Восстанавливаем только валидные id.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      let parsed: unknown = null
      try {
        parsed = e.newValue ? JSON.parse(e.newValue) : null
      } catch {
        parsed = null
      }
      if (Array.isArray(parsed)) {
        setIds(onlyExisting(parsed.filter((v): v is string => typeof v === 'string')))
      } else {
        setIds([])
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggle = useCallback((productId: string) => {
    setIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
    )
  }, [])

  const clear = useCallback(() => setIds([]), [])

  const value = useMemo<FavoritesContextValue>(
    () => ({
      ids,
      hydrated,
      has: (productId: string) => ids.includes(productId),
      toggle,
      clear,
    }),
    [ids, hydrated, toggle, clear],
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider')
  return ctx
}
