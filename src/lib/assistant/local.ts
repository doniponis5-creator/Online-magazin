/**
 * Запасной режим консультанта — без языковой модели.
 *
 * Нужен в двух случаях: ключа GEMINI_API_KEY ещё нет (проверка на своём
 * компьютере) и Gemini не ответил (упал, кончился лимит, нет интернета).
 * Покупатель в обоих случаях получает ответ по каталогу и телефон магазина,
 * а не пустое окно.
 *
 * Говорит на трёх языках: русском, кыргызском и узбекском. Узбекский нужен не
 * для красоты — магазин стоит в Араванском районе, где по-узбекски говорят
 * каждый день, и пишут его и латиницей, и кириллицей.
 *
 * Здесь нет обращений к сети — этот файл проверяется тестами.
 */

import { phones } from '@/data/contacts'
import { formatSom } from '@/lib/format'
import type { Lang } from '@/lib/i18n/config'
import { PRODUCTS_MARKER } from './prompt'
import type { Product } from '@/data/products'
import { isInStock, searchProducts, type CustomerBrief } from './knowledge'
import { orderStatusWord } from './orders'
import { detectLang, type TalkLang } from './talk'

export { detectLang }
export type { TalkLang }

export type Answer = { text: string; productIds: string[] }

type Say = { ru: string; ky: string; uz: string }

const pick = (say: Say, lang: TalkLang) => say[lang]

/**
 * Ответ модели → текст + список товаров.
 *
 * Модель дописывает последнюю строку «TOVAR: id1, id2». Её убираем из текста:
 * покупателю нужны карточки, а не служебные строки.
 */
export function parseAnswer(raw: string): Answer {
  const lines = raw.replace(/\r/g, '').split('\n')
  const productIds: string[] = []
  const kept: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.toUpperCase().startsWith(PRODUCTS_MARKER)) {
      const ids = trimmed
        .slice(PRODUCTS_MARKER.length)
        .split(',')
        .map((id) => id.trim().replace(/^[`*[\]]+|[`*[\]]+$/g, ''))
        .filter(Boolean)
      productIds.push(...ids)
      continue
    }
    kept.push(line)
  }

  return {
    text: kept.join('\n').trim(),
    productIds: [...new Set(productIds)].slice(0, 3),
  }
}

const phoneList = phones.map((p) => p.display).join(', ')

// ── Приветствие ───────────────────────────────────────────────────────────────

/** По имени, если человек вошёл. Это первое, из-за чего чат кажется живым. */
function helloText(lang: TalkLang, customer: CustomerBrief | null): string {
  const name = customer?.name?.trim()
  if (name) {
    return pick(
      {
        ru: `Здравствуйте, ${name}! Рады вас видеть. Чем помочь?`,
        ky: `Саламатсызбы, ${name}! Сизди көргөнүбүзгө кубанычтабыз. Кандай жардам керек?`,
        uz: `Assalomu alaykum, ${name}! Sizni ko'rganimizdan xursandmiz. Qanday yordam kerak?`,
      },
      lang,
    )
  }
  return pick(
    {
      ru: 'Здравствуйте! Какая техника нужна? Напишите — найду по каталогу.',
      ky: 'Саламатсызбы! Кандай техника издеп жатасыз? Жазыңыз — каталогдон табып берем.',
      uz: "Assalomu alaykum! Qanday texnika kerak? Yozing — katalogdan topib beraman.",
    },
    lang,
  )
}

// ── Рассрочка ─────────────────────────────────────────────────────────────────

/**
 * Честный ответ про рассрочку.
 *
 * Остаток и число месяцев считает 1С, сайт их не получает. Придумать цифру
 * нельзя ни в коем случае: человек поверит и придёт с ней в магазин.
 */
function installmentText(lang: TalkLang, customer: CustomerBrief | null): string {
  const body = pick(
    {
      ru: `по рассрочке я цифру не назову — остаток и месяцы считает программа магазина, в чат они пока не приходят. Позвоните, и вам скажут точно: ${phoneList}.`,
      ky: `бөлүп төлөө боюнча санды айта албайм — калганын жана айларды дүкөндүн программасы эсептейт, чатка азырынча келбейт. Чалыңыз, так айтышат: ${phoneList}.`,
      uz: `bo'lib to'lash bo'yicha raqamni ayta olmayman — qoldiq va oylarni do'kon dasturi hisoblaydi, chatga hozircha kelmaydi. Qo'ng'iroq qiling, aniq aytishadi: ${phoneList}.`,
    },
    lang,
  )
  return withName(body, customer)
}

/** «Азамат, по рассрочке…» — а без имени фраза начинается с заглавной буквы. */
function withName(body: string, customer: CustomerBrief | null): string {
  const name = customer?.name?.trim()
  if (name) return `${name}, ${body}`
  return body.charAt(0).toUpperCase() + body.slice(1)
}

// ── Заказы ────────────────────────────────────────────────────────────────────

function ordersText(lang: TalkLang, customer: CustomerBrief | null): string {
  if (!customer) {
    return pick(
      {
        ru: `Чтобы посмотреть ваш заказ, войдите по номеру телефона — кнопка «Кабинет» вверху. Или позвоните нам: ${phoneList}.`,
        ky: `Заказыңызды көрүү үчүн телефон номери менен кириңиз — жогорудагы «Кабинет» баскычы. Же бизге чалыңыз: ${phoneList}.`,
        uz: `Buyurtmangizni ko'rish uchun telefon raqami bilan kiring — yuqoridagi «Кабинет» tugmasi. Yoki bizga qo'ng'iroq qiling: ${phoneList}.`,
      },
      lang,
    )
  }

  if (customer.orders.length === 0) {
    return pick(
      {
        ru: 'Заказов на сайте у вас пока нет. Если покупали в магазине, спросите у сотрудника — в чате таких покупок не видно.',
        ky: 'Сайтта заказыңыз азырынча жок. Дүкөндөн алган болсоңуз, кызматкерден сураңыз — чатта мындай сатып алуулар көрүнбөйт.',
        uz: "Saytda buyurtmangiz hozircha yo'q. Do'kondan olgan bo'lsangiz, xodimdan so'rang — chatda bunday xaridlar ko'rinmaydi.",
      },
      lang,
    )
  }

  const head = pick(
    { ru: 'Ваши последние заказы:', ky: 'Акыркы заказдарыңыз:', uz: "So'nggi buyurtmalaringiz:" },
    lang,
  )
  const lines = customer.orders
    .slice(0, 3)
    .map((o) => `• ${o.id} — ${orderStatusWord(o.status, lang)}, ${formatSom(o.total)}`)
  return [head, ...lines].join('\n')
}

// ── Бонусы ────────────────────────────────────────────────────────────────────

function bonusText(lang: TalkLang, customer: CustomerBrief | null): string {
  if (!customer) {
    return pick(
      {
        ru: 'Бонусы SBonus копятся с покупок, и частью бонусов можно закрыть следующий заказ. Чтобы увидеть свой счёт, войдите по номеру телефона.',
        ky: 'SBonus бонустары сатып алуудан чогулат жана кийинки заказдын бир бөлүгүн жабат. Эсебиңизди көрүү үчүн телефон номери менен кириңиз.',
        uz: "SBonus bonuslari xaridlardan yig'iladi va keyingi buyurtmaning bir qismini yopadi. Hisobingizni ko'rish uchun telefon raqami bilan kiring.",
      },
      lang,
    )
  }
  return pick(
    {
      ru: `У вас ${customer.balance} бонусов. Ими можно закрыть до ${customer.maxSpendPct}% заказа — выбор появится при оформлении.`,
      ky: `Сизде ${customer.balance} бонус бар. Алар менен заказдын ${customer.maxSpendPct}%ине чейин жабууга болот — тандоо заказ берүүдө чыгат.`,
      uz: `Sizda ${customer.balance} bonus bor. Ular bilan buyurtmaning ${customer.maxSpendPct}% gacha qismini yopish mumkin — tanlov buyurtma berishda chiqadi.`,
    },
    lang,
  )
}

// ── Частые вопросы ────────────────────────────────────────────────────────────

type Topic = { match: RegExp; say: Say }

/**
 * Слова собраны из трёх языков сразу: покупатели пишут по-русски,
 * по-кыргызски и по-узбекски, часто вперемешку в одном сообщении.
 */
const topics: Topic[] = [
  {
    match: /достав|жеткир|yetkaz|курьер|отправ|pochta/i,
    say: {
      ru: 'Возим по всему Кыргызстану, до центра района или области — бесплатно. Как оплатите заказ, наш сотрудник свяжется с вами и договорится, когда привезти.',
      ky: 'Кыргызстандын бардык жерине жеткиребиз, район же облус борборуна — акысыз. Заказды төлөгөнүңүздөн кийин кызматкерибиз байланышып, качан жеткирерин келишет.',
      uz: "Butun Qirg'iziston bo'ylab olib boramiz, tuman yoki viloyat markazigacha — bepul. Buyurtmani to'laganingizdan keyin xodimimiz bog'lanib, qachon yetkazishni kelishadi.",
    },
  },
  {
    match: /оплат|плат|төлө|to.?lo|нал[ио]чн|карт|деньги|pul/i,
    say: {
      ru: 'Оплата онлайн: из приложения своего банка (MBANK, O!Bank, Bakai, Optima и другие) через O!Деньги. Можно и приехать в магазин. Часть суммы закрывается бонусами SBonus.',
      ky: 'Төлөм онлайн: өз банкыңыздын тиркемесинен (MBANK, O!Bank, Bakai, Optima ж.б.) O!Деньги аркылуу. Дүкөнгө келсеңиз да болот. Бир бөлүгүн SBonus бонустары менен жабууга болот.',
      uz: "To'lov onlayn: o'z bankingiz ilovasidan (MBANK, O!Bank, Bakai, Optima va boshqalar) O!Dengi orqali. Do'konga kelsangiz ham bo'ladi. Bir qismini SBonus bonuslari bilan yopsa bo'ladi.",
    },
  },
  {
    match: /гарант|кепилдик|kafolat|ремонт|сервис/i,
    say: {
      ru: 'Гарантия у каждого товара своя — точный срок подтвердит сотрудник. По ремонту и обмену звоните в магазин.',
      ky: 'Ар бир товардын кепилдиги өзүнчө — так мөөнөтүн кызматкер айтат. Оңдоо жана алмаштыруу боюнча дүкөнгө чалыңыз.',
      uz: "Har bir mahsulotning kafolati o'zicha — aniq muddatini xodim aytadi. Ta'mirlash va almashtirish uchun do'konga qo'ng'iroq qiling.",
    },
  },
  {
    match: /адрес|где вы|каерде|кайда|qayerda|manzil|магазин где/i,
    say: {
      ru: 'Мы в Ошской области, Араванский район, улица Ош-3000, 86. Работаем с 2011 года.',
      ky: 'Биз Ош облусу, Араван району, Ош-3000 көчөсү, 86 дарегиндебиз. 2011-жылдан бери иштейбиз.',
      uz: 'Biz Oʻsh viloyati, Aravan tumani, Oʻsh-3000 koʻchasi, 86-uydamiz. 2011-yildan beri ishlaymiz.',
    },
  },
  {
    match: /телефон магазин|номер|позвон|чал|raqam|aloqa|связ/i,
    say: {
      ru: `Наши номера — ${phoneList}. Они же в WhatsApp и Telegram.`,
      ky: `Биздин номерлер — ${phoneList}. Ошол эле номерлер WhatsApp жана Telegram-да.`,
      uz: `Bizning raqamlar — ${phoneList}. Shu raqamlar WhatsApp va Telegram-da ham bor.`,
    },
  },
]

// Без \b на конце: в JavaScript граница слова знает только латиницу, и после
// кириллической «м» в «Салам» её нет — приветствие переставало узнаваться.
const greeting = /^(привет|салам|здрав|саламат|ассалом|assalom|salom|hello|hi\b)/i
const installment = /рассрочк|расрочк|бөлүп төлө|bo.?lib to.?lash|muddatli|nasiya|кредит|qarz|қарз|оy qoldi|ой қолди/i
const orderAsk = /зака[зс]|буюртма|buyurtma|посылк|где мой|qani mening|статус/i
const bonusAsk = /бонус|sbonus|балл/i

const foundSay: Say = {
  ru: 'Вот что нашлось в каталоге:',
  ky: 'Каталогдон тапканым:',
  uz: 'Katalogdan topilgani:',
}

const allOutSay: Say = {
  ru: 'Правда, сейчас их нет в наличии — спросите у сотрудника, когда привезут.',
  ky: 'Бирок азыр алар жок — качан келерин кызматкерден сураңыз.',
  uz: "Lekin hozir ular yo'q — qachon kelishini xodimdan so'rang.",
}

const unknownSay: Say = {
  ru: `Тут я подсказать не смогу, простите. Напишите или позвоните в магазин, там помогут: ${phoneList}.`,
  ky: `Мында жардам бере албайм, кечиресиз. Дүкөнгө жазыңыз же чалыңыз, жардам беришет: ${phoneList}.`,
  uz: `Bunga yordam bera olmayman, uzr. Doʻkonga yozing yoki qoʻngʻiroq qiling, yordam berishadi: ${phoneList}.`,
}

/**
 * Ответ без модели: сначала личные вопросы вошедшего покупателя, потом частые
 * вопросы, потом поиск по каталогу, в конце — телефон магазина.
 */
export function localAnswer(
  question: string,
  siteLang: Lang,
  customer: CustomerBrief | null = null,
  list?: Product[],
): Answer {
  const text = question.trim()
  const talk = detectLang(text, siteLang)

  if (greeting.test(text)) return { text: helloText(talk, customer), productIds: [] }
  if (installment.test(text)) return { text: installmentText(talk, customer), productIds: [] }
  if (orderAsk.test(text)) return { text: ordersText(talk, customer), productIds: [] }
  if (bonusAsk.test(text)) return { text: bonusText(talk, customer), productIds: [] }

  for (const topic of topics) {
    if (topic.match.test(text)) return { text: pick(topic.say, talk), productIds: [] }
  }

  // Названия товаров в каталоге русские и кыргызские; узбекскому покупателю
  // показываем русские — они совпадают с тем, что написано на коробке.
  const catalogLang: Lang = talk === 'ky' ? 'ky' : 'ru'
  const found = searchProducts(text, catalogLang, 3, list)
  if (found.length > 0) {
    // Названия и цены покупатель увидит карточками ниже — повторять их в тексте
    // незачем, иначе одно и то же написано дважды подряд.
    const outOfStock = found.filter((p) => !isInStock(p))
    const note =
      outOfStock.length === found.length ? ' ' + pick(allOutSay, talk) : ''
    return { text: pick(foundSay, talk) + note, productIds: found.map((p) => p.id) }
  }

  return { text: pick(unknownSay, talk), productIds: [] }
}
