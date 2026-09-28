import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Нажатие на «Скидку» или «Новинку» из 1С открывает страницу товара из `data.url`
 * на языке, который выбрал покупатель. Чужие и странные адреса не открываем — ведём на главную.
 * Подменяем то, что приложение кладёт в окно: Capacitor, плагин уведомлений и адрес страницы.
 * У push.ts есть состояние (слушатели ставятся один раз), поэтому грузим модуль заново на каждый случай.
 */
type Handler = (data: unknown) => void
let push: typeof import('@/lib/native/push')
let handlers: Record<string, Handler[]>
let assign: ReturnType<typeof vi.fn>

function app(pathname: string) {
  handlers = {}
  assign = vi.fn()
  const plugin = {
    checkPermissions: async () => ({ receive: 'granted' }),
    requestPermissions: async () => ({ receive: 'granted' }),
    register: async () => undefined,
    addListener: async (event: string, handler: Handler) => {
      ;(handlers[event] ??= []).push(handler)
      return { remove: async () => undefined }
    },
  }
  vi.stubGlobal('window', {
    Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { PushNotifications: plugin } },
    location: { pathname, assign },
  })
  push.listenPushTaps()
}

/** Покупатель нажал на уведомление с такими данными. */
function tap(data: Record<string, unknown>) {
  for (const handler of handlers.pushNotificationActionPerformed ?? []) {
    handler({ actionId: 'tap', notification: { id: '1', data } })
  }
}

beforeEach(async () => {
  vi.resetModules()
  push = await import('@/lib/native/push')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('нажатие на «Скидку» / «Новинку»', () => {
  it('открывает страницу товара на том же языке', () => {
    app('/ru/catalog/phones')
    tap({ type: 'promo', url: '/ru/product/cb-00001234' })
    expect(assign.mock.calls).toEqual([['/ru/product/cb-00001234']])
  })

  it('покупатель на кыргызском — сервер прислал русский адрес, открываем кыргызский', () => {
    app('/ky/cart')
    tap({ type: 'promo', url: '/ru/product/cb-00001234' })
    expect(assign.mock.calls).toEqual([['/ky/product/cb-00001234']])
  })

  it('кыргызский адрес у русского покупателя — открываем русский', () => {
    app('/ru')
    tap({ type: 'promo', url: '/ky/catalog/phones/' })
    expect(assign.mock.calls).toEqual([['/ru/catalog/phones/']])
  })

  it('адрес — только язык: открываем главную на текущем языке', () => {
    app('/ky/account')
    tap({ type: 'promo', url: '/ru' })
    expect(assign.mock.calls).toEqual([['/ky']])
  })

  it('знаки %, точка, тильда и дефис в адресе товара — можно', () => {
    app('/ru')
    tap({ type: 'promo', url: '/ru/product/tv-lg_55.v2~new%20a' })
    expect(assign.mock.calls).toEqual([['/ru/product/tv-lg_55.v2~new%20a']])
  })

  it('«Свой текст» без адреса — главная на текущем языке', () => {
    app('/ky/product/aura-x5')
    tap({ type: 'promo' })
    expect(assign.mock.calls).toEqual([['/ky']])
  })

  it('язык не понять по адресу — главная на русском', () => {
    app('/')
    tap({ type: 'promo', url: '' })
    expect(assign.mock.calls).toEqual([['/ru']])
  })

  it.each([
    ['чужой сайт', 'https://evil.com'],
    ['чужой сайт без схемы', '//evil.com'],
    ['чужой сайт после языка', '/ru//evil.com'],
    ['выход наверх', '/ru/../x'],
    ['выход наверх в кодировке', '/ru/%2e%2e/x'],
    ['точка вместо части', '/ru/./product'],
    ['другой язык', '/en/x'],
    ['без языка', '/product/cb-00001234'],
    ['язык без косой черты', '/rux/product'],
    ['обратная косая', '/ru\\evil.com'],
    ['javascript:', 'javascript:alert(1)'],
    ['с вопросом', '/ru/product/x?next=//evil.com'],
    ['пробел', '/ru/product/a b'],
    ['число', 42],
    ['объект', { url: '/ru/product/x' }],
    ['null', null],
  ])('%s — не открываем, ведём на главную', (_, url) => {
    app('/ky/catalog')
    tap({ type: 'promo', url })
    expect(assign.mock.calls).toEqual([['/ky']])
  })

  it('корзина и заказы работают как раньше', () => {
    app('/ky')
    tap({ type: 'cart', url: '/ru/product/x' })
    tap({ type: 'order', orderId: 'SC-1001', url: '/ru/product/x' })
    tap({ url: '/ru/product/x' })
    expect(assign.mock.calls).toEqual([['/ky/cart']])
  })
})
