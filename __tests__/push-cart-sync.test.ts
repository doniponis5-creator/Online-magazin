import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Корзина из приложения доезжает до сервера — чтобы напомнить о забытых товарах.
 * Проверяем снаружи: что и когда уходит в POST /api/push/cart.
 * Приложение подменяем тем, что оно кладёт в окно (Capacitor); сеть — записью запросов.
 * У модуля есть состояние (последний отправленный снимок, вход), поэтому грузим его заново на каждый случай.
 */
let sync: typeof import('@/lib/native/cartSync')
const sent: { url: string; body: unknown }[] = []
// Как ответит сайт: код ответа или 'down' — сети нет.
let answer: number | 'down' = 200

function app(native = true) {
  vi.stubGlobal('window', { Capacitor: { isNativePlatform: () => native, getPlatform: () => 'android' } })
}

beforeEach(async () => {
  vi.useFakeTimers()
  sent.length = 0
  answer = 200
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (answer === 'down') throw new TypeError('Failed to fetch')
    sent.push({ url, body: JSON.parse(String(init?.body)) })
    return new Response(null, { status: answer })
  })
  vi.resetModules()
  sync = await import('@/lib/native/cartSync')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const PHONE_CASE = { items: ['Смартфон Aura X5'], count: 1, total: 25990 }
const KETTLE = { items: ['Чайник'], count: 1, total: 1990 }

describe('отправка снимка корзины', () => {
  it('в браузере не уходит ничего', async () => {
    vi.stubGlobal('window', {})
    sync.cartChanged(PHONE_CASE)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(sent).toEqual([])
  })

  it('в приложении — через 5 секунд после изменения, одним запросом', async () => {
    app()
    sync.cartChanged(PHONE_CASE)
    await vi.advanceTimersByTimeAsync(4_900)
    expect(sent).toEqual([])
    await vi.advanceTimersByTimeAsync(100)
    expect(sent).toEqual([{ url: '/api/push/cart', body: PHONE_CASE }])
  })

  it('частые нажатия — один запрос с последним состоянием', async () => {
    app()
    sync.cartChanged(PHONE_CASE)
    await vi.advanceTimersByTimeAsync(2_000)
    sync.cartChanged(KETTLE)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(sent.map((s) => s.body)).toEqual([KETTLE])
  })

  it('тот же снимок второй раз подряд не уходит', async () => {
    app()
    sync.cartChanged(PHONE_CASE)
    await vi.advanceTimersByTimeAsync(5_000)
    sync.cartChanged({ ...PHONE_CASE, items: [...PHONE_CASE.items] })
    await vi.advanceTimersByTimeAsync(5_000)
    expect(sent).toHaveLength(1)
  })

  it('пустая корзина — тоже снимок', async () => {
    app()
    sync.cartChanged(PHONE_CASE)
    await vi.advanceTimersByTimeAsync(5_000)
    sync.cartChanged({ items: [], count: 0, total: 0 })
    await vi.advanceTimersByTimeAsync(5_000)
    expect(sent.map((s) => s.body)).toEqual([PHONE_CASE, { items: [], count: 0, total: 0 }])
  })

  it('без входа (сайт ответил 401) — дальше молчим; после входа снимок уходит сразу', async () => {
    app()
    answer = 401
    sync.cartChanged(PHONE_CASE)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(sent).toHaveLength(1) // один раз узнали, что входа нет
    sync.cartChanged(KETTLE)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(sent).toHaveLength(1)

    answer = 200
    sync.cartSignedIn()
    await vi.advanceTimersByTimeAsync(0)
    expect(sent.map((s) => s.body)).toEqual([PHONE_CASE, KETTLE])
  })

  it('«Кабинет» знает, что входа нет, — не уходит ни одного запроса', async () => {
    app()
    sync.cartSignedOut()
    sync.cartChanged(PHONE_CASE)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(sent).toEqual([])
  })

  it('повторное открытие «Кабинета» при входе не шлёт тот же снимок заново', async () => {
    app()
    sync.cartChanged(PHONE_CASE)
    await vi.advanceTimersByTimeAsync(5_000)
    sync.cartSignedIn()
    sync.cartSignedIn()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(sent).toHaveLength(1)
  })

  it('вход сразу после изменения — не ждём 5 секунд', async () => {
    app()
    sync.cartChanged(PHONE_CASE)
    sync.cartSignedIn()
    await vi.advanceTimersByTimeAsync(0)
    expect(sent).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(sent).toHaveLength(1)
  })

  it('сети нет — молча; следующее изменение отправит снимок', async () => {
    app()
    answer = 'down'
    sync.cartChanged(PHONE_CASE)
    await vi.advanceTimersByTimeAsync(5_000)
    answer = 200
    sync.cartChanged(PHONE_CASE)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(sent.map((s) => s.body)).toEqual([PHONE_CASE])
  })
})

describe('cartSnapshot()', () => {
  const products = [
    { id: 'k', nameRu: 'Чайник', price: 1990, variants: [{ id: 'w', stock: 9 }] },
    { id: 'i', nameRu: 'Утюг', price: 3500, variants: [{ id: 'w', stock: 9 }] },
    { id: 'f', nameRu: 'Фен', price: 2400, variants: [{ id: 'w', stock: 9 }] },
    { id: 't', nameRu: 'Тостер', price: 2100, variants: [{ id: 'w', stock: 9 }] },
  ]

  it('первые три названия, число позиций и сумма', () => {
    const lines = ['k', 'i', 'f', 't'].map((id) => ({ productId: id, variantId: 'w', qty: id === 'k' ? 2 : 1 }))
    // 1990×2 + 3500 + 2400 + 2100 = 11980; позиций 4 (чайник — одна позиция, хоть и две штуки)
    expect(sync.cartSnapshot(lines, products)).toEqual({ items: ['Чайник', 'Утюг', 'Фен'], count: 4, total: 11980 })
  })

  it('пустая корзина', () => {
    expect(sync.cartSnapshot([], products)).toEqual({ items: [], count: 0, total: 0 })
  })
})
