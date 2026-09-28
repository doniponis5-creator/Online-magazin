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
  safeListen(native, 'registration', (data) => {
    const token = (data as { value?: string })?.value
    if (token) sendToken(token)
  })
  safeListen(native, 'registrationError', () => undefined)
  listenPushTaps()
}

/**
 * Подписка на событие плагина, которая никогда не роняет страницу.
 * Старая сборка приложения может не знать плагина или вернуть не Promise:
 * тогда вызов бросает сразу — и без этой обёртки падал бы весь сайт в приложении.
 */
function safeListen(native: PushPlugin, event: Parameters<PushPlugin['addListener']>[0], handler: (data: unknown) => void): void {
  try {
    const pending = native.addListener(event, handler) as unknown
    if (pending && typeof (pending as Promise<unknown>).catch === 'function') (pending as Promise<unknown>).catch(() => undefined)
  } catch {
    // плагина нет в этой сборке приложения — уведомлений просто не будет
  }
}

let tapsListening = false

/** Язык, на котором покупатель сейчас смотрит сайт: первая часть адреса. Не понять — русский. */
function currentLang(): string {
  const first = window.location?.pathname?.split('/')[1] ?? ''
  return first === 'ru' || first === 'ky' ? first : 'ru'
}

/** Свой адрес сайта: `/ru/...` или `/ky/...`. Чужой сайт, `//`, `?` и `#` сюда не проходят. */
const OWN_PATH = /^\/(ru|ky)(\/[A-Za-z0-9._~%-]+)*\/?$/

/**
 * Куда вести по нажатию на «Скидку» или «Новинку». Сервер шлёт адрес товара на русском
 * (`/ru/product/...`) — меняем язык на тот, что выбрал покупатель. Адрес не наш,
 * с `..` или его нет — открываем главную: на чужой сайт из уведомления не уводим.
 */
function promoPath(url: unknown): string {
  const lang = currentLang()
  if (typeof url !== 'string' || !OWN_PATH.test(url)) return `/${lang}`
  // `..` и `%2e%2e` в адресе значат «на уровень вверх» — такие адреса не открываем.
  if (url.split('/').some((part) => /^\.+$/.test(part.replace(/%2e/gi, '.')))) return `/${lang}`
  return `/${lang}${url.slice(3)}`
}

/**
 * Нажатие на уведомление. Напоминание о корзине (`type: "cart"`) открывает корзину
 * на текущем языке; «Скидка» и «Новинка» из 1С (`type: "promo"`) — страницу товара
 * из `data.url` (только свои адреса), рассылка без товара — главную. Уведомления
 * о заказах — как раньше, никуда не переводим.
 *
 * Это JS сайта, поэтому работает и в уже вышедшем приложении без новой сборки.
 * Если приложение было закрыто, плагин придержит нажатие до появления слушателя.
 */
export function listenPushTaps(): void {
  const native = plugin()
  if (!native || tapsListening) return
  tapsListening = true
  safeListen(native, 'pushNotificationActionPerformed', (action) => {
    const data = (action as { notification?: { data?: { type?: unknown; url?: unknown } } })?.notification?.data
    if (data?.type === 'cart') window.location.assign(`/${currentLang()}/cart`)
    else if (data?.type === 'promo') window.location.assign(promoPath(data.url))
  })
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
