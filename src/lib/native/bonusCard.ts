/**
 * Бонусная карта в приложении для телефона.
 *
 * Сайт открыт внутри приложения (Capacitor). Когда покупатель вошёл, сайт отдаёт
 * приложению его карту, а приложение кладёт её в память телефона. После этого
 * карта открывается и без интернета: QR рисует сам телефон.
 *
 * В обычном браузере всех этих функций нет — здесь они просто ничего не делают.
 */

type BonusCardPlugin = {
  save(data: {
    qr: string
    name: string
    phone: string
    balance: number
    tier: string
    updatedAt: string
    lang: string
  }): Promise<void>
  clear(): Promise<void>
  state(): Promise<{ saved: boolean; phone: string; updatedAt: string }>
  show(): Promise<void>
}

type CapacitorGlobal = {
  isNativePlatform?: () => boolean
  Plugins?: { BonusCard?: BonusCardPlugin }
}

function plugin(): BonusCardPlugin | null {
  if (typeof window === 'undefined') return null
  const capacitor = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
  if (!capacitor?.isNativePlatform?.()) return null
  return capacitor.Plugins?.BonusCard ?? null
}

/** Сайт открыт внутри приложения для телефона, а не в браузере. */
export function inNativeApp(): boolean {
  return plugin() !== null
}

/** Сохранить карту в телефон. Ошибки глушим: карта — не повод ломать кабинет. */
export async function saveBonusCard(card: {
  qrCode?: string
  name: string
  phone: string
  balance: number
  tier: string
  lang: string
}): Promise<void> {
  const native = plugin()
  if (!native || !card.qrCode) return
  await native
    .save({
      qr: card.qrCode,
      name: card.name,
      phone: card.phone,
      balance: card.balance,
      tier: card.tier,
      updatedAt: new Date().toISOString(),
      lang: card.lang,
    })
    .catch(() => undefined)
}

/** Покупатель вышел — карту с телефона убираем. */
export async function clearBonusCard(): Promise<void> {
  await plugin()?.clear().catch(() => undefined)
}

/** Открыть карту на весь экран. */
export async function showBonusCard(): Promise<void> {
  await plugin()?.show().catch(() => undefined)
}
