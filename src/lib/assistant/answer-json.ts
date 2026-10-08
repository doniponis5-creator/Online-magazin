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
  const row = data as { reply?: unknown; productIds?: unknown; audience?: unknown; deposit?: unknown }
  if (typeof row.reply !== 'string' || !row.reply.trim()) throw new Error('empty-reply')
  const reply = withoutIds(row.reply)
  const ids = Array.isArray(row.productIds) ? row.productIds.filter((id): id is string => typeof id === 'string') : []
  const lines = [reply]
  if (ids.length > 0) lines.push(`TOVAR: ${ids.slice(0, 3).join(', ')}`)
  // Кому адресовано: покупатель, сотрудник или вовсе не магазин — см. parseAnswer.
  if (row.audience === 'staff' || row.audience === 'personal') lines.push(`KIMGA: ${row.audience}`)
  // Заклад: покупатель согласился платить частью и назвал сумму (shop_deposit_rules на сервере).
  const deposit = typeof row.deposit === 'number' ? Math.floor(row.deposit) : 0
  if (deposit >= 1000) lines.push(`ZAKLAD: ${deposit}`)
  return lines.join('\n')
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
      line.startsWith('TOVAR:') || line.startsWith('KIMGA:') || line.startsWith('ZAKLAD:')
        ? line
        : line
            .replace(/\s*\[?\bid=[^\s\]|,]+\]?/gi, '')
            .replace(/\s*\[(?:[a-z]{1,4}-)?\d{2,}-?\d{3,}\]/gi, '')
            .replace(/[ \t]{2,}/g, ' '),
    )
    .join('\n')
    .trim()
}
