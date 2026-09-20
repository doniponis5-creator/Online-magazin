import 'server-only'

/**
 * Журнал вопросов покупателей.
 *
 * Зачем: чат видит то, чего не видит никто другой — что у нас спрашивают и
 * чего у нас не нашли. «Десять человек спросили холодильник, а его нет в
 * каталоге» — это прямая подсказка, что везти.
 *
 * Где лежит: простой текстовый файл, по строке на вопрос, новый файл на каждый
 * месяц. Ни базы, ни таблиц: вопросов немного, а лишняя база — это то, что
 * однажды ломается ночью.
 *
 * Чего в журнале нет: имени, телефона и номера заказа. Длинные цепочки цифр в
 * тексте заменяются точками — покупатель мог написать свой номер сам.
 */

import { appendFile, readFile } from 'node:fs/promises'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export type LogRow = {
  /** время по часам сервера, ISO */
  at: string
  lang: string
  /** вопрос покупателя */
  q: string
  /** начало ответа — чтобы владелец видел, что чат отвечает */
  a: string
  /** нашлись ли товары */
  found: boolean
  /** gemini — отвечала модель, local — запасной режим */
  source: string
  /** откуда пришёл вопрос: сайт или Telegram. Старые записи — с сайта. */
  ch?: 'site' | 'telegram'
}

/** Папка журнала. На сервере это подключённая папка, переживающая обновление сайта. */
function dir(): string {
  return process.env.ASSISTANT_LOG_DIR || 'data'
}

function fileFor(date: Date): string {
  const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  return join(dir(), `assistant-${month}.jsonl`)
}

/**
 * Прячем цепочки из шести и более цифр: телефон, номер карты, номер заказа.
 * Шесть, а не четыре — иначе исчезнут цены и объём холодильника в литрах.
 */
export function hideDigits(text: string): string {
  return text.replace(/\+?\d[\d\s()+-]{5,}\d/g, (run) => (run.replace(/\D/g, '').length >= 6 ? '…' : run))
}

/** Записать вопрос. Ошибка записи не должна мешать покупателю — молчим. */
export async function logQuestion(row: Omit<LogRow, 'at'>): Promise<void> {
  try {
    mkdirSync(dir(), { recursive: true })
    const line: LogRow = {
      at: new Date().toISOString(),
      lang: row.lang,
      q: hideDigits(row.q).slice(0, 300),
      a: hideDigits(row.a).slice(0, 300),
      found: row.found,
      source: row.source,
      ch: row.ch ?? 'site',
    }
    await appendFile(fileFor(new Date()), JSON.stringify(line) + '\n', 'utf8')
  } catch (error) {
    console.error('[assistant] журнал:', error instanceof Error ? error.message : error)
  }
}

/** Прочитать записи за последние `months` месяцев, новые сверху. */
export async function readRows(months = 2): Promise<LogRow[]> {
  const rows: LogRow[] = []
  const now = new Date()
  for (let back = 0; back < months; back += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - back, 1)
    let text = ''
    try {
      text = await readFile(fileFor(date), 'utf8')
    } catch {
      continue
    }
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      try {
        rows.push(JSON.parse(line) as LogRow)
      } catch {
        // Битая строка — пропускаем. Журнал не должен падать из-за одной записи.
      }
    }
  }
  return rows.sort((a, b) => (a.at < b.at ? 1 : -1))
}

export type Summary = {
  total: number
  notFound: number
  /** сколько вопросов в каждый из последних дней, новые сверху */
  byDay: { day: string; count: number }[]
  /** самые частые вопросы */
  top: { q: string; count: number }[]
  /** последние вопросы, на которые товар не нашёлся */
  misses: LogRow[]
  latest: LogRow[]
}

/** Свести записи в то, что интересно владельцу. */
export function summarize(rows: LogRow[], days = 14): Summary {
  const byDay = new Map<string, number>()
  const top = new Map<string, number>()

  for (const row of rows) {
    const day = row.at.slice(0, 10)
    byDay.set(day, (byDay.get(day) ?? 0) + 1)
    const key = row.q.toLowerCase().replace(/\s+/g, ' ').trim()
    if (key) top.set(key, (top.get(key) ?? 0) + 1)
  }

  return {
    total: rows.length,
    notFound: rows.filter((r) => !r.found).length,
    byDay: [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, days)
      .map(([day, count]) => ({ day, count })),
    top: [...top.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([q, count]) => ({ q, count })),
    misses: rows.filter((r) => !r.found).slice(0, 50),
    latest: rows.slice(0, 50),
  }
}
