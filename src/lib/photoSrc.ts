/**
 * Фото товара в браузере — через сайт (`/p/…`), а не прямо с сервера SBonus (08.10, нагрузка перед рекламой).
 * Каталог — это 20–40 фото на экран, и все они шли на тот же сервер, где заказы, 1С и бот WhatsApp. Через сайт
 * их кэширует Cloudflare (имя файла меняется вместе с фото, ответ «хранить год»): SBonus отдаёт каждое фото
 * один раз, а не каждому покупателю. Перенаправление `/p/` → SBonus — в next.config.ts (rewrites).
 * Только для показа в браузере: Telegram, WhatsApp, Meta и фиды берут прямой адрес — их Cloudflare может не пустить.
 */
export const PHOTO_ORIGIN = 'https://api.smartcentr.store/api/v1/shop/photos/'

export function photoSrc<T extends string | undefined>(url: T): T {
  return (typeof url === 'string' && url.startsWith(PHOTO_ORIGIN) ? `/p/${url.slice(PHOTO_ORIGIN.length)}` : url) as T
}
