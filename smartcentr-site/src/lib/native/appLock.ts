/**
 * Вход по Face ID в приложении для телефона.
 *
 * После обычного входа по коду сайт выдаёт ключ, приложение прячет его в телефоне
 * под замок Face ID. Когда вход закончился, покупатель прикладывает лицо — приложение
 * достаёт ключ, сайт проверяет подпись и пускает без кода из Telegram.
 *
 * В обычном браузере ничего этого нет: функции просто возвращают «нет».
 */

type AppLockPlugin = {
  available(): Promise<{ available: boolean; kind: 'face' | 'touch' | 'passcode' | 'none' }>
  saveKey(data: { key: string }): Promise<{ ok: boolean }>
  hasKey(): Promise<{ saved: boolean }>
  unlock(data: { reason: string }): Promise<{ ok: boolean; key?: string }>
  clearKey(): Promise<void>
}

type CapacitorGlobal = {
  isNativePlatform?: () => boolean
  Plugins?: { AppLock?: AppLockPlugin }
}

function plugin(): AppLockPlugin | null {
  if (typeof window === 'undefined') return null
  const capacitor = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
  if (!capacitor?.isNativePlatform?.()) return null
  return capacitor.Plugins?.AppLock ?? null
}

/** Что умеет телефон: 'face' — Face ID, 'touch' — отпечаток, 'none' — ничего. */
export async function lockKind(): Promise<'face' | 'touch' | 'passcode' | 'none'> {
  const native = plugin()
  if (!native) return 'none'
  const state = await native.available().catch(() => null)
  return state?.available ? state.kind : 'none'
}

/** Ключ на этом телефоне уже сохранён — можно предлагать вход по лицу. */
export async function hasLockKey(): Promise<boolean> {
  const state = await plugin()?.hasKey().catch(() => null)
  return state?.saved === true
}

/** Покупатель только что вошёл по коду — просим у сайта ключ и прячем его в телефон. */
export async function rememberForFaceId(): Promise<void> {
  const native = plugin()
  if (!native) return
  const data = await fetch('/api/customer/native-key', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
  if (data?.ok && typeof data.key === 'string') await native.saveKey({ key: data.key }).catch(() => undefined)
}

/**
 * Вход по лицу. Телефон спросит Face ID, потом сайт проверит ключ.
 * Вернёт true, если пустили.
 */
export async function loginWithFaceId(reason: string): Promise<boolean> {
  const native = plugin()
  if (!native) return false
  const opened = await native.unlock({ reason }).catch(() => null)
  if (!opened?.ok || !opened.key) return false
  const response = await fetch('/api/customer/native-key', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: opened.key }),
  }).catch(() => null)
  if (!response?.ok) {
    // Ключ больше не годится (истёк или клиента удалили) — убираем, чтобы не мозолил глаза.
    if (response?.status === 401) await native.clearKey().catch(() => undefined)
    return false
  }
  return true
}

/** Покупатель вышел — ключ с телефона убираем. */
export async function forgetFaceId(): Promise<void> {
  await plugin()?.clearKey().catch(() => undefined)
}
