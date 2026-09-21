import 'server-only'

/**
 * Заказ прямо в разговоре — в Telegram и в чате на сайте, чтобы покупателю не
 * приходилось никуда уходить.
 *
 * Здесь нет языковой модели, и это главное. Когда речь идёт о деньгах, шаги
 * должны быть одни и те же каждый раз: имя → телефон → куда везти → ссылка на
 * оплату. Модель могла бы придумать лишний вопрос или пропустить нужный.
 *
 * Ссылку на оплату выдаёт тот же сервер заказов, что и сайт. Никаких личных
 * карт и переводов «на номер сотрудника» здесь нет и быть не может.
 */

import type { Product } from '@/data/products'
import { lookupIn, salesCatalogNow as catalogNow } from '@/lib/assistant/live'
import { createOrder } from '@/lib/orders/gateway'
import { validateOrder } from '@/lib/orders/order'
import { SITE_URL } from '@/lib/seo'
import { formatSom } from '@/lib/format'
import type { Lang } from '@/lib/i18n/config'
import type { TalkLang } from './../assistant/talk'
import { store } from '@/lib/store'

type Step = 'pick' | 'name' | 'phone' | 'where' | 'address'

/** Чей разговор: номер чата Telegram или «web:<id вкладки>» для сайта. */
export type ChatKey = number | string

/** Что уже известно о покупателе: вошёл на сайт — имя и телефон не спрашиваем. */
export type Prefill = { name?: string; phone?: string }

type Draft = {
  step: Step
  /** откуда заказ — пишется в комментарий, чтобы сотрудник знал */
  source: string
  /** товары, из которых покупатель выбирает, когда их несколько */
  options: string[]
  productId?: string
  name?: string
  phone?: string
  city?: string
}

const drafts = store('drafts', () => new Map<ChatKey, Draft>())

type Say = { ru: string; ky: string; uz: string }
const pick = (say: Say, lang: TalkLang) => say[lang]

export function hasDraft(chatId: ChatKey): boolean {
  return drafts.has(chatId)
}

export function cancel(chatId: ChatKey): void {
  drafts.delete(chatId)
}

/** Покупатель собрался брать. Слова из трёх языков, включая «куда платить». */
export const BUY_INTENT =
  /(olaman|olsam|olamiz|sotib ol|buyurtma|zakaz|oformit|oformlyat|rasmiylashtir|заказ|беру|возьму|куплю|хочу купить|оформ|алам|алайын|pulini|pulni|qayerga to|qaerga to|куда плат|куда перевести|куда скинуть|как купить|как заказать|kuda plat)/i

/**
 * Короткое «да» в ответ на предложение оформить заказ.
 *
 * Само по себе «да» ничего не значит: на вопрос «для кухни?» это не заказ.
 * Поэтому оно считается согласием, только если бот сам только что предложил
 * оформить, — см. OFFER ниже.
 */
// Граница слова \b знает только латиницу, поэтому после «да» её нет и проверка
// срывалась. Вместо неё — «дальше не буква».
export const AFFIRM =
  /^(ha|xa|давай|да|ооба|оба|макул|maqul|mayli|yes|ok|окей|хорошо|bo.?ladi|bop)(?![\p{L}])/iu

/** Признак того, что бот предложил оформить заказ. */
export const OFFER = /(оформ|заказ|buyurtma|zakaz|rasmiylashtir|заказать)/i

const ASK_NAME: Say = {
  ru: 'Хорошо, оформим. Как вас зовут?',
  ky: 'Жакшы, заказ берели. Атыңыз ким?',
  uz: 'Yaxshi, buyurtma qilamiz. Ismingiz nima?',
}

const ASK_PHONE: Say = {
  ru: 'Ваш номер телефона? Напишите как есть, например 0555 123456.',
  ky: 'Телефон номериңиз? Мисалы: 0555 123456.',
  uz: 'Telefon raqamingiz? Masalan: 0555 123456.',
}

const BAD_PHONE: Say = {
  ru: 'Что-то номер не похож на настоящий. Напишите ещё раз, например 0555 123456.',
  ky: 'Номер туура эмес окшойт. Кайра жазыңыз, мисалы 0555 123456.',
  uz: "Raqam to'g'ri emasga o'xshaydi. Qaytadan yozing, masalan 0555 123456.",
}

const ASK_WHERE: Say = {
  ru: 'Куда везти? Напишите город или село. Если заберёте сами — напишите «заберу сам».',
  ky: 'Кайда жеткирели? Шаарды же айылды жазыңыз. Өзүңүз аласызбы — «өзүм алам» деп жазыңыз.',
  uz: "Qayerga olib boramiz? Shahar yoki qishloqni yozing. O'zingiz olsangiz — «o'zim olaman» deb yozing.",
}

const ASK_ADDRESS: Say = {
  ru: 'Адрес: улица и дом.',
  ky: 'Дарек: көчө жана үй.',
  uz: "Manzil: ko'cha va uy.",
}

const ASK_PICK: Say = {
  ru: 'Какой из них берём? Напишите номер.',
  ky: 'Кайсынысын аласыз? Номерин жазыңыз.',
  uz: 'Qaysi birini olasiz? Raqamini yozing.',
}

const NO_PRODUCT: Say = {
  ru: 'Скажите, какой товар — название или модель, — и я всё оформлю.',
  ky: 'Кайсы товар экенин жазыңыз — аталышын же моделин, — баарын жасайм.',
  uz: "Qaysi mahsulot ekanini yozing — nomi yoki modeli, — hammasini rasmiylashtiraman.",
}

const FAILED: Say = {
  ru: 'Не получилось оформить заказ. Позвоните нам, оформим вручную: ',
  ky: 'Заказ берүү болбой калды. Бизге чалыңыз, колдон жасайбыз: ',
  uz: "Buyurtma qilib bo'lmadi. Bizga qo'ng'iroq qiling, qo'lda rasmiylashtiramiz: ",
}

/**
 * Начать заказ. products — то, что бот показал в прошлом ответе.
 */
export async function start(
  chatId: ChatKey,
  productIds: string[],
  lang: TalkLang,
  source = 'Заказ из Telegram-бота',
  prefill: Prefill = {},
): Promise<string> {
  const find = lookupIn(await catalogNow())
  const found = productIds.map(find).filter((p): p is Product => Boolean(p))

  if (found.length === 0) {
    drafts.delete(chatId)
    return pick(NO_PRODUCT, lang)
  }

  const known = {
    name: prefill.name?.trim() || undefined,
    phone: prefill.phone?.replace(/\D/g, '') || undefined,
  }

  if (found.length === 1) {
    const draft: Draft = { step: 'name', source, options: [], productId: found[0].id, ...known }
    drafts.set(chatId, draft)
    return `${found[0].nameRu} — ${formatSom(found[0].price)}\n\n${nextQuestion(draft, lang)}`
  }

  drafts.set(chatId, { step: 'pick', source, options: found.map((p) => p.id), ...known })
  const list = found.map((p, i) => `${i + 1}. ${p.nameRu} — ${formatSom(p.price)}`).join('\n')
  return `${list}\n\n${pick(ASK_PICK, lang)}`
}

/**
 * Продолжить начатый заказ. Возвращает, что ответить покупателю,
 * или null — значит, заказа в работе нет и отвечает обычный консультант.
 */
/**
 * Следующий вопрос. Что уже известно (вошёл на сайт — имя и телефон есть),
 * не спрашиваем: переспрашивать вошедшего покупателя его же номер — первое,
 * от чего люди бросают заказ.
 */
function nextQuestion(draft: Draft, lang: TalkLang): string {
  if (!draft.name) {
    draft.step = 'name'
    return pick(ASK_NAME, lang)
  }
  if (!draft.phone) {
    draft.step = 'phone'
    return pick(ASK_PHONE, lang)
  }
  draft.step = 'where'
  return pick(ASK_WHERE, lang)
}

export async function step(chatId: ChatKey, text: string, lang: TalkLang, siteLang: Lang): Promise<string | null> {
  const draft = drafts.get(chatId)
  if (!draft) return null

  const value = text.trim()

  if (draft.step === 'pick') {
    const index = Number.parseInt(value, 10) - 1
    const id = draft.options[index]
    if (!id) return pick(ASK_PICK, lang)
    draft.productId = id
    return nextQuestion(draft, lang)
  }

  if (draft.step === 'name') {
    if (value.length < 2) return pick(ASK_NAME, lang)
    draft.name = value.slice(0, 60)
    return nextQuestion(draft, lang)
  }

  if (draft.step === 'phone') {
    const digits = value.replace(/\D/g, '')
    if (digits.length < 9 || digits.length > 12) return pick(BAD_PHONE, lang)
    draft.phone = digits
    return nextQuestion(draft, lang)
  }

  if (draft.step === 'where') {
    // «Заберу сам» — самовывоз, адрес не нужен.
    if (/сам|өзүм|o.?zim|pickup|дүкөндөн|do.?kondan|магазин/i.test(value)) {
      return await finish(chatId, draft, 'pickup', lang, siteLang)
    }
    draft.city = value.slice(0, 80)
    draft.step = 'address'
    return pick(ASK_ADDRESS, lang)
  }

  // address
  draft.city = draft.city ?? ''
  return await finish(chatId, draft, 'delivery', lang, siteLang, value.slice(0, 120))
}

async function finish(
  chatId: ChatKey,
  draft: Draft,
  method: 'pickup' | 'delivery',
  lang: TalkLang,
  siteLang: Lang,
  address = '',
): Promise<string> {
  drafts.delete(chatId)

  const list = await catalogNow()
  const find = lookupIn(list)
  const product = draft.productId ? find(draft.productId) : undefined
  if (!product) return pick(NO_PRODUCT, lang)

  // Берём первый вариант, который есть на складе: в Telegram цвет и память
  // пока не выбирают — сотрудник уточнит их при подтверждении.
  const variant = product.variants.find((v) => v.stock > 0) ?? product.variants[0]

  const result = validateOrder(
    {
      customer: { name: draft.name ?? '', phone: draft.phone ?? '' },
      delivery: { method, city: draft.city ?? '', address },
      comment: draft.source,
      lines: [{ productId: product.id, variantId: variant?.id ?? '', qty: 1 }],
      lang: siteLang,
    },
    find,
  )

  if (!result.ok) {
    console.error('[telegram] заказ не прошёл проверку:', result.errors)
    return pick(FAILED, lang) + phoneLine()
  }

  try {
    const created = await createOrder(result.order)
    const payUrl = created.payUrl.startsWith('http') ? created.payUrl : `${SITE_URL}${created.payUrl}`
    return done(result.order.total, created.orderId, payUrl, lang)
  } catch (error) {
    console.error('[telegram] сервер заказов:', error instanceof Error ? error.message : error)
    return pick(FAILED, lang) + phoneLine()
  }
}

function phoneLine(): string {
  return '+996 557 100 505'
}

function done(total: number, orderId: string, payUrl: string, lang: TalkLang): string {
  const sum = formatSom(total)
  const say: Say = {
    ru: `Готово! Заказ ${orderId}, к оплате ${sum}.\n\nОплатить: ${payUrl}\n\nСсылка открывает страницу O!Деньги — платите из приложения своего банка. Как оплатите, наш сотрудник свяжется с вами и договорится, когда привезти.`,
    ky: `Даяр! Заказ ${orderId}, төлөмгө ${sum}.\n\nТөлөө: ${payUrl}\n\nШилтеме O!Деньги барагын ачат — өз банкыңыздын тиркемесинен төлөңүз. Төлөгөнүңүздөн кийин кызматкерибиз байланышып, качан жеткирерин келишет.`,
    uz: `Tayyor! Buyurtma ${orderId}, to'lov ${sum}.\n\nTo'lash: ${payUrl}\n\nHavola O!Dengi sahifasini ochadi — o'z bankingiz ilovasidan to'lang. To'laganingizdan keyin xodimimiz siz bilan bog'lanib, qachon yetkazishni kelishadi.`,
  }
  return pick(say, lang)
}
