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
import {
  addItem,
  cartTotals,
  normalizeLines,
  removeLine,
  setQty,
  type CartLine,
} from './logic'
import { products as demoProducts } from '@/data/products'

const STORAGE_KEY = 'sc-cart-v1'

type CartContextValue = {
  lines: CartLine[]
  itemsCount: number
  subtotal: number
  hydrated: boolean
  /** Корзина была скорректирована при восстановлении (недоступные товары/лимиты) */
  restoreNotice: boolean
  dismissRestoreNotice: () => void
  add: (productId: string, variantId: string, qty?: number) => void
  changeQty: (productId: string, variantId: string, qty: number) => void
  remove: (productId: string, variantId: string) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [restoreNotice, setRestoreNotice] = useState(false)

  // Восстановление корзины с нормализацией: неизвестные ids, дробные/отрицательные
  // qty, дубликаты SKU и повреждённый JSON не должны ломать суммы.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw !== null) {
        let parsed: unknown = null
        try {
          parsed = JSON.parse(raw)
        } catch {
          parsed = null // повреждённый JSON — считаем изменением
        }
        const { lines: normalized, changed } = normalizeLines(parsed, demoProducts)
        setLines(normalized)
        setRestoreNotice(changed && normalized.length > 0)
      }
    } catch {
      // localStorage недоступен — корзина работает в памяти
    }
    setHydrated(true)
  }, [])

  // Запись только после hydration и без «пустой» перезаписи при первом рендере.
  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      // приватный режим — остаёмся в памяти
    }
  }, [lines, hydrated])

  // Синхронизация между вкладками: storage приходит только из ДРУГИХ вкладок,
  // поэтому цикла записи не возникает.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      let parsed: unknown = null
      try {
        parsed = e.newValue ? JSON.parse(e.newValue) : null
      } catch {
        parsed = null
      }
      const { lines: normalized } = normalizeLines(parsed, demoProducts)
      setLines(normalized)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const add = useCallback((productId: string, variantId: string, qty?: number) => {
    setLines((prev) => addItem(prev, { productId, variantId, qty }, demoProducts))
  }, [])

  const changeQty = useCallback((productId: string, variantId: string, qty: number) => {
    setLines((prev) => setQty(prev, { productId, variantId }, qty, demoProducts))
  }, [])

  const remove = useCallback((productId: string, variantId: string) => {
    setLines((prev) => removeLine(prev, { productId, variantId }))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const value = useMemo<CartContextValue>(() => {
    const totals = cartTotals(lines, demoProducts)
    return {
      lines,
      itemsCount: totals.itemsCount,
      subtotal: totals.subtotal,
      hydrated,
      restoreNotice,
      dismissRestoreNotice: () => setRestoreNotice(false),
      add,
      changeQty,
      remove,
      clear,
    }
  }, [lines, hydrated, restoreNotice, add, changeQty, remove, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
