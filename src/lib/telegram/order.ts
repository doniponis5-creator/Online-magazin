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
  /^(ha|xa|ooba|oba|oa|давай|давайте|да|о{1,2}ба+|оа+|ова|макул|maqul|mayli|yes|ok|окей|хорошо|bo.?ladi|bop|ха|хоп|хуп|майли|мейли|булади|болот|болду|беру|берём|берем|алам|алабыз|оламан|оламиз|оформляйте|оформляем|тариздеңиз|расмийлаштиринг|хочу|чалыңыз|позвоните|кунгирок килинг)(?![\p{L}])(?![\s\S]*(спасибо|рахмат|благодар|rahmat|не надо|жок|йук|не буду|передумал|подумаю|ойлоном|уйлаб|сурап|сураб|спрошу|посоветуюсь|посмотрю|кеңеш|кенеш|маслахат|акылдаш|көрөйүн|корайин|кайра жаз|эжем|апам|жубайым|аялым|мужем|женой|мамой))/iu

/** Признак того, что бот предложил оформить заказ. */
// Кыргызские «буйрутма» и «тариздейли» — обязательно: без них «ооба» на
// «буйрутманы тариздейлиби?» уходило модели, и она заново спрашивала имя.
// Только вопрос: «Оформим?», «Буйрутма бересизби?». Прощальное «быстро
// оформим!» — не предложение, и «хорошо, спасибо» на него — не согласие.
export const OFFER = /(оформ|заказ|buyurtma|zakaz|rasmiylashtir|заказать|буйрутма|таризд|тариз|буюртма|расмийлаштир|берёте|берете|аласызбы|алабызбы|оласизми|олайсизми|оласизми)[^.!?\n]{0,60}\?/i

/** Бот предложил позвонить: «Позвонить вам?», «Сизге чалып берейинби?». «Да» на это — заявка на звонок. */
// Модель спрашивает по-разному: «чалып берейинби?», «чалып түшүндүрүп берелиби?»,
// «чалып беришин сурайынбы?» — ловим корень и знак вопроса в той же фразе.
export const CALL_OFFER = /(позвон|перезвон|чалып|чалалы|чалайын|чалсак|чалдыр|кунгирок кил|кунгирок килай|телефон кил)[^.!\n]{0,50}\?/i

/**
 * Короткое имя для переписки: «Стиральная машина FLAGMAN AV-80MXLB(BG)» →
 * «FLAGMAN AV-80MXLB(BG)». Так пишет продавец, а не каталог. Без латиницы в
 * названии («Электро Эндуро мини») — как есть.
 */
export function shortName(name: string): string {
  const clean = name.replace(/\*/g, '').trim()
  const at = clean.search(/[A-Za-z]/)
  return at > 0 ? clean.slice(at).trim() : clean
}

const ASK_NAME: Say = {
  ru: 'Хорошо, оформляю. Как вас зовут?',
  ky: 'Макул, тариздейм. Атыңыз ким?',
  uz: 'Хоп, расмийлаштираман. Исмингиз нима?',
}

const ASK_PHONE: Say = {
  ru: 'Ваш номер телефона?',
  ky: 'Телефон номериңиз?',
  uz: 'Телефон ракамингиз?',
}

const BAD_PHONE: Say = {
  ru: 'Номер не прошёл, проверьте: например 0555 123456.',
  ky: 'Номер туура эмес окшойт, текшериңизчи: мисалы 0555 123456.',
  uz: 'Ракам тугри эмасга ухшайди, текшириб куринг: масалан 0555 123456.',
}

const ASK_WHERE: Say = {
  ru: 'Куда привезти — город или село? Или заберёте сами из магазина?',
  ky: 'Кайда жеткирели — шаар же айыл? Же дүкөндөн өзүңүз аласызбы?',
  uz: 'Каерга олиб борайлик — шахар ёки кишлок? Ёки дукондан узингиз оласизми?',
}

const ASK_ADDRESS: Say = {
  ru: 'Улица и дом?',
  ky: 'Көчө жана үй?',
  uz: 'Куча ва уй?',
}

const ASK_PICK: Say = {
  ru: 'Какой берёте — первый или второй?',
  ky: 'Кайсынысын аласыз — биринчисинби, экинчисинби?',
  uz: 'Кайси бирини оласиз — биринчисиними, иккинчисиними?',
}

const NO_PRODUCT: Say = {
  ru: 'Какой товар оформляем?',
  ky: 'Кайсы товарды тариздейбиз?',
  uz: 'Кайси товарни расмийлаштирамиз?',
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
    return `${shortName(found[0].nameRu)} — ${formatSom(found[0].price)}${count}. ${nextQuestion(draft, lang)}`
  }

  drafts.set(chatId, { step: 'pick', source, options: found.map((p) => p.id), qty, ...known })
  const list = found.map((p, i) => `${i + 1}. ${shortName(p.nameRu)} — ${formatSom(p.price)}`).join('\n')
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

/** «первый», «второй», «биринчиси», «экинчи», «иккинчиси» → индекс в списке. */
function ordinalIn(text: string): number | undefined {
  const low = text.toLowerCase()
  if (/(перв|биринчи|birinchi)/.test(low)) return 0
  if (/(втор|экинчи|иккинчи|ikkinchi)/.test(low)) return 1
  if (/(трет|үчүнчү|учунчу|учинчи|uchinchi)/.test(low)) return 2
  return undefined
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
// Основы слов — с любым окончанием: «доставкасын», «гарантиясы», «ссылкасын».
// Раньше стояла граница конца слова, и «Доставкасын айтып койгулачы Таласка»
// не узнавалось — становилось адресом, и уходил заказ.
const NOT_AN_ANSWER_STEM =
  /(?<![\p{L}])(скидк|цен[аыу]|стоит|сколько|доставк|даставк|гаранти|кепилдик|кафолат|рассрочк|расрочк|бонус|дорого|дешевле|нужн|чегирм|арзан|арзон|кымбат|баасы|нарх|жеткир|етказ|акци|подума|ойлон|уйлаб|хоч|посмотр|смотр|отправ|покаж|показ|ссылк|шилтеме|сайт|наличи|каталог|фото|сурет|сүрөт|суроот|расм|корсот|көрсөт|жибер|ташла|друг|отмен|передума|айтып|айтыңыз|айткыла|койгула|объём|объем|размер|өлчөм|олчом|узун|бийик)/iu
/** Короткие слова — только целиком: «бар» внутри «барабан» — не вопрос. */
const NOT_AN_ANSWER_WORD =
  /(?<![\p{L}])(есть|можно|бар|барбы|борми|бор|канча|канчага|керек|керак|понял|поняла|не так|дагы|яна|башка|бошка|ещё|еще|не надо)(?![\p{L}])/iu
const NOT_AN_ANSWER = { test: (text: string) => NOT_AN_ANSWER_STEM.test(text) || NOT_AN_ANSWER_WORD.test(text) }

/**
 * «Потом», «оплачу через неделю», «денег пока нет», «подумаю» — покупатель не
 * отказался, но и не готов. Заказ не оформляем, отвечает консультант.
 * Иначе «Ооба, азыр акчам жетпейт, 5 күндөн кийин» начинало анкету, а
 * «Толом жургузойун анан жазайын» становилось адресом доставки.
 */
export const DEFER =
  /(потом|позже|попозже|не сейчас|пока нет|денег нет|нет денег|оплачу|заплачу|переведу|скину|подумаю|посоветуюсь|напишу|свяжусь|акчам|акча жок|жетпейт|толук эмес|толом|төлөм|төлөйм|толойм|жүргүз|жургуз|күндөн кийин|куну болот|анан жазайын|анан байланыш|байланышайын|ойлон|кеңеш|пулим|пул йук|пул йўк|етмайди|кейин|кейинрок|хозир эмас|тулайман|тулаб|тулов|толов|уйлаб|маслахат|ёзаман|богланаман|кураман)/iu

/** «Заберу сам», «өзүм алам» (и «озум алам» без ө), «узим оламан». */
const PICKUP = /(заберу|сам заберу|самовывоз|приеду|сами|өзүм|озум|озим|o.?zim|узим|узимиз|pickup|дүкөндөн|дукондон|do.?kondan|дукондан|из магазина|в магазине|келип алам|келиб оламан|барып алам)/i
/** Похоже на полный адрес: улица / дом / микрорайон. */
const FULL_ADDRESS = /(көчө|кочо|кучаси|кўчаси|улица|ул\.|үй|(?<![\p{L}])уй(?![\p{L}])|дом|мкр|микрорайон|переул|проспект|пр\.)/iu

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
    const ordinal = ordinalIn(value)
    const id = /^\d{1,2}\b/.test(value)
      ? draft.options[index]
      : ordinal !== undefined ? draft.options[ordinal] : await pickByWords(draft.options, value)
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
    if (PICKUP.test(value)) return await finish(chatId, draft, 'pickup', lang, siteLang)
    // Сразу написал полный адрес («…айылы, Айтиев жоро көчөсү 20 үй») — второй раз не спрашиваем.
    if (FULL_ADDRESS.test(value) && /\d/.test(value)) {
      draft.city = value.slice(0, 80)
      return await finish(chatId, draft, 'delivery', lang, siteLang, value.slice(0, 120))
    }
    draft.city = value.slice(0, 80)
    draft.step = 'address'
    return pick(ASK_ADDRESS, lang)
  }

  // address — «Озум алам» и здесь значит «заберу сам».
  if (PICKUP.test(value)) return await finish(chatId, draft, 'pickup', lang, siteLang)
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
    ru: `Готово ✅ Заказ ${orderId}, ${sum}.\nОплата: ${payUrl}\nОткроется O!Деньги — платите из своего банка. После оплаты позвоним насчёт доставки.`,
    ky: `Даяр ✅ Заказ ${orderId}, ${sum}.\nТөлөө: ${payUrl}\nO!Деньги ачылат — өз банкыңыздан төлөйсүз. Төлөгөндөн кийин жеткирүү боюнча чалабыз.`,
    uz: `Тайёр ✅ Буюртма ${orderId}, ${sum}.\nТулов: ${payUrl}\nO!Деньги очилади — уз банкингиздан тулайсиз. Тулагандан кейин етказиш буйича кунгирок киламиз.`,
  }
  return pick(say, lang)
}
