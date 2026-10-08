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
import { durableMap } from '@/lib/durable'

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
  /** заклад, на который покупатель согласился прямо перед оформлением */
  deposit?: number
  /** когда согласился: заклад живёт 2 часа и в черновике — к товару через сутки не пристанет */
  depositAt?: number
  /** скидка в %, которую бот уступил в торге (1–5, policy «СКИДКИ»); ссылка на оплату — уже со скидкой */
  discount?: number
  discountAt?: number
  /** цена за штуку, о которой договорились в торге («2 900 бераман») — точнее процента */
  dealPrice?: number
  /** товар, о котором торговались; другой товар скидку не получает */
  dealProductId?: string
}

// Переживает перезапуск сайта: обновили сайт посреди заказа — покупатель не начинает заново.
const drafts = durableMap<ChatKey, Draft>('order-drafts', 24 * 3600 * 1000)
// Заклад, на который покупатель согласился в разговоре (модель, поле deposit) — берёт оформление заказа.
// Живёт 2 часа: «да» на «Оформляем?» приходит сразу; вчерашний заклад к сегодняшнему товару не пристанет.
const deposits = durableMap<ChatKey, { amount: number; at: number }>('order-deposits', 2 * 3600 * 1000)

/** Покупатель согласился платить закладом и назвал сумму (владелец 08.10: от 1 000 сом, сумму выбирает сам). */
export function rememberDeposit(chatId: ChatKey, amount: number): void {
  if (!Number.isFinite(amount) || amount < 1000) return
  const at = Date.now()
  deposits.set(chatId, { amount: Math.floor(amount), at })
  // анкета уже идёт — сумма меняется и в ней
  const draft = drafts.get(chatId)
  if (draft) drafts.set(chatId, { ...draft, deposit: Math.floor(amount), depositAt: at })
}

const DEPOSIT_WORD = /заклад|закалат|задат|аванс|zaklad|zakalat/i
const numbersIn = (text: string): number[] =>
  [...text.replace(/(\d)[\s\u00a0\u202f](?=\d{3}(?!\d))/g, '$1').matchAll(/(?<!\d)\d{3,6}(?!\d)/g)].map((m) => Number(m[0]))

/**
 * Сумма заклада прямо из ответа покупателя, без модели: на «Заклад 1 000 сомдон башталат. 1 000 сом бере аласызбы?»
 * пришло «1000 оа» — анкета начиналась сразу, модель не отвечала, и заказ уходил на всю сумму (08.10, Баткен).
 * Покупатель назвал число ≥ 1 000, а разговор о закладе — оно; сказал «да» на наш вопрос с одной суммой — она.
 */
export function depositFromReply(user: string, bot: string, draftOpen = false): number | undefined {
  const sentences = bot.split(/(?<=[.!?])\s+/)
  const asked = sentences.filter((s) => s.includes('?'))
  // Анкета открыта: «…Заклад: 1 000 сом. Кайда жеткирели?» — ответ «Ош-3000 көчөсү 12» про адрес, не про заклад
  // (аудит 08.10: заклад становился 3 000). Берём, только если последний вопрос — о закладе.
  const lastQuestion = asked.at(-1) ?? ''
  const about = draftOpen
    ? DEPOSIT_WORD.test(lastQuestion) || DEPOSIT_WORD.test(user)
    : DEPOSIT_WORD.test(sentences.slice(-2).join(' ')) || DEPOSIT_WORD.test(user)
  if (!about) return undefined
  const mine = numbersIn(user).filter((n) => n >= 1000)
  if (mine.length > 0) return mine[0]
  if (!AFFIRM.test(user.trim())) return undefined
  const theirs = [...new Set(numbersIn(lastQuestion).filter((n) => n >= 1000))]
  return theirs.length === 1 ? theirs[0] : undefined
}

/** productId — товар, о котором торговались: 4 % на A к B не переходят (аудит 08.10) */
type Bargain = { pct?: number; price?: number; at: number; productId?: string }
const discounts = durableMap<ChatKey, Bargain>('order-discounts', 2 * 3600 * 1000)
/** Самое большее, что бот уступает в торге (policy «СКИДКИ»); больше не примем, даже если модель написала. */
export const DISCOUNT_MAX = 5

/**
 * Бот уступил в торге — ссылка на оплату пойдёт со скидкой. pct — процент (поле discount или «4%» в его тексте),
 * price — цена за штуку, которую он назвал («Майли, 2 900 сом килиб бераман», поле price): она точнее процента.
 */
export function rememberDiscount(
  chatId: ChatKey,
  pct?: number,
  price?: number,
  opts: { productId?: string; fromText?: boolean } = {},
): void {
  const okPct = pct !== undefined && Number.isInteger(pct) && pct >= 1 && pct <= DISCOUNT_MAX ? pct : undefined
  const okPrice = price !== undefined && Number.isFinite(price) && price > 0 ? Math.round(price) : undefined
  if (okPct === undefined && okPrice === undefined) return
  const at = Date.now()
  const prevSaved = discounts.get(chatId)
  const draft = drafts.get(chatId)
  const prev = prevSaved ?? (draft ? { pct: draft.discount, price: draft.dealPrice, at, productId: draft.dealProductId } : undefined)
  const productId = opts.productId ?? prev?.productId
  // Торг о другом товаре — прежний уговор не в счёт
  const same = !opts.productId || !prev?.productId || prev.productId === opts.productId
  // новый процент из поля без цены — прежняя цена уже не та; процент из текста цену не стирает
  const keepPrice = same && (okPct === undefined || opts.fromText)
  const next: Bargain = { pct: okPct ?? (same ? prev?.pct : undefined), price: okPrice ?? (keepPrice ? prev?.price : undefined), at, productId }
  discounts.set(chatId, next)
  if (draft) drafts.set(chatId, { ...draft, discount: next.pct, dealPrice: next.price, dealProductId: next.productId, discountAt: at })
}

/**
 * Цена за штуку после торга: договорная цена, если она в пределах правила (не дешевле −5 % и ниже цены сайта),
 * иначе процент (вниз до 10 сом); товар со скидкой или акцией — цена сайта.
 */
export function bargainPrice(product: Product, deal: { pct?: number; price?: number }): number {
  if (!discountable(product)) return product.price
  const floor = Math.ceil((product.price * (100 - DISCOUNT_MAX)) / 100)
  if (deal.price && deal.price >= floor && deal.price < product.price) return deal.price
  if (deal.pct && deal.pct >= 1 && deal.pct <= DISCOUNT_MAX) return discounted(product.price, deal.pct)
  return product.price
}

/** «4% арзандатуу менен 22 940 сом» в ответе бота → 4. Нет слова скидки рядом с процентом — undefined. */
export function discountFromText(text: string): number | undefined {
  if (!/скидк|чегирм|арзандат|арзонлат|chegirm/i.test(text)) return undefined
  // «4% … 22 940 сом» — уступка; «Больше 5% скидку дать не можем» — суммы нет, это отказ (аудит 08.10)
  const granted = text.split(/(?<=[.!?])\s+/).filter((s) => numbersIn(s).some((n) => n >= 1000))
  const found = [...granted.join(' ').matchAll(/(?<![\d.,])(\d)\s?%/g)].map((m) => Number(m[1]))
  const pct = found.at(-1)
  return pct && pct >= 1 && pct <= DISCOUNT_MAX ? pct : undefined
}

/** Товар со скидкой или акцией — цена окончательная (policy), торговая скидка к нему не применяется. */
export function discountable(product: Product): boolean {
  return !product.sale && !(product.oldPrice && product.oldPrice > product.price)
}

/** Цена со скидкой: вниз до 10 сом — как бот считает в разговоре (23 900 − 4% = 22 940). */
export function discounted(price: number, pct: number): number {
  return Math.floor((price * (100 - pct)) / 100 / 10) * 10
}

function takeDiscount(chatId: ChatKey): Bargain | undefined {
  const saved = discounts.get(chatId)
  discounts.delete(chatId)
  const old = drafts.get(chatId)
  const fromDraft = (old?.discount || old?.dealPrice) && old.discountAt
    ? { pct: old.discount, price: old.dealPrice, at: old.discountAt, productId: old.dealProductId } : undefined
  const found = saved ?? fromDraft
  return found && Date.now() - found.at < DEPOSIT_TTL ? found : undefined
}

/** «Всё сразу оплачу» после разговора о закладе — заказ на всю сумму, прежний заклад забываем. */
export const FULL_PAY =
  /(?:толук|толугу|бардыгын|баарын|бүтүн|всю сумму|вс[её] сразу|сразу вс[её]|полностью|целиком|to'?liq|tulik|тулик|хаммасини|hammasini)(?:\s+\S+){0,2}?\s+(?:төл|толо|оплач|оплат|заплач|тула|tola|to'la)|(?:төл|толо|оплач|оплат|заплач|тула|tola|to'la)\S*(?:\s+\S+){0,2}?\s+(?:толук|толугу|полностью|целиком|всю сумму|вс[её] сразу|to'?liq|тулик|хаммасини)/i

export function forgetDeposit(chatId: ChatKey): void {
  deposits.delete(chatId)
  const draft = drafts.get(chatId)
  if (draft?.deposit) drafts.set(chatId, { ...draft, deposit: undefined })
}

const DEPOSIT_TTL = 2 * 3600 * 1000

/**
 * Заклад переходит в черновик заказа один раз — дальше живёт с ним (отмена черновика стирает и его).
 * Анкета ещё открыта (покупатель спросил посреди шагов и снова сказал «да») — берём из неё, если не старше 2 часов.
 */
function takeDeposit(chatId: ChatKey): { amount: number; at: number } | undefined {
  const saved = deposits.get(chatId)
  deposits.delete(chatId)
  const old = drafts.get(chatId)
  const fromDraft = old?.deposit && old.depositAt ? { amount: old.deposit, at: old.depositAt } : undefined
  const found = saved ?? fromDraft
  return found && Date.now() - found.at < DEPOSIT_TTL ? found : undefined
}

const DISCOUNT_WORD: Record<TalkLang, string> = { ru: 'со скидкой', ky: 'арзандатуу', uz: 'чегирма' }

const DEPOSIT_LINE: Record<TalkLang, (sum: string) => string> = {
  ru: (sum) => `\nЗаклад: ${sum} — остаток, когда погрузим товар в такси.`,
  ky: (sum) => `\nЗаклад: ${sum} — калганы товар таксиге жүктөлгөндө.`,
  uz: (sum) => `\nЗаклад: ${sum} — колгани товар таксига юкланганда.`,
}

type Say = { ru: string; ky: string; uz: string }
const pick = (say: Say, lang: TalkLang) => say[lang]

export function hasDraft(chatId: ChatKey): boolean {
  return drafts.has(chatId)
}

/** Анкета прервалась вопросом или «потом» — заклад не теряем: вернётся к «да» ещё 2 часа. «Отмена» — cancel(). */
function dropDraft(chatId: ChatKey): void {
  const draft = drafts.get(chatId)
  drafts.delete(chatId)
  if (draft?.deposit) deposits.set(chatId, { amount: draft.deposit, at: draft.depositAt ?? Date.now() })
  if (draft?.discount || draft?.dealPrice) {
    discounts.set(chatId, { pct: draft.discount, price: draft.dealPrice, at: draft.discountAt ?? Date.now(), productId: draft.dealProductId })
  }
}

export function cancel(chatId: ChatKey): void {
  drafts.delete(chatId)
  deposits.delete(chatId)
  discounts.delete(chatId)
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
  /^(ha|xa|ooba|oba|oa|давай|давайте|да|о{1,2}ба+|оа+|ова|макул|maqul|mayli|yes|ok|окей|хорошо|bo.?ladi|bop|ха|хада|ҳа|ҳада|hada|xada|хоп|хуп|майли|мейли|булади|болот|болду|беру|берём|берем|алам|алабыз|оламан|оламиз|оформляйте|оформляем|тариздеңиз|расмийлаштиринг|хочу|чалыңыз|позвоните|кунгирок килинг)(?![\p{L}])(?![\s\S]*(спасибо|рахмат|благодар|rahmat|не надо|жок|йук|не буду|передумал|подумаю|ойлоном|уйлаб|сурап|сураб|спрошу|посоветуюсь|посмотрю|кеңеш|кенеш|маслахат|акылдаш|көрөйүн|корайин|кайра жаз|эжем|апам|жубайым|аялым|мужем|женой|мамой))/iu

/** Признак того, что бот предложил оформить заказ. */
// Кыргызские «буйрутма» и «тариздейли» — обязательно: без них «ооба» на
// «буйрутманы тариздейлиби?» уходило модели, и она заново спрашивала имя.
// Только вопрос: «Оформим?», «Буйрутма бересизби?». Прощальное «быстро
// оформим!» — не предложение, и «хорошо, спасибо» на него — не согласие.
// «Айта оласизми?», «юбора оласизми?», «айта аласызбы?» — «можете сказать?», а не «купите?» (имтихон 03.10:
// ответ «Ассаламу алейкум. …номини айта оласизми?» обрезался до приветствия, а «ха» на него начинало заказ).
export const OFFER = /(оформ|заказ|buyurtma|zakaz|rasmiylashtir|заказать|буйрутма|таризд|тариз|буюртма|расмийлаштир|берёте|берете|(?<!а\s)(?:аласызбы|алабызбы|оласизми|олайсизми))[^.!?\n]{0,60}\?/i

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

const ASK_ADDRESS_FULL: Say = {
  ru: 'Напишите улицу и номер дома, например: Ленина 15.',
  ky: 'Көчөнүн атын жана үйдүн номерин жазыңыз, мисалы: Ленин 15.',
  uz: 'Куча номи ва уй ракамини ёзинг, масалан: Ленин 15.',
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

  const agreed = takeDeposit(chatId)
  const deposit = agreed?.amount
  const depositAt = agreed?.at
  const taken = takeDiscount(chatId)
  // Торговались о другом товаре — к этому скидка не пристаёт
  const bargain = taken && (!taken.productId || found.some((p) => p.id === taken.productId)) ? taken : undefined
  const discount = bargain?.pct
  const dealPrice = bargain?.price
  const dealProductId = bargain?.productId
  const discountAt = bargain?.at
  // Покупатель видит заклад в первом же шаге оформления — не согласен, скажет сразу
  const depositLine = deposit ? DEPOSIT_LINE[lang](formatSom(deposit)) : ''
  if (found.length === 1) {
    const draft: Draft = { step: 'name', source, options: [], productId: found[0].id, qty, deposit, depositAt, discount, dealPrice, dealProductId, discountAt, ...known }
    drafts.set(chatId, draft)
    const count = qty > 1 ? ` × ${qty}` : ''
    // Уступили в торге — покупатель сразу видит цену со скидкой: ссылка будет на неё
    const deal = bargainPrice(found[0], { pct: discount, price: dealPrice })
    const price = deal < found[0].price ? `${formatSom(deal)} (${DISCOUNT_WORD[lang]})` : formatSom(found[0].price)
    return `${shortName(found[0].nameRu)} — ${price}${count}.${depositLine} ${nextQuestion(draft, lang)}`
  }

  drafts.set(chatId, { step: 'pick', source, options: found.map((p) => p.id), qty, deposit, depositAt, discount, dealPrice, dealProductId, discountAt, ...known })
  const list = found.map((p, i) => `${i + 1}. ${shortName(p.nameRu)} — ${formatSom(p.price)}`).join('\n')
  return `${list}${depositLine}\n\n${pick(ASK_PICK, lang)}`
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
 * Анкета открыта, а покупатель спросил о своём (скидка, оплата) — на вопрос отвечает модель, но спросить в конце
 * она должна то, чего ждёт анкета: 08.10 модель просила имя, а анкета ждала телефон. null — анкеты нет.
 */
export function pendingQuestion(chatId: ChatKey, lang: TalkLang): string | null {
  const draft = drafts.get(chatId)
  if (!draft) return null
  if (draft.step === 'pick') return pick(ASK_PICK, lang)
  if (draft.step === 'name') return pick(ASK_NAME, lang)
  if (draft.step === 'phone') return pick(ASK_PHONE, lang)
  if (draft.step === 'where') return pick(ASK_WHERE, lang)
  if (draft.step === 'address') return pick(ASK_ADDRESS, lang)
  return null
}

/** Ответ модели + вопрос анкеты: её последний вопрос убираем, чтобы покупатель не получил два разных. */
export function withPending(text: string, question: string): string {
  const sentences = text.trim().split(/(?<=[.!?…])\s+/)
  const last = sentences[sentences.length - 1].replace(/[\p{Extended_Pictographic}\uFE0F\s]+$/u, '').trim()
  // «Канча заклад бересиз?» — на него покупатель и ответит суммой (depositFromReply); анкету спросим следом
  if (last.endsWith('?') && DEPOSIT_WORD.test(last)) return text.trim()
  if (sentences.length > 1 && last.endsWith('?')) sentences.pop()
  return `${sentences.join(' ')} ${question}`.trim()
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
/** На шаге имени ещё и торг: «2900 га берилар», «боладими» — не имя (на шагах адреса «алып бериңиз» — адрес) */
const NOT_A_NAME = /(?<![\p{L}])(болад|бўлад|булад|болоб|майлими|бераман|берасиз|бересиз|берил|бериңиз|беринг)/iu
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

/** Назван населённый пункт: «…шаарына», «…айылы», «город …», «… району». */
const PLACE = /(шаар|айыл|район|город|село|кишлак|кишлок|кыштак|шахар|шахри|туман|облус|область)/i

/** Про оплату посреди анкеты: «Мбанк номер жоноткуло», «карта номер ташла», «QR код». */
export const PAY_ASIDE = /(мбанк|mbank|м-банк|м банк|реквизит|карта номер|номер карт|кюар|кьюар|qr)/i
const PAY_LATER = {
  ru: 'Оплата — по QR-коду, он придёт сразу после оформления.',
  ky: 'Төлөм — QR-код менен, заказ бүткөндө дароо келет.',
  uz: 'Тулов — QR-код оркали, буюртма тугагандан кейин дарров келади.',
}

/** «Заберу сам», «өзүм алам» (и «озум алам» без ө), «узим оламан». */
const PICKUP = /(заберу|сам заберу|самовывоз|приеду|сами|өзүм|озум|озим|o.?zim|узим|узимиз|pickup|дүкөндөн|дукондон|do.?kondan|дукондан|из магазина|в магазине|келип алам|келиб оламан|барып алам)/i
/** Похоже на полный адрес: улица / дом / микрорайон. */
export const FULL_ADDRESS = /(көчө|кочо|кучаси|кўчаси|улица|ул\.|үй|(?<![\p{L}])уй(?![\p{L}])|дом|мкр|микрорайон|переул|проспект|пр\.)/iu

export async function step(chatId: ChatKey, text: string, lang: TalkLang, siteLang: Lang): Promise<string | null> {
  const reply = await advance(chatId, text, lang, siteLang)
  // Шаг меняет черновик на месте (draft.step = 'phone'). set() — чтобы новый шаг попал в файл:
  // иначе после перезапуска сайта номер телефона читался бы как ответ на «как вас зовут?».
  const draft = drafts.get(chatId)
  if (draft) drafts.set(chatId, draft)
  return reply
}

async function advance(chatId: ChatKey, text: string, lang: TalkLang, siteLang: Lang): Promise<string | null> {
  const draft = drafts.get(chatId)
  if (!draft) return null

  // Ссылка на карту («yandex.ru/navi?…») — не вопрос: её «?» сбрасывал заказ. Адрес — слова рядом.
  const value = text.replace(/https?:\/\/\S+/gi, ' ').replace(/\s+/g, ' ').trim()

  if (DEFER.test(value)) {
    dropDraft(chatId)
    return null
  }

  // Вопрос посреди шагов («можно оплатить при получении?») — не ответ на шаг.
  // Отдаём его консультанту, а не переспрашиваем по кругу: покупатель, которому
  // трижды ответили «напишите номер», решил, что с ним говорит мошенник.
  // На шагах «куда» и «адрес» такое — ещё и признак, что заказ не нужен:
  // «Отправьте то что на сайте» становилось городом, «Не так понял, хочу
  // посмотреть» — адресом, и уходил заказ с мусором вместо доставки.
  if (draft.step === 'where' || draft.step === 'address') {
    // «Мбанк номер жоноткуло» посреди шагов — про оплату, а не адрес: город был бы
    // «Мбанк номер жоноткуло» (заказ Нурсеита 01.10). Объясняем и спрашиваем снова.
    if (PAY_ASIDE.test(value)) return `${pick(PAY_LATER, lang)} ${draft.step === 'where' ? pick(ASK_WHERE, lang) : pick(ASK_ADDRESS, lang)}`
    // «Кызыл-кыя шаарына даставка кылып берсениздер» — слово «доставка», но назван город: это ответ.
    if (value.includes('?') || (NOT_AN_ANSWER.test(value) && !PLACE.test(value))) {
      dropDraft(chatId)
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
      dropDraft(chatId)
      return null
    }
    draft.productId = id
    return nextQuestion(draft, lang)
  }

  if (draft.step === 'name') {
    if (value.length < 2) return pick(ASK_NAME, lang)
    // Имя — одно-два слова. Длинная фраза — это вопрос или просьба.
    if (value.split(/\s+/).length > 3) return null
    // В имени нет цифр: «2900 га берилар» — торг, а не имя; пусть ответит консультант, анкета ждёт имя
    if (/\d/.test(value) || NOT_A_NAME.test(value)) return null
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
  // «15» вместо адреса — проверка заказа (не короче 4 знаков) его не пропускала, и покупатель
  // получал «не получилось оформить» (журнал сайта 02.10). Переспрашиваем с примером.
  if (value.replace(/\s/g, '').length < 4) return pick(ASK_ADDRESS_FULL, lang)
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
  // Скидка из торга — в цене строки: ссылка O!Деньги, сумма и 1С (берёт цену из строки) — одна цифра (08.10)
  const ours = !draft.dealProductId || draft.dealProductId === product.id
  const deal = ours ? bargainPrice(product, { pct: draft.discount, price: draft.dealPrice }) : product.price
  if (deal < product.price) {
    const order = result.order
    const lines = order.lines.map((l) => ({ ...l, price: deal, sum: deal * l.qty }))
    const goodsTotal = lines.reduce((s, l) => s + l.sum, 0)
    result.order = {
      ...order,
      lines,
      goodsTotal,
      total: goodsTotal + order.delivery.price,
      comment: `${order.comment} · уступили в чате: ${formatSom(product.price)} → ${formatSom(deal)}`.slice(0, 500),
    }
  }

  // Заклад меньше суммы к оплате — платит часть; больше или равен — обычный заказ
  const toPay = result.order.total - result.order.bonus
  const deposit = draft.deposit && draft.deposit < toPay ? draft.deposit : undefined
  try {
    const created = await createOrder(deposit ? { ...result.order, deposit } : result.order)
    const payUrl = created.payUrl.startsWith('http') ? created.payUrl : `${SITE_URL}${created.payUrl}`
    // Сумму заклада берём из ответа сервера: не принял его (старый сервер) — ссылка на всю сумму, так и пишем
    return created.deposit
      ? doneDeposit(toPay, created.deposit, created.orderId, payUrl, lang)
      : done(result.order.total, created.orderId, payUrl, lang)
  } catch (error) {
    console.error('[telegram] сервер заказов:', error instanceof Error ? error.message : error)
    return pick(FAILED, lang) + phoneLine()
  }
}

function phoneLine(): string {
  return '+996 557 100 505'
}

function doneDeposit(total: number, deposit: number, orderId: string, payUrl: string, lang: TalkLang): string {
  const sum = formatSom(total)
  const dep = formatSom(deposit)
  const rest = formatSom(total - deposit)
  const say: Say = {
    ru: `Спасибо! ✅ Заказ ${orderId}, ${sum}.\nЗаклад ${dep} — оплата: ${payUrl}\nОстаток ${rest} — когда погрузим товар в машину: пришлём номер машины, телефон водителя и ссылку на оплату. Такси оплачиваете водителю сами.`,
    ky: `Рахмат! ✅ Заказ ${orderId}, ${sum}.\nЗаклад ${dep} — төлөө: ${payUrl}\nКалганы ${rest} — товарды машинага жүктөгөндө: машинанын номерин, айдоочунун телефонун жана төлөм шилтемесин жөнөтөбүз. Таксини айдоочуга өзүңүз төлөйсүз.`,
    uz: `Рахмат! ✅ Буюртма ${orderId}, ${sum}.\nЗаклад ${dep} — тулов: ${payUrl}\nКолгани ${rest} — товарни машинага юклаганда: машина ракамини, хайдовчи телефонини ва тулов хаволасини юборамиз. Таксини хайдовчига узингиз тулайсиз.`,
  }
  return pick(say, lang)
}

function done(total: number, orderId: string, payUrl: string, lang: TalkLang): string {
  const sum = formatSom(total)
  const say: Say = {
    ru: `Спасибо! ✅ Заказ ${orderId}, ${sum}.\nОплата: ${payUrl}\nОткроется O!Деньги — платите из своего банка. После оплаты позвоним насчёт доставки.`,
    ky: `Рахмат! ✅ Заказ ${orderId}, ${sum}.\nТөлөө: ${payUrl}\nO!Деньги ачылат — өз банкыңыздан төлөйсүз. Төлөгөндөн кийин жеткирүү боюнча чалабыз.`,
    uz: `Рахмат! ✅ Буюртма ${orderId}, ${sum}.\nТулов: ${payUrl}\nO!Деньги очилади — уз банкингиздан тулайсиз. Тулагандан кейин етказиш буйича кунгирок киламиз.`,
  }
  return pick(say, lang)
}
