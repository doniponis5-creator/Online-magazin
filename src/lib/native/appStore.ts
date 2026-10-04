/**
 * Приложение «S Маркет — Смарт Центр» в App Store (с 28.09.2026, версия 1.0.1).
 * id — из https://itunes.apple.com/lookup?bundleId=kg.smarket.app&country=kg.
 *
 * Где зовём скачать (04.10):
 *  • Safari на iPhone — родная полоса Apple вверху (metadata `itunes` в layout): её показывает сам iPhone;
 *  • Instagram, WhatsApp, Telegram, Chrome на iPhone — там полосы Apple нет, поэтому своя (AppBanner);
 *  • страница заказа — «следите за заказом в приложении» (AppOrderPromo).
 * Внутри приложения — нигде. Android — когда приложение откроется в Google Play для всех.
 */

export const APP_STORE_ID = '6814226061'
export const APP_STORE_URL = `https://apps.apple.com/kg/app/id${APP_STORE_ID}`

/** iPhone или iPad (новые iPad называют себя «Macintosh», но у них есть касание). */
export function isIos(ua: string, touchPoints = 0): boolean {
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1)
}

/**
 * Обычный Safari — там iPhone сам покажет полосу Apple, своя рядом была бы второй.
 * Встроенные браузеры (Instagram, Facebook, Telegram, Line, Google) и Chrome/Firefox/Edge на iPhone — не Safari.
 */
export function isPlainSafari(ua: string): boolean {
  return /Version\/[\d.]+.*Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|Instagram|FBAN|FBAV|Line\/|Telegram/i.test(ua)
}

export const APP_BAR_OFF = 'sc-app-bar-off'
const APP_BAR_QUIET = 7 * 24 * 3600_000

/**
 * Показывать ли полосу «Скачайте приложение» (AppBanner) — одно правило и для неё, и для полосы бонусов:
 * при ней полоса бонусов молчит, а сумма бонусов — в полосе приложения (две полосы друг над другом — много).
 * Только в браузере (зовут из useEffect). inApp — уже внутри приложения.
 */
export function appBarWanted(inApp: boolean): boolean {
  if (inApp) return false
  const ua = navigator.userAgent
  if (!isIos(ua, navigator.maxTouchPoints) || isPlainSafari(ua)) return false
  try {
    const off = window.localStorage.getItem(APP_BAR_OFF)
    return !(off && Date.now() - Number(off) < APP_BAR_QUIET)
  } catch {
    return true
  }
}
