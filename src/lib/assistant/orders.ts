/**
 * Состояние заказа обычными словами — на трёх языках.
 *
 * Сервер присылает короткие метки вроде `awaiting_payment`. Показывать их
 * покупателю нельзя, а объяснять каждый раз заново — значит рано или поздно
 * объяснить по-разному.
 */

import type { TalkLang } from './talk'

const WORDS: Record<string, Record<TalkLang, string>> = {
  awaiting_payment: {
    ru: 'ждёт оплаты',
    ky: 'төлөмдү күтүүдө',
    uz: "to'lov kutilmoqda",
  },
  paid: {
    ru: 'оплачен',
    ky: 'төлөндү',
    uz: "to'langan",
  },
  in_1c: {
    ru: 'принят магазином',
    ky: 'дүкөн кабыл алды',
    uz: "do'kon qabul qildi",
  },
  cancelled: {
    ru: 'отменён',
    ky: 'жокко чыгарылды',
    uz: 'bekor qilingan',
  },
  failed: {
    ru: 'оплата не прошла',
    ky: 'төлөм өтпөй калды',
    uz: "to'lov o'tmadi",
  },
}

export function orderStatusWord(status: string, lang: TalkLang): string {
  return WORDS[status]?.[lang] ?? status
}
