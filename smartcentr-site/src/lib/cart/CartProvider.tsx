'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

type RestoreNotice = 'adjusted' | 'corrupted'

type CartContextValue = {
  lines: CartLine[]
  itemsCount: number
  subtotal: number
  hydrated: boolean
  /** Корзина была скорректирована/повреждена при восстановлении */
  restoreNotice: RestoreNotice | null
  dismissRestoreNotice: () => void
  add: (productId: string, variantId: string, qty?: number) => boolean
  changeQty: (productId: string, variantId: string, qty: number) => void
  remove: (productId: string, variantId: string) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const linesRef = useRef<CartLine[]>([])
  // Синхронный снимок защищает от нескольких добавлений до следующего рендера.
  const commitLines = useCallback((next: CartLine[]) => {
    linesRef.current = next
    setLines(next)
  }, [])
  const [hydrated, setHydrated] = useState(false)
  const [restoreNotice, setRestoreNotice] = useState<RestoreNotice | null>(null)

  // Восстановление корзины с нормализацией: неизвестные ids, дробные/отрицательные
  // qty, дубликаты SKU и повреждённый JSON не должны ломать суммы. Сообщение
  // показывается и когда исправлены отдельные строки, и когда удалены все,
  // и когда хранилище повреждено (флаг ошибки не теряется).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw !== null) {
        let parsed: unknown = null
        let corrupted = false
        try {
          parsed = JSON.parse(raw)
        } catch {
          corrupted = true // повреждённый JSON — отдельное понятное сообщение
        }
        const { lines: normalized, changed } = normalizeLines(parsed, demoProducts)
        commitLines(normalized)
        if (corrupted) setRestoreNotice('corrupted')
        else if (changed) setRestoreNotice('adjusted')
      }
    } catch {
      // localStorage недоступен — корзина работает в памяти
    }
    setHydrated(true)
  }, [commitLines])

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
  // поэтому цикла записи не возникает. Повторно нормализуем входящие данные.
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
      commitLines(normalized)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [commitLines])

  const add = useCallback((productId: string, variantId: string, qty?: number) => {
    const before = linesRef.current
    const next = addItem(before, { productId, variantId, qty }, demoProducts)
    const quantity = (items: CartLine[]) => items.find((line) =>
      line.productId === productId && line.variantId === variantId)?.qty ?? 0
    if (quantity(next) <= quantity(before)) return false
    commitLines(next)
    return true
  }, [commitLines])

  const changeQty = useCallback((productId: string, variantId: string, qty: number) => {
    commitLines(setQty(linesRef.current, { productId, variantId }, qty, demoProducts))
  }, [commitLines])

  const remove = useCallback((productId: string, variantId: string) => {
    commitLines(removeLine(linesRef.current, { productId, variantId }))
  }, [commitLines])

  const clear = useCallback(() => commitLines([]), [commitLines])

  const value = useMemo<CartContextValue>(() => {
    const totals = cartTotals(lines, demoProducts)
    return {
      lines,
      itemsCount: totals.itemsCount,
      subtotal: totals.subtotal,
      hydrated,
      restoreNotice,
      dismissRestoreNotice: () => setRestoreNotice(null),
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
