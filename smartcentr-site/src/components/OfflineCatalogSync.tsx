'use client'

import { useEffect } from 'react'
import { syncOfflineCatalog } from '@/lib/native/catalog'

/**
 * Пока у человека есть связь, кладём каталог в память телефона.
 *
 * Работает только внутри приложения для телефона и не чаще раза в несколько
 * часов. В браузере не делает ничего.
 *
 * Ждём, пока страница освободится: снимок каталога — не то, ради чего стоит
 * задерживать открытие витрины.
 */
export function OfflineCatalogSync() {
  useEffect(() => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback
    const run = () => {
      void syncOfflineCatalog()
    }
    const timer = idle ? idle(run) : window.setTimeout(run, 3000)
    return () => {
      if (!idle) window.clearTimeout(timer)
    }
  }, [])

  return null
}
