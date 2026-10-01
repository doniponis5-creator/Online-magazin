/**
 * Jev (System One от TypeSafe) — маленькая модель, которая не пишет текст, а только
 * выбирает вариант. Ей отдаём одно: что значит ответ покупателя на наш вопрос
 * «Оформляем?» / «Позвонить вам?» — согласие, отказ, «потом», новый вопрос — и
 * почему он откладывает. Пишет ответ по-прежнему Gemini, но уже зная причину.
 *
 * Почему не регулярные выражения: «Ладно давайте», «Жарайт, берип коюңуз»,
 * «Апама айтып көрөйүн» в списки не попадали, и каждое новое слово стоило
 * потерянного покупателя. На 63 фразах трёх языков Jev понял 61, списки — 41.
 *
 * Без ключа JEV_API_KEY, при ошибке или дольше JEV_TIMEOUT — null: бот работает
 * как раньше, на списках. В Jev уходят только две фразы: вопрос бота и ответ
 * покупателя — без имени и номера.
 */
import 'server-only'

export type IntentKind = 'agree' | 'decline' | 'later' | 'question' | 'thanks'
export type Reason = 'price' | 'money' | 'family' | 'think' | 'other'
export type When = 'today' | 'tomorrow' | 'week' | 'payday' | 'unknown'
export type Intent = { kind: IntentKind; confidence: number; reason: Reason; when: When }

const JEV_TIMEOUT = 2500

const QUESTIONS = {
  kind: {
    type: 'choice',
    instructions: 'Продавец в поле `bot` задал вопрос. Что значит ответ покупателя из поля `client`?',
    criteria: {
      agree: 'Согласен: да, хорошо, давайте, оформляйте, позвоните — без условий и без откладывания',
      decline: 'Отказывается: нет, не надо, не нужно, дорого — не буду, не звоните',
      later: 'Откладывает: подумаю, посоветуюсь, спрошу у семьи, денег пока нет, потом, посмотрю ещё',
      question: 'Задаёт новый вопрос или просит уточнить, согласия или отказа ещё нет',
      thanks: 'Только вежливость: спасибо, рахмат, ок — без согласия и без отказа',
    },
  },
  reason: {
    type: 'choice',
    instructions: 'Если покупатель из поля `client` откладывает покупку или отказывается — почему?',
    criteria: {
      price: 'Дорого, ищет дешевле',
      money: 'Сейчас нет денег, ждёт зарплату или получку',
      family: 'Хочет спросить или посоветоваться с семьёй: жена, муж, мама, сестра, брат',
      think: 'Хочет подумать или посмотреть ещё, причину не назвал',
      other: 'Другая причина, или он не откладывает и не отказывается',
    },
  },
  when: {
    type: 'choice',
    instructions: 'Когда, по словам покупателя из поля `client`, он вернётся к покупке?',
    criteria: {
      today: 'Сегодня, сейчас, через час',
      tomorrow: 'Завтра',
      week: 'Через несколько дней, на следующей неделе, когда поедет в город',
      payday: 'После зарплаты, получки, аванса',
      unknown: 'Срок не назван',
    },
  },
} as const

export function jevConfigured(): boolean {
  return Boolean(process.env.JEV_API_KEY)
}

function baseUrl(key: string): string {
  if (process.env.JEV_BASE_URL) return process.env.JEV_BASE_URL.replace(/\/$/, '')
  return key.startsWith('sk-or-') ? 'https://openrouter.ai/api' : 'https://api.typesafe.ai'
}

/** Ответ покупателя на вопрос бота — или null, если Jev не настроен или не ответил. */
export async function readAnswer(bot: string, client: string): Promise<Intent | null> {
  const key = process.env.JEV_API_KEY
  if (!key) return null
  try {
    const response = await fetch(`${baseUrl(key)}/v1/systemone`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'jev-latest', state: { bot: bot.slice(-400), client: client.slice(0, 400) }, questions: QUESTIONS }),
      signal: AbortSignal.timeout(JEV_TIMEOUT),
    })
    if (!response.ok) {
      console.error('[assistant] jev: HTTP', response.status)
      return null
    }
    return parseIntent(await response.json())
  } catch (error) {
    console.error('[assistant] jev:', error instanceof Error ? error.message : error)
    return null
  }
}

type Answer = { choice?: unknown; confidence?: unknown }

/** Ответ API → Intent. Непонятный ответ — null, а не догадка. */
export function parseIntent(data: unknown): Intent | null {
  const answers = (data as { answers?: Record<string, Answer> } | null)?.answers
  if (!answers) return null
  const kind = pickOf(answers.kind, Object.keys(QUESTIONS.kind.criteria)) as IntentKind | null
  if (!kind) return null
  const confidence = Number(answers.kind?.confidence)
  return {
    kind,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    reason: (pickOf(answers.reason, Object.keys(QUESTIONS.reason.criteria)) ?? 'other') as Reason,
    when: (pickOf(answers.when, Object.keys(QUESTIONS.when.criteria)) ?? 'unknown') as When,
  }
}

function pickOf(answer: Answer | undefined, allowed: string[]): string | null {
  const choice = answer?.choice
  return typeof choice === 'string' && allowed.includes(choice) ? choice : null
}

/** «Да» от Jev считаем согласием только уверенное и без «спасибо»: «Яхши, рахмат» — не заказ. */
export function isSureYes(intent: Intent | null, text: string): boolean {
  return Boolean(intent && intent.kind === 'agree' && intent.confidence >= 0.9 && !/(рахмат|рахмет|спасибо|rahmat|благодар)/i.test(text))
}

/**
 * Подсказка модели: почему покупатель тянет и как ответил бы сильный продавец.
 * Только про то, что есть в правилах магазина: рассрочка MIslamic без переплаты
 * до 4 месяцев, MBANK до 24, фото и цена — без выдуманных скидок.
 */
export function objectionNote(intent: Intent | null): string {
  if (!intent) return ''
  // «Кимматку, арзонроги йукми?» Jev считает вопросом, но причина та же — цена.
  if (intent.kind === 'question' && intent.reason === 'price') {
    return '\n\nПОДСКАЗКА ПРОДАВЦУ: смущает цена. Предложи одну модель дешевле из каталога с ценой или рассрочку MIslamic до 4 месяцев без переплаты (цена / 4 в месяц).'
  }
  if (intent.kind === 'decline') {
    if (intent.reason === 'price') {
      return '\n\nПОДСКАЗКА ПРОДАВЦУ: покупатель говорит, что дорого. Не спорь и не дави. Предложи одну модель дешевле из каталога с ценой или рассрочку: MIslamic «Адал рассрочка» до 4 месяцев без переплаты (цена, делённая на 4, в месяц). Один короткий вопрос в конце.'
    }
    return '\n\nПОДСКАЗКА ПРОДАВЦУ: покупатель отказался. Коротко и тепло попрощайся. Не предлагай звонок и новые товары.'
  }
  if (intent.kind !== 'later') return ''
  switch (intent.reason) {
    case 'money':
      return '\n\nПОДСКАЗКА ПРОДАВЦУ: денег сейчас нет, ждёт зарплату. Скажи, что можно взять уже сейчас в рассрочку через MIslamic (до 4 месяцев без переплаты — назови платёж в месяц: цена / 4) или MBANK, а платить потом. Не дави: если не подходит — напишем ближе к зарплате.'
    case 'family':
      return '\n\nПОДСКАЗКА ПРОДАВЦУ: хочет посоветоваться с семьёй. Поддержи это и помоги: «фото и цену уже отправил — покажите им». Звонок не предлагай.'
    case 'price':
      return '\n\nПОДСКАЗКА ПРОДАВЦУ: смущает цена. Предложи одну модель дешевле из каталога с ценой или рассрочку MIslamic до 4 месяцев без переплаты (цена / 4 в месяц).'
    case 'think':
      return '\n\nПОДСКАЗКА ПРОДАВЦУ: хочет подумать. Одной фразой спроси, что смущает — цена, размер или что-то ещё. Не дави и не повторяй всё сначала.'
    default:
      return '\n\nПОДСКАЗКА ПРОДАВЦУ: покупатель откладывает. Не дави, ответь коротко и оставь дверь открытой.'
  }
}

/**
 * Через сколько секунд спросить «ещё актуально?». null — как обычно (через 2 часа).
 * Зарплату в Кыргызстане платят в разные дни, поэтому «после зарплаты» — неделя.
 */
export function followAfter(intent: Intent | null): number | null {
  if (!intent || intent.kind !== 'later') return null
  const day = 24 * 3600
  switch (intent.when) {
    case 'tomorrow':
      return 22 * 3600
    case 'week':
      return 6 * day
    case 'payday':
      return 7 * day
    default:
      return intent.reason === 'family' ? day : null
  }
}
