'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Счётчик посещений для «Панели сайта» в 1С: владелец видит, сколько людей
 * заходит на сайт, а не только сколько заказывает.
 *
 * Про человека ничего не собираем. В браузере лежит случайный номер, сервер
 * хранит его необратимый отпечаток: пересчитать людей можно, узнать человека
 * нельзя. Ни браузер, ни экран, ни адрес не записываются.
 *
 * Отметка уходит молча и в фоне: если счётчик не сработал, покупатель этого
 * не заметит и ничего не потеряет.
 */

const KEY = 'sc-visitor-v1'

function visitorId(): string {
  try {
    const saved = window.localStorage.getItem(KEY)
    if (saved) return saved
    const fresh = crypto.randomUUID()
    window.localStorage.setItem(KEY, fresh)
    return fresh
  } catch {
    // Приватный режим или запрещённое хранилище — этот заход просто не считаем
    return ''
  }
}

export function VisitCounter() {
  const pathname = usePathname()

  useEffect(() => {
    const visitor = visitorId()
    if (!visitor) return
    const body = JSON.stringify({ visitor, path: pathname })
    // keepalive — чтобы отметка ушла, даже если человек сразу закрыл вкладку
    fetch('/api/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // Счётчик не важнее магазина: молчим
    })
  }, [pathname])

  return null
}
