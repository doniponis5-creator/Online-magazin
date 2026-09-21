/**
 * {"reply": "...", "productIds": [...]} → текст с последней строкой TOVAR:,
 * как его и ждёт parseAnswer. Не JSON (модель ослушалась) — отдаём как есть:
 * parseAnswer справится и с обычным текстом.
 */
export function fromJson(raw: string): string {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return withoutIds(raw)
  }
  const row = data as { reply?: unknown; productIds?: unknown }
  if (typeof row.reply !== 'string' || !row.reply.trim()) throw new Error('empty-reply')
  const reply = withoutIds(row.reply)
  const ids = Array.isArray(row.productIds) ? row.productIds.filter((id): id is string => typeof id === 'string') : []
  return ids.length > 0 ? `${reply}\nTOVAR: ${ids.slice(0, 3).join(', ')}` : reply
}

/**
 * Служебные id товара покупателю не показываем: модель изредка вставляла
 * «[cb-00001494] LG…» прямо в текст. id нужны только для карточек.
 * Строку «TOVAR: …» не трогаем — её разбирает parseAnswer.
 */
export function withoutIds(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      line.startsWith('TOVAR:')
        ? line
        : line
            .replace(/\s*\[?\bid=[^\s\]|,]+\]?/gi, '')
            .replace(/\s*\[(?:[a-z]{1,4}-)?\d{2,}-?\d{3,}\]/gi, '')
            .replace(/[ \t]{2,}/g, ' '),
    )
    .join('\n')
    .trim()
}
