/**
 * Контакты магазина — один источник правды.
 *
 * Номера, адрес и стаж раньше жили только в тексте подвала («будут опубликованы
 * после запуска»). Теперь они в одном файле: подвал, страница «О нас» и разметка
 * для поисковиков берут их отсюда, и менять номер надо в одном месте.
 *
 * Все три номера есть и в WhatsApp, и в Telegram — так их дал владелец.
 */

export type Phone = {
  /** как набирать: только цифры, для ссылок */
  raw: string
  /** как показывать человеку */
  display: string
}

export const phones: Phone[] = [
  { raw: '996557100505', display: '+996 557 100 505' },
  { raw: '996505000100', display: '+996 505 000 100' },
  { raw: '996551120009', display: '+996 551 120 009' },
]

export const address = {
  ru: 'Ошская область, Араванский район, улица Ош-3000, 86',
  ky: 'Ош облусу, Араван району, Ош-3000 көчөсү, 86',
  /** короткая форма для подвала */
  shortRu: 'Ошская обл., Араванский р-н, ул. Ош-3000, 86',
  shortKy: 'Ош обл., Араван р-ну, Ош-3000 көч., 86',
}

/** Год, с которого магазин работает. Стаж считается от него, чтобы не устаревал. */
export const since = 2011

export function yearsOnMarket(now = new Date()): number {
  return Math.max(1, now.getFullYear() - since)
}

export const telHref = (p: Phone) => `tel:+${p.raw}`
/**
 * Ссылка в WhatsApp. С текстом — сообщение уже набрано за покупателя: он
 * нажал «Связаться» на странице товара, и продавец сразу видит, о чём речь,
 * а не спрашивает «какой именно?».
 */
export const whatsappHref = (p: Phone, text?: string) =>
  text ? `https://wa.me/${p.raw}?text=${encodeURIComponent(text)}` : `https://wa.me/${p.raw}`
export const telegramHref = (p: Phone) => `https://t.me/+${p.raw}`

/**
 * Instagram магазина. QR-код лежит готовой картинкой в public/qr/instagram.svg —
 * его нарисовали один раз, чтобы сайт не ходил за ним в чужой сервис и работал
 * даже без интернета у посетителя... то есть у нас на сервере.
 */
export const instagram = {
  handle: 'smartcentrr',
  url: 'https://www.instagram.com/smartcentrr/',
  qr: '/qr/instagram.svg',
}

/** Кто сделал сайт. Стоит в подвале — по этому телефону обращаются за доработками. */
export const developer = {
  name: 'Abduganiev Doniyorbek',
  phone: { raw: '996505000100', display: '+996 505 000 100' } as Phone,
}
