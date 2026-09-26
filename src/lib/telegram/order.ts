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
  /** сколько штук; 1, если не сказали */
  qty: number
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
  /(olaman|olsam|olamiz|sotib ol|buyurtma|zakaz|oformit|oformlyat|rasmiylashtir|заказ|беру|возьму|куплю|хочу купить|оформ|алам|алайын|pulini|pulni|qayerga to|qaerga to|куда плат|куда перевести|куда скинуть|как купить|как заказать|kuda plat|оламан|олсам|оламиз|сотиб ол|буюртма|расмийлаштир|пулини|пулни|каерга тул|кайерга тул|кандай сотиб|кандай буюртма)/i

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
  /^(ha|xa|давай|да|ооба|оба|макул|maqul|mayli|yes|ok|окей|хорошо|bo.?ladi|bop|ха|хоп|майли|булади|булади)(?![\p{L}])(?![\s\S]*(спасибо|рахмат|благодар|rahmat|не надо|жок|йук|не буду|передумал))/iu

/** Признак того, что бот предложил оформить заказ. */
// Кыргызские «буйрутма» и «тариздейли» — обязательно: без них «ооба» на
// «буйрутманы тариздейлиби?» уходило модели, и она заново спрашивала имя.
// Только вопрос: «Оформим?», «Буйрутма бересизби?». Прощальное «быстро
// оформим!» — не предложение, и «хорошо, спасибо» на него — не согласие.
export const OFFER = /(оформ|заказ|buyurtma|zakaz|rasmiylashtir|заказать|буйрутма|таризд|тариз|буюртма|расмийлаштир)[^.!?\n]{0,60}\?/i

const ASK_NAME: Say = {
  ru: 'Хорошо, оформим. Как вас зовут?',
  ky: 'Жакшы, заказ берели. Атыңыз ким?',
  uz: 'Яхши, буюртма киламиз. Исмингиз нима?',
}

const ASK_PHONE: Say = {
  ru: 'Ваш номер телефона? Напишите как есть, например 0555 123456.',
  ky: 'Телефон номериңиз? Мисалы: 0555 123456.',
  uz: 'Телефон ракамингиз? Масалан: 0555 123456.',
}

const BAD_PHONE: Say = {
  ru: 'Что-то номер не похож на настоящий. Напишите ещё раз, например 0555 123456.',
  ky: 'Номер туура эмес окшойт. Кайра жазыңыз, мисалы 0555 123456.',
  uz: 'Ракам тугри эмасга ухшайди. Кайтадан ёзинг, масалан 0555 123456.',
}

const ASK_WHERE: Say = {
  ru: 'Куда везти? Напишите город или село. Если заберёте сами — напишите «заберу сам».',
  ky: 'Кайда жеткирели? Шаарды же айылды жазыңыз. Өзүңүз аласызбы — «өзүм алам» деп жазыңыз.',
  uz: 'Каерга олиб борамиз? Шахар ёки кишлокни ёзинг. Узингиз олсангиз — «узим оламан» деб ёзинг.',
}

const ASK_ADDRESS: Say = {
  ru: 'Адрес: улица и дом.',
  ky: 'Дарек: көчө жана үй.',
  uz: 'Манзил: куча ва уй.',
}

const ASK_PICK: Say = {
  ru: 'Какой из них берём? Напишите номер.',
  ky: 'Кайсынысын аласыз? Номерин жазыңыз.',
  uz: 'Кайси бирини оласиз? Ракамини ёзинг.',
}

const NO_PRODUCT: Say = {
  ru: 'Скажите, какой товар — название или модель, — и я всё оформлю.',
  ky: 'Кайсы товар экенин жазыңыз — аталышын же моделин, — баарын жасайм.',
  uz: 'Кайси махсулот эканини ёзинг — номи ёки модели, — хаммасини расмийлаштираман.',
}

const FAILED: Say = {
  ru: 'Не получилось оформить заказ. Позвоните нам, оформим вручную: ',
  ky: 'Заказ берүү болбой калды. Бизге чалыңыз, колдон жасайбыз: ',
  uz: 'Буюртма килиб булмади. Бизга кунгирок килинг, кулда расмийлаштирамиз: ',
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
  qty = 1,
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
    const draft: Draft = { step: 'name', source, options: [], productId: found[0].id, qty, ...known }
    drafts.set(chatId, draft)
    const count = qty > 1 ? ` × ${qty}` : ''
    return `${found[0].nameRu} — ${formatSom(found[0].price)}${count}\n\n${nextQuestion(draft, lang)}`
  }

  drafts.set(chatId, { step: 'pick', source, options: found.map((p) => p.id), qty, ...known })
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

/**
 * Покупатель назвал не номер, а модель или цену: «AV-80MXLB(BG)», «21400 сомдугун».
 * Подходит ровно один товар — его и берём.
 */
async function pickByWords(options: string[], text: string): Promise<string | undefined> {
  const find = lookupIn(await catalogNow())
  const low = text.toLowerCase()
  const digits = low.replace(/\D/g, '')
  const hits = options.filter((id) => {
    const p = find(id)
    if (!p) return false
    if (digits.length >= 4 && String(p.price) === digits) return true
    const tokens = p.nameRu.toLowerCase().match(/[a-z0-9][a-z0-9()\/-]{3,}/g) ?? []
    return tokens.some((t) => low.includes(t) && !/^\d+$/.test(t))
  })
  return hits.length === 1 ? hits[0] : undefined
}

/**
 * Похоже на вопрос, а не на ответ шага: знак вопроса или длинная фраза.
 * Кыргызы и узбеки в мессенджере часто пишут вопрос без «?»
 * («акчасын толойбузбу»), поэтому длинная фраза тоже считается вопросом.
 */
export function looksLikeQuestion(text: string): boolean {
  return text.includes('?') || text.trim().split(/\s+/).length > 5 || NOT_AN_ANSWER.test(text)
}

/**
 * Слова, которых не бывает в имени, номере или адресе: «есть скидка»,
 * «канча турат», «нарх» — это вопрос консультанту, а не ответ на шаг.
 * Без этого «Есть скидка» становилось именем покупателя.
 */
const NOT_AN_ANSWER =
  /(?<![\p{L}])(скидк|цена|цены|стоит|сколько|есть|можно|доставк|гаранти|рассрочк|бонус|дорого|дешевле|нужен|нужна|нужно|бар|барбы|борми|бор|канча|нарх|нархи|чегирма|арзан|арзон|кымбат|керек|керак|баасы|жеткир|етказ|акция|подумаю|ойлоноюн|уйлаб|хочу|хотим|посмотреть|смотреть|понял|поняла|не так|отправьте|отправить|покажите|показать|ссылк|сайт|сайте|наличи|каталог|фото|сурет|сүрөт|расм|курсам|курай|курмокчи|корсот|корсотинг|жибер|жиберинг|ташла|ташланг|другой|другую|другие|ещё|еще|дагы|яна|башка|бошка|отмена|не надо|передумал)(?![\p{L}])/iu

/**
 * «Потом», «оплачу через неделю», «денег пока нет», «подумаю» — покупатель не
 * отказался, но и не готов. Заказ не оформляем, отвечает консультант.
 * Иначе «Ооба, азыр акчам жетпейт, 5 күндөн кийин» начинало анкету, а
 * «Толом жургузойун анан жазайын» становилось адресом доставки.
 */
export const DEFER =
  /(потом|позже|попозже|не сейчас|пока нет|денег нет|нет денег|оплачу|заплачу|переведу|скину|подумаю|посоветуюсь|напишу|свяжусь|акчам|акча жок|жетпейт|толук эмес|толом|төлөм|төлөйм|толойм|жүргүз|жургуз|күндөн кийин|куну болот|анан жазайын|анан байланыш|байланышайын|ойлон|кеңеш|пулим|пул йук|пул йўк|етмайди|кейин|кейинрок|хозир эмас|тулайман|тулаб|тулов|толов|уйлаб|маслахат|ёзаман|богланаман|кураман)/iu

export async function step(chatId: ChatKey, text: string, lang: TalkLang, siteLang: Lang): Promise<string | null> {
  const draft = drafts.get(chatId)
  if (!draft) return null

  const value = text.trim()

  if (DEFER.test(value)) {
    drafts.delete(chatId)
    return null
  }

  // Вопрос посреди шагов («можно оплатить при получении?») — не ответ на шаг.
  // Отдаём его консультанту, а не переспрашиваем по кругу: покупатель, которому
  // трижды ответили «напишите номер», решил, что с ним говорит мошенник.
  // На шагах «куда» и «адрес» такое — ещё и признак, что заказ не нужен:
  // «Отправьте то что на сайте» становилось городом, «Не так понял, хочу
  // посмотреть» — адресом, и уходил заказ с мусором вместо доставки.
  if (draft.step === 'where' || draft.step === 'address') {
    if (value.includes('?') || NOT_AN_ANSWER.test(value)) {
      drafts.delete(chatId)
      return null
    }
  } else if (looksLikeQuestion(value)) return null

  if (draft.step === 'pick') {
    const index = Number.parseInt(value, 10) - 1
    // Номер в списке — или модель / цена словами: «AV-80MXLB», «21400 сомдугун алам».
    const id = /^\d{1,2}\b/.test(value) ? draft.options[index] : await pickByWords(draft.options, value)
    if (!id) {
      // Написал не номер — значит, выбирать пока не готов. Выходим из заказа.
      drafts.delete(chatId)
      return null
    }
    draft.productId = id
    return nextQuestion(draft, lang)
  }

  if (draft.step === 'name') {
    if (value.length < 2) return pick(ASK_NAME, lang)
    // Имя — одно-два слова. Длинная фраза — это вопрос или просьба.
    if (value.split(/\s+/).length > 3) return null
    draft.name = value.slice(0, 60)
    return nextQuestion(draft, lang)
  }

  if (draft.step === 'phone') {
    const digits = value.replace(/\D/g, '')
    // Буквы и почти без цифр — это не попытка написать номер, а вопрос. Пусть ответит консультант.
    if (digits.length < 6 && /[\p{L}]{3,}/u.test(value)) return null
    if (digits.length < 9 || digits.length > 12) return pick(BAD_PHONE, lang)
    draft.phone = digits
    return nextQuestion(draft, lang)
  }

  if (draft.step === 'where') {
    // «Заберу сам» — самовывоз, адрес не нужен.
    if (/сам|өзүм|o.?zim|узим|узимиз|pickup|дүкөндөн|do.?kondan|дукондан|магазин/i.test(value)) {
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
      lines: [{ productId: product.id, variantId: variant?.id ?? '', qty: draft.qty > 0 ? draft.qty : 1 }],
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
    ru: `Готово! Заказ ${orderId}, к оплате ${sum}.\n\nОплатить: ${payUrl}\n\nСсылка открывает страницу O!Деньги — платите из приложения своего банка. Как оплатите, руководство свяжется с вами и договорится, когда привезти.`,
    ky: `Даяр! Заказ ${orderId}, төлөмгө ${sum}.\n\nТөлөө: ${payUrl}\n\nШилтеме O!Деньги барагын ачат — өз банкыңыздын тиркемесинен төлөңүз. Төлөгөнүңүздөн кийин руководство байланышып, качан жеткирерин келишет.`,
    uz: `Тайёр! Буюртма ${orderId}, тулов ${sum}.\n\nТулаш: ${payUrl}\n\nХавола O!Деньги сахифасини очади — уз банкингиз иловасидан туланг. Тулаганингиздан кейин руководство сиз билан богланиб, качон етказишни келишади.`,
  }
  return pick(say, lang)
}
