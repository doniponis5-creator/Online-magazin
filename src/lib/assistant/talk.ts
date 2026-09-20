/**
 * Язык разговора.
 *
 * Сайт бывает только русским и кыргызским, а покупатель пишет ещё и
 * по-узбекски: магазин стоит в Араванском районе, где по-узбекски говорят
 * каждый день, и пишут его и латиницей, и кириллицей.
 *
 * Язык определяем сами, а не поручаем это языковой модели. Быстрая дешёвая
 * модель на кыргызский вопрос отвечала по-русски; когда язык назван ей прямо
 * («отвечай по-кыргызски»), она не ошибается.
 */

import type { Lang } from '@/lib/i18n/config'

export type TalkLang = 'ru' | 'ky' | 'uz'

export const LANG_NAME: Record<TalkLang, string> = {
  ru: 'русский',
  ky: 'кыргызский',
  uz: 'узбекский',
}

/**
 * На каком языке пишет покупатель.
 *
 * Считаем приметы, а не угадываем: узбекскую кириллицу (ў, ғ, қ, ҳ) и
 * кыргызскую (ң, ө, ү) не спутать, а латиницу узнаём по частым словам.
 * Ничего не нашли — отвечаем на языке сайта.
 */
export function detectLang(text: string, fallback: TalkLang): TalkLang {
  const low = text.toLowerCase()

  if (/[ўғқҳ]/.test(low)) return 'uz'
  if (/[ңөү]/.test(low)) return 'ky'

  // Конца слова не проверяем: в узбекском к корню липнут окончания
  // («yetkaz» → «yetkazib», «bor» → «bormi»), и \b в конце всё бы испортил.
  const uzWords = /\b(assalom|salom|qancha|qanaqa|qanday|narx|bormi|kerak|olmoq|olaman|olsam|yetkaz|rahmat|raqam|do.?kon|muzlatgich|changyutgich|kir mashina|nechta|necha|bo.?ladi|arzon|kafolat|to.?lo|sotib|buyurtma|nasiya|oy qoldi|xayr|pul|qachan|keladi|tushunmadim|bilmadim|ayting|aytasiz|menga|sizda|uchun|qayerga|qaerga|tashla|tashe|bering|beraman|qilsam|mumkin|yaxshi|kechir)/i
  const kyWords = /\b(salam|kanday|baasy|barby|kerek|jetkir|rakmat|kancha|dukon|kaerde|arzan|kepildik)/i

  if (uzWords.test(low)) return 'uz'
  if (kyWords.test(low)) return 'ky'

  /**
   * Целая фраза латиницей без кыргызских слов — почти наверняка узбекская:
   * так пишут в Араванском районе. Одно слово не в счёт, иначе «Samsung» или
   * «LG» от русского покупателя переводили бы разговор на узбекский.
   */
  const latinWords = low.match(/[a-z']{2,}/g) ?? []
  if (latinWords.length >= 3 && !/[а-яё]/i.test(low)) return 'uz'

  // Кыргызская и узбекская кириллица без особых букв. Слова редкие, в русском
  // тексте не встречаются, поэтому ищем их просто как куски строки: граница
  // слова \b кириллицу не видит и здесь бесполезна.
  if (/(канча|канчадан|баасы|барбы|керек|жеткир|рахмат|саламатсыз|дүкөн|кайда|арзан|кепилдик|заказым|бар бы)/i.test(low)) {
    return 'ky'
  }
  if (/(қанча|нарх|керак|раҳмат|дўкон|бормий|бўлиб|неча ой)/i.test(low)) return 'uz'

  // Кириллица без узбекских и кыргызских букв — считаем русским.
  if (/[а-я]/.test(low)) return 'ru'
  return fallback
}
