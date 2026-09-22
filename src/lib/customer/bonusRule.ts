/**
 * Как на сайте можно тратить бонусы — одной фразой для покупателя.
 *
 * Два предела из «Панели сайта» в 1С: процент от заказа (SITE_BONUS_MAX_PCT)
 * и сумма за один заказ (SITE_BONUS_MAX_ORDER_SOM, 0 — без предела). Сервер
 * считает по обоим сразу; здесь только слова, чтобы обещание совпадало со счётом.
 * Фраза встаёт после «оплатить …»: «до 10% заказа», «до 334 сом за заказ».
 */
export type BonusLang = 'ru' | 'ky' | 'uz'

export function bonusRule(pct: number, cap: number, lang: BonusLang): string {
  const p = Math.max(0, Math.round(pct || 0))
  const c = Math.max(0, Math.round(cap || 0))
  const som = c.toLocaleString('ru-RU').replace(/ /g, ' ')
  const onlyCap = c > 0 && p >= 100
  const both = c > 0 && p < 100
  if (lang === 'ky') {
    if (onlyCap) return `бир заказга ${som} сомго чейин`
    if (both) return `заказдын ${p}%ына чейин, бирок ${som} сомдон ашпай`
    return `заказдын ${p}%ына чейин`
  }
  if (lang === 'uz') {
    if (onlyCap) return `bitta buyurtmada ${som} somgacha`
    if (both) return `buyurtmaning ${p}% igacha, lekin ${som} somdan oshmay`
    return `buyurtmaning ${p}% igacha`
  }
  if (onlyCap) return `до ${som} сом за заказ`
  if (both) return `до ${p}% заказа, но не больше ${som} сом`
  return `до ${p}% заказа`
}
