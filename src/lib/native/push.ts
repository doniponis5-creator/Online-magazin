/**
 * Push-уведомления в приложении для телефона.
 *
 * Как это работает. Приложение спрашивает у покупателя разрешение на уведомления.
 * Если он согласился, телефон выдаёт свой «адрес» (token): на iPhone — от Apple,
 * на Android — от Google (Firebase). Приложение отправляет адрес на сайт вместе
 * с платформой, сайт — на сервер SBonus. Дальше сервер шлёт на этот адрес
 * сообщения: «Заказ оплачен», «Заказ готов».
 *
 * Разрешение спрашиваем не сразу при первом запуске, а когда оно к месту:
 * после входа или после заказа. Так соглашаются чаще.
 *
 * В обычном браузере ничего не происходит.
 */

type PermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied'

type PushPlugin = {
  checkPermissions(): Promise<{ receive: PermissionState }>
  requestPermissions(): Promise<{ receive: PermissionState }>
  register(): Promise<void>
  addListener(
    event: 'registration' | 'registrationError' | 'pushNotificationReceived' | 'pushNotificationActionPerformed',
    handler: (data: unknown) => void,
  ): Promise<{ remove: () => Promise<void> }>
}

type CapacitorGlobal = {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
  Plugins?: { PushNotifications?: PushPlugin }
}

/** Capacitor есть только внутри приложения; в браузере и на сервере — null. */
function capacitor(): CapacitorGlobal | null {
  if (typeof window === 'undefined') return null
  const found = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
  return found?.isNativePlatform?.() ? found : null
}

function plugin(): PushPlugin | null {
  return capacitor()?.Plugins?.PushNotifications ?? null
}

/**
 * Чей телефон: 'ios' или 'android'. null — браузер или что-то незнакомое.
 * Серверу это нужно, чтобы выбрать, через кого слать: Apple или Google.
 */
export function pushPlatform(): 'ios' | 'android' | null {
  const platform = capacitor()?.getPlatform?.()
  return platform === 'ios' || platform === 'android' ? platform : null
}

let listening = false

/** Отдаём адрес телефона сайту. Сайт сам решит, к какому покупателю его привязать. */
async function sendToken(token: string): Promise<void> {
  const platform = pushPlatform()
  // Не знаем, чей телефон, — не шлём: сайт не поймёт, как проверить адрес.
  if (!platform) return
  await fetch('/api/push/device', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, platform }),
  }).catch(() => undefined)
}

function listen(native: PushPlugin) {
  if (listening) return
  listening = true
  native.addListener('registration', (data) => {
    const token = (data as { value?: string })?.value
    if (token) sendToken(token)
  })
  native.addListener('registrationError', () => undefined)
}

/**
 * Спросить разрешение и подписаться. Возвращает true, если покупатель согласился.
 * Если он уже отказывался, второй раз не пристаём — телефон всё равно не покажет окно.
 */
export async function enablePush(): Promise<boolean> {
  const native = plugin()
  if (!native) return false
  const current = await native.checkPermissions().catch(() => null)
  let state = current?.receive
  if (state === 'prompt' || state === 'prompt-with-rationale') {
    state = (await native.requestPermissions().catch(() => null))?.receive
  }
  if (state !== 'granted') return false
  listen(native)
  await native.register().catch(() => undefined)
  return true
}

/** Уже разрешены ли уведомления. 'none' — приложения нет или телефон не умеет. */
export async function pushState(): Promise<'granted' | 'denied' | 'ask' | 'none'> {
  const native = plugin()
  if (!native) return 'none'
  const current = await native.checkPermissions().catch(() => null)
  if (!current) return 'none'
  if (current.receive === 'granted') return 'granted'
  if (current.receive === 'denied') return 'denied'
  return 'ask'
}

/** Подписаться молча — если разрешение уже дано. Ничего не спрашивает. */
export async function resumePush(): Promise<void> {
  const native = plugin()
  if (!native) return
  const current = await native.checkPermissions().catch(() => null)
  if (current?.receive !== 'granted') return
  listen(native)
  await native.register().catch(() => undefined)
}
