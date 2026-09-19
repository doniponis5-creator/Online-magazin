/**
 * Каталог в памяти телефона — чтобы он открывался без интернета.
 *
 * Пока связь есть, сайт отдаёт приложению «снимок» каталога: названия, цены,
 * наличие. Приложение кладёт его к себе. Пропала связь — каталог всё равно
 * открывается, просто из снимка.
 *
 * Заказать из снимка нельзя: для заказа нужен живой сервер. Снимок отвечает
 * на вопрос «что у них есть и почём», а это в магазине спрашивают чаще всего.
 *
 * В обычном браузере ничего этого нет — функции просто молчат.
 */

type CatalogPlugin = {
  save(data: { version: string; updatedAt: string; payload: string }): Promise<void>
  state(): Promise<{ saved: boolean; version: string; count: number; updatedAt: string }>
  show(options: { lang: string }): Promise<void>
}

type CapacitorGlobal = {
  isNativePlatform?: () => boolean
  Plugins?: { OfflineCatalog?: CatalogPlugin }
}

function plugin(): CatalogPlugin | null {
  if (typeof window === 'undefined') return null
  const capacitor = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
  if (!capacitor?.isNativePlatform?.()) return null
  return capacitor.Plugins?.OfflineCatalog ?? null
}

/** Реже не имеет смысла: каталог из 1С приходит раз в 10 минут, но меняется редко. */
const MIN_INTERVAL_MS = 6 * 60 * 60 * 1000
const LAST_TRY_KEY = 'sc-catalog-snapshot-try'

function triedRecently(): boolean {
  try {
    const last = Number(window.localStorage.getItem(LAST_TRY_KEY) ?? 0)
    return Number.isFinite(last) && Date.now() - last < MIN_INTERVAL_MS
  } catch {
    return false
  }
}

function markTried(): void {
  try {
    window.localStorage.setItem(LAST_TRY_KEY, String(Date.now()))
  } catch {
    // Хранилище запрещено — просто попробуем ещё раз в следующий заход
  }
}

/**
 * Обновить снимок каталога в телефоне.
 *
 * Тихо: ошибка сети, выключённое хранилище или старый телефон не должны
 * мешать человеку смотреть витрину.
 */
export async function syncOfflineCatalog(): Promise<void> {
  const native = plugin()
  if (!native) return
  if (triedRecently()) return
  markTried()

  const saved = await native.state().catch(() => null)

  const response = await fetch('/api/catalog/snapshot', { cache: 'no-store' }).catch(() => null)
  if (!response?.ok) return
  const text = await response.text().catch(() => '')
  if (!text) return

  let version = ''
  try {
    version = String((JSON.parse(text) as { version?: string }).version ?? '')
  } catch {
    return
  }
  if (!version) return
  // Каталог не менялся с прошлого раза — незачем переписывать.
  if (saved?.saved && saved.version === version) return

  await native
    .save({ version, updatedAt: new Date().toISOString(), payload: text })
    .catch(() => undefined)
}

/** Есть ли снимок в телефоне и насколько он свежий. */
export async function offlineCatalogState(): Promise<{
  saved: boolean
  count: number
  updatedAt: string
} | null> {
  const state = await plugin()?.state().catch(() => null)
  if (!state) return null
  return { saved: state.saved, count: state.count, updatedAt: state.updatedAt }
}

/** Открыть каталог из памяти телефона. */
export async function showOfflineCatalog(lang: string): Promise<void> {
  await plugin()?.show({ lang }).catch(() => undefined)
}
