import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Нажатие на уведомление-напоминание открывает корзину на языке, который покупатель выбрал.
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
    Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: { PushNotifications: plugin } },
    location: { pathname, assign },
  })
}

/** Покупатель нажал на уведомление с такими данными. */
function tap(data: Record<string, string>) {
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

describe('нажатие на уведомление', () => {
  it('напоминание о корзине — открывает корзину на кыргызском, если покупатель на кыргызском', async () => {
    app('/ky/catalog/phones')
    push.listenPushTaps()
    tap({ type: 'cart' })
    expect(assign.mock.calls).toEqual([['/ky/cart']])
  })

  it('на русском — русская корзина', async () => {
    app('/ru/product/aura-x5')
    push.listenPushTaps()
    tap({ type: 'cart' })
    expect(assign.mock.calls).toEqual([['/ru/cart']])
  })

  it('язык не понять по адресу — корзина на русском', async () => {
    app('/')
    push.listenPushTaps()
    tap({ type: 'cart' })
    expect(assign.mock.calls).toEqual([['/ru/cart']])
  })

  it('уведомления о заказах — поведение прежнее, никуда не переходим', async () => {
    app('/ru')
    push.listenPushTaps()
    tap({ type: 'order', orderId: 'SC-1001' })
    tap({})
    expect(assign).not.toHaveBeenCalled()
  })

  it('слушатель ставится один раз — одно нажатие, один переход', async () => {
    app('/ru')
    push.listenPushTaps()
    push.listenPushTaps()
    await push.resumePush()
    tap({ type: 'cart' })
    expect(assign).toHaveBeenCalledTimes(1)
  })

  it('в браузере — ничего не ставим и не падаем', () => {
    vi.stubGlobal('window', {})
    expect(() => push.listenPushTaps()).not.toThrow()
  })
})
