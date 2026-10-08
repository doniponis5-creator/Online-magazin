import 'server-only'

/**
 * Один ответ продавца — для любого канала: чат на сайте и WhatsApp.
 *
 * Сначала шаги без модели (оформление заказа, «перезвоните»), потом
 * консультант. Каналы отличаются только тем, откуда известен покупатель: на
 * сайте — из входного cookie, в WhatsApp — из номера, с которого он пишет
 * (номер подтверждён самим WhatsApp).
 */

import type { Lang } from '@/lib/i18n/config'
import { answer, talkLang } from './reply'
import { cleanName } from './talk'
import { AFFIRM, BUY_INTENT, CALL_OFFER, DEFER, FULL_ADDRESS, FULL_PAY, OFFER, PAY_ASIDE, cancel, depositFromReply, discountFromText, forgetDeposit, hasDraft, looksLikeQuestion, pendingQuestion, rememberDeposit, rememberDiscount, start, step, withPending } from '@/lib/telegram/order'
import { CALL_INTENT, cancelLead, hasLead, leadContext, leadStep, notifyOwner, startLead } from './leads'
import { decide, paidAmount, triage } from './triage'
import { durableMap } from '@/lib/durable'
import { lookupIn, salesCatalogNow } from './live'
import { type Intent, followAfter, isSureYes, jevConfigured, objectionNote, readAnswer } from './jev'
import type { ChatTurn, DownWhy } from './gemini'
import { bestNameMatch, type CustomerBrief, type ProductHit } from './knowledge'
import { getInstallment, getProfile } from '@/lib/customer/gateway'
import { phones } from '@/data/contacts'

export type Reply = {
  text: string
  products: ProductHit[]
  source: 'gemini' | 'local' | 'flow'
  /** local — почему модель не ответила */
  why?: DownWhy
  /** покупатель попросил живого человека — заявка ушла сотруднику */
  handoff?: boolean
  /** ничего не отправлять («Ок», «{{SWE001}}», чужой автоответ, не про магазин) */
  silent?: boolean
  /**
   * Замолчать в этом чате на 12 часов. Только когда пишет не покупатель (рабочие,
   * родные, чужой бот). «Ок» и «{{SWE001}}» чат не глушат: следом обычно идёт
   * настоящий вопрос («Токмокко доставка канча?»), и на него надо ответить.
   */
  mute?: boolean
  /** покупатель отложил («после зарплаты», «завтра») — напомнить через столько секунд, а не через 2 часа */
  followAfter?: number
}

export type Channel = {
  /** ключ разговора: «web:<вкладка>», «wa:<телефон>», «ig:<id Instagram>» */
  key: string
  /** пишется в комментарий заказа */
  orderSource: string
  leadChannel: 'site' | 'telegram' | 'whatsapp' | 'instagram'
  /** что точно известно о покупателе */
  known: { name?: string; phone?: string }
  /** как подписать человека владельцу, когда номера нет: «Instagram @ник» */
  label?: string
}

/**
 * Разговор кончается репликой магазина — Gemini такой запрос не берёт (400 «Requests ending with a model
 * turn», 05.10). Так бывало, когда покупатель дописал, пока бот думал: бот клал ответ в конец — «вопрос,
 * вопрос, ответ». Сервер теперь кладёт ответ на место (`place_answer`); старые разговоры в Redis чиним
 * здесь: ответ — перед последним вопросом, на него и отвечаем. Вопроса нет вовсе — null (молчим).
 */
export function endWithCustomer(turns: ChatTurn[]): ChatTurn[] | null {
  let end = turns.length
  while (end > 0 && turns[end - 1].role === 'assistant') end--
  if (end === turns.length) return turns
  if (end === 0) return null
  const tail = turns.slice(end)
  // Один вопрос и ответ после него — на него уже ответили. Два и больше — последний дописан, пока бот думал.
  let start = end - 1
  while (start > 0 && turns[start - 1].role === 'user') start--
  if (start === end - 1) return null
  return [...turns.slice(0, end - 1), ...tail, turns[end - 1]]
}

export async function respond(
  channel: Channel,
  given: ChatTurn[],
  lang: Lang,
  customer: CustomerBrief | null,
  buy?: unknown,
  shown?: unknown,
  /** id товара, страница которого открыта у покупателя (чат на сайте) */
  page?: string,
): Promise<Reply> {
  const turns = endWithCustomer(given)
  if (!turns) return { text: '', products: [], source: 'flow', silent: true }
  // Jev читает ответ на наш вопрос «Оформляем?» / «Позвонить?» — salesFlow кладёт его сюда.
  const hint: { intent?: Intent | null } = {}
  const flow = await salesFlow(channel, turns, lang, customer, buy, shown, page, hint)
  if (flow) return flow
  // WhatsApp и Instagram — переписка с магазином: пишут не только покупатели.
  const messenger = channel.leadChannel === 'whatsapp' || channel.leadChannel === 'instagram'
  // «Ок», «👍», «рахмат» в ответ на напоминание или наш ответ — это не вопрос.
  // Отвечать «какую технику ищете?» на «Ок» — верный способ выглядеть роботом.
  if (messenger) {
    // Чужой автоответ или наша же фраза, вернувшаяся эхом, — два бота заговорят друг с другом.
    if (isOtherBot(turns)) return { text: '', products: [], source: 'flow', silent: true, mute: true }
    if (isAcknowledgement(turns) || isJunk(turns)) return { text: '', products: [], source: 'flow', silent: true }
  }
  // Первое сообщение — одно приветствие («Салам», «Ассалому алейкум, яхшимисиз») — отвечаем сами:
  // модель за 10 тыс. токенов писала то же самое (владелец 04.10: «токен эконом, сифат тушмасин»).
  // Есть хоть слово сверх приветствия или разговор уже шёл — как обычно, отвечает модель.
  const greet = greetingOnly(turns, lang)
  if (greet) return { text: greet, products: [], source: 'flow' }
  // Идёт продажа (бот показывал товар) — это покупатель, даже если пишет о своём:
  // «Эртең Nova 7 сатсам…» у покупателя из Таласа модель сочла личным и замолчала.
  const selling = Array.isArray(shown) && shown.length > 0
  if (messenger) {
    const sorted = await sortByJev(channel, turns, lang, customer, selling)
    if (sorted) return sorted
  }
  const intent = hint.intent ?? null
  const talked = Array.isArray(shown) ? shown.filter((x): x is string => typeof x === 'string').slice(0, 5) : []
  const raw = await answer(turns, lang, customer, page, channel.known.name, Boolean(channel.known.phone), objectionNote(intent), talked, channel.leadChannel)
  // Согласился на заклад и назвал сумму — заказ, который начнётся на «да», пойдёт с ним
  if (raw.deposit) rememberDeposit(channel.key, raw.deposit)
  else if (FULL_PAY.test(turns[turns.length - 1]?.text ?? '')) forgetDeposit(channel.key)
  // Уступил в торге — заказ, который начнётся на «да», пойдёт со скидкой (поле или «4%» в его же тексте)
  const fromText = raw.discount === undefined && raw.price === undefined ? discountFromText(raw.text) : undefined
  const bargain = raw.discount ?? fromText
  // торговались о товаре из этого ответа, а нет его — о том, что показывали
  const dealProduct = raw.products[0]?.id ?? talked[0]
  if (bargain || raw.price) rememberDiscount(channel.key, bargain, raw.price, { productId: dealProduct, fromText: Boolean(fromText) })
  const plainText = withoutRepeatGreeting(withoutEarlyOffer(raw.text, turns), turns)
  // Анкета заказа открыта — в конце спрашиваем то, чего ждёт она, а не то, что придумала модель
  // обещал звонок — анкету не спрашиваем: дальше говорит человек
  const pending = raw.source === 'gemini' && plainText && !promisesCall(plainText) ? pendingQuestion(channel.key, talkLang(turns, lang)) : null
  const first = { ...raw, text: pending ? withPending(plainText, pending) : plainText }
  const said = declined(turns) || intent?.kind === 'decline' ? { ...first, text: withoutCallOffer(first.text) } : first
  const later = followAfter(intent)
  const reply = later ? { ...said, followAfter: later } : { ...said, followAfter: undefined }
  // Сайт — там только покупатели. В WhatsApp и Instagram модель ещё смотрит, кому адресовано.
  if (!messenger) return reply
  if (reply.audience === 'personal' && !selling) {
    return { text: '', products: [], source: reply.source, silent: true, mute: true }
  }
  if (reply.audience === 'personal') return reply
  // Модель пообещала звонок («руководство сизге жакын арада чалат») — значит, заявка
  // владельцу должна уйти на самом деле, иначе покупатель ждёт звонка, которого не будет.
  if (reply.audience !== 'staff' && promisesCall(reply.text) && channel.known.phone) {
    const talk = talkLang(turns, lang)
    const questions = turns.filter((t) => t.role === 'user').map((t) => t.text)
    const who = { name: cleanName(channel.known.name) ?? customer?.name ?? nameFromTurns(turns), phone: channel.known.phone }
    await startLead(channel.key, talk, leadContext(questions, []), who, channel.leadChannel)
    return { ...reply, handoff: true }
  }
  if (reply.audience === 'staff') return await toStaff(channel, turns, lang, customer, reply.source)
  return reply
}

/** Покупатель хочет живого человека или пишет работнику: заявка владельцу и короткая фраза. */
async function toStaff(channel: Channel, turns: ChatTurn[], lang: Lang, customer: CustomerBrief | null, source: Reply['source']): Promise<Reply> {
  const talk = talkLang(turns, lang)
  const where = channel.leadChannel === 'instagram' ? 'Instagram' : 'WhatsApp'
  // Все сообщения покупателя после ответа бота и сам ответ: одно последнее «Ошого карап акчамды топтой
  // берейин» владельцу ничего не говорит — о чём речь (посудомойка, цена), было в сообщениях раньше (04.10).
  const wrote = sinceBot(turns).join('\n')
  const bot = [...turns].reverse().find((t) => t.role === 'assistant')?.text ?? ''
  const before = bot ? `\n\nПеред этим магазин писал:\n${bot.slice(0, 300)}` : ''
  const context = `Сообщение для руководства (${where}):\n${wrote.slice(0, 600)}${before}`
  const who = whoOf(channel, turns, customer)
  // Номер в WhatsApp известен всегда — заявка уходит молча. Без номера анкету не заводим: это не «перезвоните».
  // В Instagram номера нет: сообщение увидит сотрудник в самом Instagram и в сводке «Ждут ответа».
  // Сегодня по этому чату уже ушла 🚨 жалоба — второй «📞 ПЕРЕЗВОНИТЬ» о том же владельцу не шлём.
  const complained = alerted.get(`complaint:${channel.key}`) === new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10)
  if (who.phone && !complained) await startLead(channel.key, talk, context, who, channel.leadChannel)
  // Короткая фраза на языке покупателя — так решил владелец. Но одна и та же три раза подряд —
  // это робот (переписка 01.10: покупатель трижды спросил цену и трижды получил «руководстводон
  // тактап, жазам»). Уже говорили — второй раз «уже передала», третий — молчим: ответит человек.
  const said = turns.filter((t) => t.role === 'assistant').slice(-2).filter((t) => isStaffAck(t.text)).length
  if (said >= 2) return { text: '', products: [], source, silent: true, handoff: true }
  const first = said === 0 ? pick(STAFF_ACK, talk) : pick(STAFF_ACK_AGAIN, talk)
  const ack = channel.leadChannel === 'instagram' && said === 0 ? `${first}\n${pick(WHATSAPP_LINE, talk)}` : first
  return { text: ack, products: [], source, handoff: true }
}

function whoOf(channel: Channel, turns: ChatTurn[], customer: CustomerBrief | null): { name?: string; phone?: string } {
  return { name: cleanName(channel.known.name) ?? customer?.name ?? nameFromTurns(turns), phone: channel.known.phone }
}

/**
 * Jev сортирует сообщение до Gemini (triage.ts): не покупателю модель не нужна. null — дальше как
 * обычно, отвечает Gemini. Пороги высокие: сомнение — всегда к модели, потерять покупателя хуже,
 * чем потратить один ответ. Идёт продажа — «не покупатель» не бывает, но чек и жалоба — бывают.
 */
async function sortByJev(channel: Channel, turns: ChatTurn[], lang: Lang, customer: CustomerBrief | null, selling: boolean): Promise<Reply | null> {
  const who = whoOf(channel, turns, customer)
  // Имена — не в Jev: «Азамат, …» в ответе бота и в словах покупателя станет «Имя».
  const scores = await triage(turns, [who.name, customer?.name, nameFromTurns(turns)])
  if (!scores) return null
  const own = sinceBot(turns).join('\n')
  const { kind, alarm } = decide(scores, selling, own)
  const label = channel.label ? { ...who, name: `${channel.label}${who.name ? `, ${who.name}` : ''}` } : who
  const talk = talkLang(turns, lang)
  const day = new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10)
  if (alarm && alerted.get(`complaint:${channel.key}`) !== day) {
    // Отвечает покупателю по-прежнему Gemini (посочувствует и скажет, что сделаем), а владелец знает сразу.
    // Одна тревога на чат в день — и отмечаем, только если дошла: сервер лежал — попробуем со следующим сообщением.
    const bot = [...turns].reverse().find((t) => t.role === 'assistant')?.text ?? ''
    const before = bot ? `\n\nПеред этим магазин писал:\n${bot.slice(0, 300)}` : ''
    if (await notifyOwner('complaint', `Написал:\n${own.slice(0, 700)}${before}`, label, channel.leadChannel, channel.key)) {
      alerted.set(`complaint:${channel.key}`, day)
    }
  }
  // «Төлөдүмбү? Карызым канча?» — вопрос про рассрочку, а не чек: на него ответит модель по данным 1С.
  if (kind === 'payment' && !asksAboutPayment(own)) {
    const sum = paidAmount(own)
    const text = `${sum ? `Сумма: ${sum} сом (по словам или чеку покупателя)\n` : ''}Написал:\n${own.slice(0, 700)}`
    await notifyOwner('payment', text, label, channel.leadChannel, channel.key)
    return { text: pick(PAID_ACK, talk), products: [], source: 'flow', handoff: true }
  }
  if (kind === 'personal') return { text: '', products: [], source: 'flow', silent: true, mute: true }
  if (kind === 'staff') return await toStaff(channel, turns, lang, customer, 'flow')
  return null
}

/**
 * Покупатель спрашивает, а не сообщает: «Төлөдүмбү?», «Пул тушдими?», «карызым канча калды?».
 * Только его собственные слова: описание чека («[Фото] …») — текст модели, вопросом не бывает.
 * looksLikeQuestion тут не годится — у неё «больше пяти слов» уже вопрос.
 */
function asksAboutPayment(text: string): boolean {
  const own = text
    .split('\n')
    .filter((line) => !/^\[(Фото|Ответ на)/.test(line.trim()))
    .join(' ')
    .replace(/^\[Голосовое\]\s*/gm, '')
  return own.includes('?') || /[\p{L}]{2,}(бы|бу|пы|пу|би|бү|пү|ми|мы)(?![\p{L}])/iu.test(own)
}

/** Одно предупреждение о жалобе на чат в день: на «синди», «ишлебей атат», «качан?» — не три тревоги. */
const alerted = durableMap<string, string>('owner-alerts', 2 * 24 * 3600 * 1000)

const PAID_ACK = {
  ru: 'Рахмат! Руководство проверит оплату и напишет вам.',
  ky: 'Рахмат! Руководство төлөмдү текшерип, жазат.',
  uz: 'Рахмат! Руководство туловни текшириб, ёзади.',
}

/** Слова приветствия на трёх языках (и как их пишут с ошибками), обращения «ака», «уко». */
const GREET_WORD =
  '(салам|саламатсызбы|саламатсыңарбы|саламатсынарбы|салом|ассалому|ассалом|ассаламу|ассалам|асалому|асаламу|алейкум|алайкум|алекум|алейкум|ваалейкум|валейкум|assalomu|assalom|assalamu|salom|salam|alaykum|aleykum|привет|здравствуйте|здраствуйте|добрый|день|вечер|утро|кандайсыз|кандайсыз|яхшимисиз|йахшимисиз|жакшысызбы|ало|алло|ака|ука|уко|уков|укам|эже|опа|ассалом|ва|рахматуллахи|ва|баракатух)'
const GREETING = new RegExp(`^[\\s\\p{P}\\p{S}]*(?:${GREET_WORD}[\\s\\p{P}\\p{S}]*){1,6}$`, 'iu')
const GREET_REPLY = {
  ru: 'Ассаламу алейкум. Слушаю вас — что подобрать?',
  ky: 'Ассаламу алейкум. Угуп жатам, кандай техника керек?',
  uz: 'Ассаламу алейкум. Эшитаман, кандай техника керак?',
}

/** Первое и единственное, что написал покупатель, — приветствие. Иначе null. */
function greetingOnly(turns: ChatTurn[], lang: Lang): string | null {
  if (turns.some((t) => t.role === 'assistant')) return null
  const own = turns.map((t) => t.text.trim()).filter(Boolean)
  if (own.length === 0 || !own.every((t) => t.length <= 60 && GREETING.test(t))) return null
  const all = own.join(' ').toLowerCase()
  // По самому приветствию язык виден лучше, чем по общему правилу: «Ассалому» — узбек, «Саламатсызбы» — кыргыз.
  const talk = /(ассалому|асалому|салом|яхшимисиз|йахшимисиз|уко|assalomu|salom)/.test(all)
    ? 'uz'
    : /(саламатсы|жакшысызбы|кандайсыз|эже)/.test(all)
      ? 'ky'
      : /(привет|здра|добрый)/.test(all)
        ? 'ru'
        : talkLang(turns, lang)
  return pick(GREET_REPLY, talk)
}

/**
 * Магазин уже поздоровался в этом разговоре (наш ответ на комментарий «Ассаламу алейкум! Кайсы товар…»,
 * прошлый ответ) — второй раз «Ассаламу алейкум.» в начале не пишем (Instagram 04.10: здоровался дважды подряд).
 */
const GREET_START = /^\s*(ассал[ао]му?\s+ал[еа]йкум|ваалейкум\s+ассалам|здравствуйте|саламатсызбы)[^.!?\n]{0,40}[.!]\s*/iu
export function withoutRepeatGreeting(text: string, turns: ChatTurn[]): string {
  const greeted = turns.some((t) => t.role === 'assistant' && /(ассал[ао]му?\s+ал[еа]йкум|здравствуйте)/iu.test(t.text))
  if (!greeted) return text
  const rest = text.replace(GREET_START, '')
  if (!rest.trim()) return text
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}

/** «А жок рахмат», «нет, спасибо» — покупатель отказался. */
const DECLINE = /(^|[\s,.!])(жок|йук|йўқ|нет|не надо|не нужно|не хочу|керек эмес|керакмас|kerak emas|yo.?q)($|[\s,.!])/iu
function declined(turns: ChatTurn[]): boolean {
  const last = turns[turns.length - 1]
  return last?.role === 'user' && last.text.trim().length <= 40 && DECLINE.test(last.text)
}

/** После отказа второй раз «позвонить вам?» не предлагаем — достаточно короткого прощания. */
function withoutCallOffer(text: string): string {
  const kept = text.split(/(?<=[.!?])\s+/).filter((sentence) => !CALL_OFFER.test(sentence))
  return kept.length > 0 ? kept.join(' ') : text
}

/** Короткое «понял/спасибо» на трёх языках, эмодзи и знаки — без единого вопроса. */
const ACK_WORD =
  '(родной|радной|укам|ука|ака|дорогой|жаным|досм|братан|ок|ok|окей|okay|хорошо|ладно|понял|поняла|понятно|спасибо|благодарю|макул|болду|болот|түшүндүм|тушундум|рахмат|ырахмат|чоң рахмат|катта рахмат|жарайт|хоп|хуп|яхши|тушундим|тушунарли|майли|mayli|xop|rahmat|yaxshi|tushundim|ha|ха|да|ооба|вам|сизге|сизга|👍|👌|🙏|✅|❤️|👍🏻|👍🏼|👍🏽|🤝)'
/** До трёх «ок/спасибо/рахмат» подряд, с любыми знаками и эмодзи вокруг. */
const ACK = new RegExp(`^[\\s\\p{P}\\p{S}]*(?:${ACK_WORD}[\\s\\p{P}\\p{S}]*){0,3}$`, 'iu')

/** Автоответ чужого WhatsApp Business или наша же фраза, пришедшая назад. */
const OTHER_BOT =
  /(спасибо за (ваше )?обращение|благодарим за (ваше )?(обращение|сообщение)|добро пожаловать!|мы (скоро )?(ответим|свяжемся)|сейчас (мы )?не на связи|автоответ|in the office|we are (currently )?away|thanks for (contacting|your message)|successfully connected|business portfolio|facebook page|whatsapp business account|кайрылганыңыз үчүн рахмат|murojaatingiz uchun rahmat)/i

function isOtherBot(turns: ChatTurn[]): boolean {
  const last = turns[turns.length - 1]
  if (!last || last.role !== 'user') return false
  const text = last.text.trim()
  if (OTHER_BOT.test(text)) return true
  const ours = turns.filter((t) => t.role === 'assistant').slice(-4).map((t) => t.text.trim())
  return text.length > 8 && ours.includes(text)
}

/** «{{SWE001}}», один знак, e-mail — сообщение не человеку, отвечать нечего. */
/**
 * Покупатель сам показал, что готов: как оплатить или купить, когда привезёте, понравилось,
 * подходит, назвал адрес. На трёх языках, как пишут на самом деле.
 */
export const READY =
  /(как (оплатить|платить|купить|заказать)|куда (платить|перевести|скинуть)|нравится|понравил|подходит|устраивает|когда (привез|доставит|будет)|адрес|кантип (төлө|толо|сатып ал|заказ)|кандай (төлө|толо)|качан (алып кел|жеткир|келет)|жакты|жагып|туура келет|дарек|qanday to.?la|qachon olib|qachon yetkaz|кандай тула|качон олиб кел|качон етказ|ёкди|ёкяпти|ёкиб|маъкул|yoqdi|manzil|манзил)/iu

/**
 * «Оформляем?» — только по ситуации (владелец 01.10 и 03.10: «оформит қилайлик деб сўрамасин,
 * вазиятга қараб айтсин»). Модель всё равно вставляет его по привычке, поэтому код
 * оставляет предложение, только если:
 *   • это не первый ответ и за три последних ответа оформить не предлагали;
 *   • и покупатель подал знак, что готов (READY, «беру»), — или разговор о товаре идёт
 *     давно (три сообщения покупателя и больше), а оформить не предлагали ни разу.
 * Иначе фраза с «Оформляем?» убирается — остаётся ответ и вопрос о деле.
 */
function withoutEarlyOffer(text: string, turns: ChatTurn[]): string {
  if (!OFFER.test(text)) return text
  const ours = turns.filter((t) => t.role === 'assistant')
  const theirs = sinceBot(turns).join(' ')
  const ready = READY.test(theirs) || BUY_INTENT.test(theirs)
  const ripe = turns.filter((t) => t.role === 'user').length >= 3 && !ours.some((t) => OFFER.test(t.text))
  const recently = ours.slice(-3).some((t) => OFFER.test(t.text))
  if (ours.length > 0 && !recently && (ready || ripe)) return text
  const kept = text.split(/(?<=[.!?])\s+/).filter((sentence) => !OFFER.test(sentence))
  // Остался один «Ассаламу алейкум.» — значит, вырезали сам ответ: лучше не трогать.
  const rest = kept.join(' ')
  return rest.replace(/ассал[ао]му?\s+ал[еа]йкум\.?/giu, '').trim().length > 0 ? rest : text
}

/** Наличные: «наличка», «накталай», «нахт» — про оплату, не про покупку. */
const CASH = /(наличк|наличн|накталай|накд|нахт|naqd|nalichk)/i

/** Вопрос без «?»: кыргызское/узбекское «…болобу», «…барбы», «…борми» в конце. */
function asks(text: string): boolean {
  return looksLikeQuestion(text) || /[\p{L}]{2,}(бы|бу|пы|пу|би|бү|пү|ми|мы)$/iu.test(text.trim())
}

/** Текст без цитаты «[Ответ на сообщение: …]» — только слова покупателя. */
function withoutQuote(text: string): string {
  return text.replace(/^\[Ответ на[^\]]*\]\s*/u, '').trim()
}

/** Сообщения покупателя после последнего ответа бота: пишут очередью, «Адрес скиньте», «Или локацию», «?». */
function sinceBot(turns: ChatTurn[]): string[] {
  const out: string[] = []
  for (let i = turns.length - 1; i >= 0 && turns[i].role === 'user'; i--) out.unshift(turns[i].text.trim())
  return out
}

// «[Прислал публикацию из Instagram]» без подписи и без слов — чаще всего мем от подписчика.
// Отвечает сотрудник (решение владельца 02.10); рилс с подписью о товаре консультант читает.
const BARE_SHARE = /^\[Прислал публикацию из Instagram\]$/
const JUNK = (text: string) => /^\{\{[^}]*\}\}$/.test(text) || /^[\p{P}\p{S}]{1,3}$/u.test(text) || /^[\w.+-]+@[\w-]+\.[\w.]+$/.test(text) || BARE_SHARE.test(text)
/** Мусор — только если ВСЁ после ответа бота мусор: «?» после «Адрес скиньте» — это «ну ответьте же». */
function isJunk(turns: ChatTurn[]): boolean {
  const own = sinceBot(turns)
  return own.length > 0 && own.every(JUNK)
}

function isAcknowledgement(turns: ChatTurn[]): boolean {
  const last = turns[turns.length - 1]
  if (!last || last.role !== 'user') return false
  const text = last.text.trim()
  if (!text || text.length > 40 || !ACK.test(text)) return false
  // «Адрес скиньте» + «Ок» — вопрос остался без ответа.
  if (sinceBot(turns).some((t) => !(t.length <= 40 && ACK.test(t)) && !JUNK(t))) return false
  // Бот ждёт ответа, только если его последняя фраза — вопрос («Как вас зовут?»).
  // «Чем могу помочь? Если ищете технику — подберу.» вопросом не считается.
  const before = [...turns].reverse().find((t) => t.role === 'assistant')
  return !before || !before.text.trim().endsWith('?')
}

const STAFF_ACK = {
  ru: 'Поняла, уточню у руководства и напишу вам.',
  ky: 'Түшүндүм, руководстводон тактап, жазам.',
  uz: 'Тушундим, руководстводан аниклаб, ёзаман.',
}
const STAFF_ACK_AGAIN = {
  ru: 'Уже передала руководству — скоро ответят.',
  ky: 'Руководствого айтып койдум, жакында жооп беришет.',
  uz: 'Руководствога айтдим, тез орада жавоб беришади.',
}
/** Наша фраза «уточню у руководства» (любой вариант, любой язык) — первая строка ответа. */
function isStaffAck(text: string): boolean {
  const first = text.split('\n')[0].trim()
  return [STAFF_ACK, STAFF_ACK_AGAIN].some((say) => Object.values(say).includes(first))
}
// В Instagram номера покупателя нет — заявку не завести; пусть знает, где ответят быстрее.
const WHATSAPP_LINE = {
  ru: `Быстрее ответим в WhatsApp: ${phones[0].display}`,
  ky: `WhatsApp'тан тезирээк жооп беребиз: ${phones[0].display}`,
  uz: `WhatsApp'да тезрок жавоб берамиз: ${phones[0].display}`,
}
const pick = (say: Record<'ru' | 'ky' | 'uz', string>, lang: 'ru' | 'ky' | 'uz') => say[lang]

/**
 * Продавец доводит до покупки: «Заказать» у карточки, «беру», «да» на
 * «оформим?» — и заказ оформляется прямо в разговоре; «перезвоните» — номер
 * уходит сотруднику. null — это обычный вопрос, отвечает консультант.
 */
async function salesFlow(
  channel: Channel,
  turns: ChatTurn[],
  lang: Lang,
  customer: CustomerBrief | null,
  buy: unknown,
  shownRaw: unknown,
  page?: string,
  hint: { intent?: Intent | null } = {},
): Promise<Reply | null> {
  const { key, known, orderSource } = channel
  // «[Ответ на сообщение: …Кайда жеткирели?] Учкун айылына жеткирип бериң» — в цитате наш
  // вопрос со знаком «?», и анкета решала, что это вопрос покупателя, и начиналась заново.
  const text = withoutQuote(turns[turns.length - 1]?.text ?? '')
  // «Всё сразу оплачу» — заказ на всю сумму: названный раньше заклад забываем ДО анкеты (её «оформ…» сюда и ведёт)
  if (FULL_PAY.test(text)) forgetDeposit(key)
  // «1000 оа» на «1 000 сом бере аласызбы?» — анкета начнётся без модели, сумму берём из ответа сами
  const saidDeposit = depositFromReply(text, [...turns].reverse().find((t) => t.role === 'assistant')?.text ?? '', hasDraft(key))
  if (saidDeposit) rememberDeposit(key, saidDeposit)
  // Среди сообщений очереди есть вопрос («Акчасын алып келгенде берсем болобу?» + «Оа») —
  // сначала ответ на него, «оа» согласием на заказ не считаем.
  const askedToo = sinceBot(turns).slice(0, -1).some((t) => asks(withoutQuote(t)))
  const talk = talkLang(turns, lang)
  const only = (reply: string, handoff = false): Reply => ({ text: reply, products: [], source: 'flow', handoff })
  const who = { name: cleanName(known.name) ?? customer?.name ?? nameFromTurns(turns), phone: known.phone }

  // Передумал посреди шагов — выходим, не доспрашивая.
  if (/^(отмена|стоп|bekor|бекор|токтот|жок|cancel|не надо)$/i.test(text.trim()) && (hasDraft(key) || hasLead(key))) {
    cancel(key)
    cancelLead(key)
    return only(
      talk === 'ky' ? 'Макул, токтоттук. Дагы эмне керек?' : talk === 'uz' ? 'Майли, тухтатдик. Яна нима керак?' : 'Хорошо, отменил. Чем ещё помочь?',
    )
  }

  const lead = await leadStep(key, text, talk)
  if (lead) return only(lead, true)

  // Очередь сообщений на шаге анкеты: берём то, что похоже на ответ, а не последнее.
  // «Кызыл-кыя шаарына даставка…» + «Мбанк номер жоноткуло» — город Кызыл-Кыя.
  const queue = sinceBot(turns).map(withoutQuote).filter((t) => t && !PAY_ASIDE.test(t) && !t.includes('?'))
  const stepText = hasDraft(key) && queue.length > 0 && PAY_ASIDE.test(text) ? queue.join(', ') : text
  const ongoing = await step(key, stepText, talk, lang)
  if (ongoing) return only(ongoing)

  const find = lookupIn(await salesCatalogNow())
  let shown = Array.isArray(shownRaw) ? shownRaw.filter((x): x is string => typeof x === 'string').slice(0, 3) : []
  // Консультант ещё ничего не показывал, но открыта страница товара — «беру» про него.
  if (shown.length === 0 && page && find(page)) shown = [page]
  // Товар назван словами, а карточки не было («флагман 21400 сомликдан», сайт 08.10) — узнаём его из разговора,
  // иначе «да» и номер телефона шли мимо формы заказа, и покупатель оставался без ссылки
  if (shown.length === 0) {
    const guess = bestNameMatch(turns.slice(-6).map((t) => withoutQuote(t.text)).join('\n'), await salesCatalogNow())
    if (guess) shown = [guess.id]
  }
  const shownNames = shown.map((id) => find(id)?.nameRu).filter((x): x is string => Boolean(x))

  if (typeof buy === 'string' && find(buy)) {
    cancelLead(key)
    return only(await start(key, [buy], talk, orderSource, who, wantedQty(text)))
  }

  // «Позвонить вам?» — «да» / «ооба» / «ха»: заявка на звонок без всяких кодовых слов.
  const botAsked = [...turns].reverse().find((t) => t.role === 'assistant')?.text ?? ''
  const offeredCall = CALL_OFFER.test(botAsked)
  // На наш вопрос ответ короткий — его смысл читает Jev: списки слов не знали «Ладно давайте»,
  // «Жарайт, берип коюңуз», «Апама айтып көрөйүн». Нет ключа или Jev молчит — работают списки.
  if ((offeredCall || OFFER.test(botAsked)) && text.length <= 160 && jevConfigured()) hint.intent = await readAnswer(botAsked, text)
  const jevYes = isSureYes(hint.intent ?? null, text)
  // Jev уверенно слышит «потом» / «нет» / вопрос — «макул» из списка согласием не считаем.
  const jevNo = Boolean(hint.intent && ['later', 'decline', 'question'].includes(hint.intent.kind) && hint.intent.confidence >= 0.8)
  // «Макул, мен 9 жаштамын, чоңдору барбы?» — не согласие на звонок, а новый вопрос: на него отвечает модель.
  const callYes = ((AFFIRM.test(text.trim()) && !looksLikeQuestion(text) && !jevNo) || jevYes) && !askedToo
  if (CALL_INTENT.test(text) || (offeredCall && callYes)) {
    cancel(key)
    const questions = turns.filter((t) => t.role === 'user').map((t) => t.text)
    const reply = await startLead(key, talk, leadContext(questions, shownNames), who, channel.leadChannel)
    // Номер уже известен — заявка ушла сразу, дальше разговор ведёт человек.
    return only(reply, Boolean(who.phone))
  }

  // Покупатель, которому показали товар, прислал свой номер («0700441154 синий») —
  // он оформляет заказ. Номер — только для заказа: ни бонусов, ни чужих данных он не открывает.
  const typedPhone = phoneIn(text)
  // Только если мы предлагали оформить или он сам пишет «беру»: номер «чтобы перезвонили»
  // (Самара — «номериңизди калтырыңыз») заказом не становится.
  const lastBot = [...turns].reverse().find((t) => t.role === 'assistant')?.text ?? ''
  if (shown.length > 0 && typedPhone && !hasDraft(key) && (OFFER.test(lastBot) || BUY_INTENT.test(text))) {
    return only(await start(key, shown, talk, orderSource, { name: who.name, phone: who.phone ?? typedPhone }, wantedQty(text.replace(typedPhone, ''))))
  }
  // «Приеду и возьму сам», «барып алам», «o'zim boraman» — это визит в магазин, не заказ: пусть консультант даст адрес.
  const visiting = VISIT.test(text)
  // «беру», «куда платить» — или «да» сразу после того, как консультант предложил оформить.
  const lastAnswer = [...turns].reverse().find((t) => t.role === 'assistant')?.text ?? ''
  // Длинная фраза со словом «заказ» — обычно вопрос («если закажем, оплатить
  // при получении можно?»). На него отвечает консультант, а не анкета заказа.
  // «Мен наличка алам» — «заплачу наличными», а не «беру»: про оплату отвечает консультант.
  const wantsToBuy = BUY_INTENT.test(text) && !visiting && !CASH.test(text) && !looksLikeQuestion(text.replace(/\?/g, '')) && !DEFER.test(text)
  // «Ооба, но денег пока нет, через 5 дней» — это не «да».
  // «1000 оа» на «1 000 сом бере аласызбы?» — назвал сумму заклада: это тоже «да»
  const agreed = OFFER.test(lastAnswer) && (((AFFIRM.test(text) || Boolean(saidDeposit)) && !looksLikeQuestion(text) && !DEFER.test(text) && !jevNo) || jevYes) && !askedToo
  if (shown.length > 0 && (wantsToBuy || agreed)) {
    const first = await start(key, shown, talk, orderSource, who, wantedQty(text))
    // «улица Эркин-Эл, 20 Бишкек» вместо «да» — адрес уже есть, второй раз «Кайда жеткирели?» не спрашиваем.
    if (FULL_ADDRESS.test(text) && /\d/.test(text.replace(/https?:\/\/\S+/gi, ''))) {
      const done = await step(key, text, talk, lang)
      if (done) return only(done)
    }
    return only(first)
  }
  return null
}

/** Обещание позвонить — утверждение, не вопрос: «руководство чалат», «позвоним», «кунгирок килишади». */
// «Хозир руководствога етказаман, сизга хабар беришади» — тоже обещание: без заявки жалоба
// на сломанную стиралку не дошла до владельца (аудит 01.10).
const CALL_PROMISE = /(етказаман|етказамиз|передам руководств|руководствого айтып|руководствога айтаман|хабар беришади|сообщу руководств|чалат|чалып (берет|берешет|коёт|тактайт)|чалабыз|позвоним|перезвоним|позвонят|перезвонят|свяжутся|кунгирок килади|кунгирок килишади|кунгирок киламиз|богланишади|байланышат)/i
function promisesCall(text: string): boolean {
  return text
    .split(/(?<=[.!?])\s+/)
    .some((sentence) => CALL_PROMISE.test(sentence) && !sentence.trim().endsWith('?'))
}

/** Номер телефона в тексте: 0700 441 154, +996 700 441154, 996700441154. */
function phoneIn(text: string): string | undefined {
  const m = text.match(/(?:\+?996[\s-]?|0)\d{3}[\s-]?\d{2,3}[\s-]?\d{2,3}[\s-]?\d{0,2}/)
  if (!m) return undefined
  const digits = m[0].replace(/\D/g, '')
  return digits.length >= 9 && digits.length <= 12 ? m[0] : undefined
}

/** Едет в магазин сам — не заказ. */
const VISIT = /(барып|барам|барайын|барабыз|бараман|өзүм барам|озум барам|келип ал|kelib ol|келиб ол|boraman|borib|бораман|бориб|приеду|приедем|заеду|сам приду|сам заберу)/iu

/**
 * Сколько штук: «беру 2», «2 шт», «иккита», «эки даана». Нет числа — одна.
 * «8 кг», «2 камеры» — это не количество.
 */
export function wantedQty(text: string): number {
  // Кнопка «Заказать: Электро Велик GEPARD M2 16'» — в названии «2» из «M2», а не «2 штуки»:
  // заказ ушёл на два велосипеда и не прошёл (журнал сайта 02.10). У кнопки всегда одна штука.
  if (/^(заказать|buyurtma|заказ кылуу|тариздөө)\s*:/i.test(text.trim())) return 1
  const low = text.toLowerCase()
  const words: [RegExp, number][] = [
    [/(?<![\p{L}])(два|две|иккита|ikkita|экөө|эки даана|эки|ikki|икки)(?![\p{L}])/u, 2],
    [/(?<![\p{L}])(три|учта|uchta|үч даана|үчөө|uch|уч)(?![\p{L}])/u, 3],
    [/(?<![\p{L}])(четыре|туртта|to'rtta|төртөө|төрт даана)(?![\p{L}])/u, 4],
    [/(?<![\p{L}])(пять|бешта|beshta|бешөө|беш даана)(?![\p{L}])/u, 5],
  ]
  for (const [re, n] of words) if (re.test(low)) return n
  // Цифра внутри модели («M2», «X5», «A10») — не количество: перед ней не должно быть буквы.
  const m = low.match(/(?<![\p{L}\d.,-])([2-9])\s*(?:шт|штук|даана|та|дона|ta|dona|ни|шт\.)?(?!\s*(кг|kg|л\b|литр|см|мм|м\b|год|жыл|йил|мес|ой|ай|камер|конф|скорост|программ))(?![\p{L}\d])/u)
  return m ? Number(m[1]) : 1
}

/** Бот спросил имя. */
const ASKED_NAME = /(как (вас|к вам) (зовут|обращаться)|атыңыз ким|атыныз ким|кантип кайрыл|ismingiz|isminggiz|исмингиз)/i
/** «Меня зовут Азамат», «менин атым Азамат», «mening ismim Aziz». */
const SAID_NAME = /(?:меня зовут|зовут меня|менин атым|атым|mening ismim|ismim|исмим)\s+([\p{L}'-]{2,30})/iu

/**
 * Имя покупателя из разговора: он назвал его сам или ответил на вопрос бота.
 * Иначе анкета заказа спросит имя второй раз — и человек решит, что его не слушают.
 */
export function nameFromTurns(turns: ChatTurn[]): string | undefined {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i]
    if (turn.role !== 'user') continue
    const said = turn.text.match(SAID_NAME)
    if (said) return capital(said[1])
    const before = turns[i - 1]
    if (before?.role === 'assistant' && ASKED_NAME.test(before.text)) {
      // Короткий ответ без цифр — имя. «Азамат», «Айка.», «Нурлан, нас четверо» — первое слово.
      const word = turn.text.trim().split(/[\s,.!]+/)[0] ?? ''
      if (/^[\p{L}'-]{2,30}$/u.test(word) && !/^(да|нет|ha|yo'q|ооба|жок)$/i.test(word)) return capital(word)
    }
  }
  return undefined
}

function capital(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/**
 * Что консультант знает о покупателе — имя, бонусы, заказы, рассрочка.
 *
 * phone — ТОЛЬКО подтверждённый: из входного cookie сайта или номер, с
 * которого человек пишет в WhatsApp. Номер, написанный в тексте, сюда не
 * попадает никогда: иначе любой узнал бы чужие заказы и долг.
 */
export async function customerBrief(phone: string | undefined): Promise<CustomerBrief | null> {
  if (!phone) return null
  try {
    const [profile, installment] = await Promise.all([
      getProfile(phone, 0, true),
      // Рассрочка — отдельный запрос: сервер без неё не должен ломать чат.
      getInstallment(phone).catch((error) => {
        console.error('[assistant] рассрочка:', error instanceof Error ? error.message : error)
        return null
      }),
    ])
    if (!profile) return null
    return {
      installment: installment && {
        debt: installment.debt,
        overdue: installment.overdue,
        nextDate: installment.nextDate,
        nextAmount: installment.nextAmount,
        monthsLeft: installment.monthsLeft,
        asOf: installment.asOf ? installment.asOf.slice(0, 10) : null,
      },
      name: profile.name,
      balance: profile.balance,
      maxSpendPct: profile.maxSpendPct,
      maxSpendCap: profile.maxSpendCap ?? 0,
      orders: (profile.orders ?? []).map((o) => ({
        id: o.orderId,
        status: o.status,
        total: o.total,
        createdAt: o.createdAt,
      })),
    }
  } catch (error) {
    console.error('[assistant] профиль покупателя:', error instanceof Error ? error.message : error)
    return null
  }
}

/** Сколько сообщений разговора отдаём модели. Дальше платим за чужую историю. */
const MAX_TURNS = 12
const MAX_CHARS = 800

export function readTurns(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return []
  const turns: ChatTurn[] = []
  for (const item of value.slice(-MAX_TURNS)) {
    if (!item || typeof item !== 'object') continue
    const row = item as { role?: unknown; text?: unknown }
    const text = typeof row.text === 'string' ? row.text.trim().slice(0, MAX_CHARS) : ''
    if (!text) continue
    turns.push({ role: row.role === 'assistant' ? 'assistant' : 'user', text })
  }
  // Реплики магазина до первого слова покупателя не выбрасываем (05.10): «Ассаламу алейкум! Кайсы товар
  // кызыктырды?» под комментарием — без неё бот здоровался второй раз (142 раза за сутки) и не видел, что
  // разговор начат по-кыргызски. Модели нужен первым вопрос покупателя — это решает gemini.ts (request).
  return turns
}
