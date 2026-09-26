/**
 * Отзывы покупателей — правила, общие для сайта и браузера.
 *
 * Кто пишет: только тот, кто купил на сайте. Покупатель вошёл по коду, и у
 * него есть оплаченный заказ. Один заказ — один отзыв.
 *
 * Сколько видно: 20 последних на главной. Новый отзыв вытесняет самый старый,
 * и фото старого стираются с диска — место на сервере не растёт.
 *
 * Здесь нет ни файлов, ни сети: этот модуль читает и форма в браузере.
 */

/** Столько отзывов видно на главной. */
export const MAX_SHOWN = 20
/** Столько фото можно приложить к одному отзыву. */
export const MAX_PHOTOS = 5
export const MIN_TEXT = 3
export const MAX_TEXT = 1000
/**
 * Предел одного фото. Браузер сам сжимает фото до 1600 px — это 150–400 КБ.
 * Пять фото по пределу вместе с копиями для карточек — 4,75 МБ: проходят в
 * nginx (client_max_body_size 5m).
 */
export const MAX_PHOTO_BYTES = 800_000
/** Маленькая копия для карточки на главной: 640 px, 40–80 КБ. */
export const MAX_THUMB_BYTES = 150_000

/** Заказ, после которого можно писать отзыв: деньги пришли. */
const BOUGHT = new Set(['paid', 'in_1c'])

export function isBought(status: string): boolean {
  return BOUGHT.has(status)
}

/** Отзыв, каким его видят все. Телефона и номера заказа здесь нет. */
export type PublicReview = {
  id: string
  /** «Азамат А.» — имя и первая буква фамилии */
  name: string
  rating: number
  text: string
  /** имена файлов фото: /api/reviews/photo/<имя> */
  photos: string[]
  /** что купил — названия из заказа, не больше трёх */
  products: string[]
  createdAt: string
}

/** Имя и первая буква фамилии: «Азамат Абдыкадыров» → «Азамат А.». */
export function displayName(full: string): string {
  const words = full.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const first = words[0].slice(0, 30)
  return words[1] ? `${first} ${words[1][0].toUpperCase()}.` : first
}

/** Убрать служебные символы и лишние пустые строки. */
export function cleanText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export type ReviewInput = { orderId: string; rating: number; text: string }
export type ReviewError = 'order' | 'rating' | 'text' | 'photos'

/** Проверка того, что прислала форма. Фото проверяются отдельно — по байтам. */
export function checkReview(
  raw: { orderId: unknown; rating: unknown; text: unknown },
  photoCount: number,
): { ok: true; value: ReviewInput } | { ok: false; error: ReviewError } {
  const orderId = typeof raw.orderId === 'string' ? raw.orderId.trim() : ''
  if (!/^[A-Za-z0-9-]{3,40}$/.test(orderId)) return { ok: false, error: 'order' }
  const rating = Number(raw.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: 'rating' }
  const text = cleanText(typeof raw.text === 'string' ? raw.text : '')
  if (text.length < MIN_TEXT || text.length > MAX_TEXT) return { ok: false, error: 'text' }
  if (photoCount < 0 || photoCount > MAX_PHOTOS) return { ok: false, error: 'photos' }
  return { ok: true, value: { orderId, rating, text } }
}

/**
 * Что за картинка — по первым байтам, а не по имени файла. Всё, что не
 * JPEG, PNG или WebP, не принимаем: SVG может нести скрипт.
 */
export function imageType(bytes: Uint8Array): 'jpg' | 'png' | 'webp' | null {
  const at = (i: number) => bytes[i]
  if (bytes.length > 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'jpg'
  if (bytes.length > 8 && at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return 'png'
  if (
    bytes.length > 12 &&
    String.fromCharCode(at(0), at(1), at(2), at(3)) === 'RIFF' &&
    String.fromCharCode(at(8), at(9), at(10), at(11)) === 'WEBP'
  ) {
    return 'webp'
  }
  return null
}

/**
 * Имя файла фото: 24 шестнадцатеричных знака, у маленькой копии «-s», и
 * расширение. Ничего другого с диска не отдаём.
 */
export const PHOTO_NAME = /^[a-f0-9]{24}(-s)?\.(jpg|png|webp)$/

/** Имя маленькой копии: a1b2….jpg → a1b2…-s.jpg */
export function thumbOf(name: string): string {
  return name.replace(/(-s)?\.(jpg|png|webp)$/, '-s.$2')
}
