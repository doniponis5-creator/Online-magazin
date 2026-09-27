import { afterEach, describe, expect, it, vi } from 'vitest'
import { enablePush, pushPlatform } from '@/lib/native/push'

/**
 * Чей телефон — iPhone или Android — приложение узнаёт у Capacitor и сообщает сайту
 * вместе с адресом. Подменяем то, что приложение кладёт в окно: Capacitor и плагин уведомлений.
 */
type Handler = (data: unknown) => void

function phone(platform: string, native = true) {
  const handlers: Record<string, Handler> = {}
  const plugin = {
    checkPermissions: async () => ({ receive: 'granted' }),
    requestPermissions: async () => ({ receive: 'granted' }),
    // телефон выдаёт адрес сразу после подписки — как настоящий
    register: async () => handlers.registration?.({ value: 'телефон-адрес' }),
    addListener: async (event: string, handler: Handler) => {
      handlers[event] = handler
      return { remove: async () => undefined }
    },
  }
  vi.stubGlobal('window', {
    Capacitor: { isNativePlatform: () => native, getPlatform: () => platform, Plugins: { PushNotifications: plugin } },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pushPlatform()', () => {
  it('в приложении — платформа телефона', () => {
    phone('android')
    expect(pushPlatform()).toBe('android')
    phone('ios')
    expect(pushPlatform()).toBe('ios')
  })

  it('в браузере и на незнакомой платформе — null', () => {
    expect(pushPlatform()).toBeNull() // окна нет вовсе (сервер)
    phone('web', false)
    expect(pushPlatform()).toBeNull()
    phone('electron')
    expect(pushPlatform()).toBeNull()
  })
})

describe('адрес уходит на сайт с настоящей платформой', () => {
  it('Android сообщает android', async () => {
    phone('android')
    const posted: unknown[] = []
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      posted.push({ url, body: JSON.parse(String(init?.body)) })
      return Response.json({ ok: true })
    })
    await expect(enablePush()).resolves.toBe(true)
    await vi.waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toEqual({ url: '/api/push/device', body: { token: 'телефон-адрес', platform: 'android' } })
  })
})
