import 'server-only'

/**
 * Память, которая переживает перезагрузку кода.
 *
 * Обычная переменная в модуле выглядит надёжной, но при разработке Next
 * перезагружает изменённый файл — и разговор, который бот только что вёл,
 * пропадает вместе с переменной. Покупатель пишет «оформляй», а бот отвечает
 * «какой товар?». Поэтому храним всё рядом с самим процессом.
 *
 * Это по-прежнему память процесса: сервер перезапустили — разговоры начались
 * заново. Для чата о товарах этого достаточно.
 */

const box = globalThis as unknown as { __smartcentr?: Record<string, unknown> }

export function store<T>(key: string, make: () => T): T {
  box.__smartcentr ??= {}
  const kept = box.__smartcentr[key]
  if (kept !== undefined) return kept as T
  const fresh = make()
  box.__smartcentr[key] = fresh
  return fresh
}
