/**
 * Рассрочка банка — одни числа для сайта (карточка, страница товара) и для чата (policy.ts, comments.ts).
 * Даёт банк, не магазин: MIslamic «Адал рассрочка» — без переплаты, 4 месяца, лимит 2 000–40 000 сом
 * (mbank.kg, 05.10); MBANK «МРассрочка» — до 200 000 сом и 24 месяцев, с переплатой (её считает банк).
 * Поменялись условия — правьте здесь.
 */
export const INSTALLMENT = { adal: { min: 2_000, max: 40_000, months: 4 }, mbank: { max: 200_000, months: 24 } } as const

/**
 * Кабинет «Адал рассрочки» в приложении MBANK — та же ссылка, что у кнопки «Подключить» на mbank.kg (06.10):
 * на телефоне с MBANK открывает приложение сразу на подключении лимита.
 */
export const ADAL_APP_LINK = 'https://app.mbank.kg/native/adal_cabinet_page'
export const MBANK_STORES = {
  ios: 'https://apps.apple.com/ru/app/mbank-online/id922922121',
  android: 'https://play.google.com/store/apps/details?id=com.maanavan.mb_kyrgyzstan',
} as const

/** Платёж в месяц по «Адал рассрочке» (цена / 4, вверх до сома) или null — цена вне её лимита. */
export function adalMonthly(price: number): number | null {
  const { min, max, months } = INSTALLMENT.adal
  return price >= min && price <= max ? Math.ceil(price / months) : null
}

/** Дороже «Адал», но в пределах «МРассрочки» — показываем только «до 24 месяцев», без суммы. */
export function mbankFits(price: number): boolean {
  return price > INSTALLMENT.adal.max && price <= INSTALLMENT.mbank.max
}
