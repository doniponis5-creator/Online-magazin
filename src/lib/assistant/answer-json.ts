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
  const row = data as { reply?: unknown; productIds?: unknown; audience?: unknown; deposit?: unknown; discount?: unknown; price?: unknown }
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
  // Скидка в торге (policy «СКИДКИ», 1–5%) — ссылка на оплату пойдёт уже со скидкой.
  const discount = typeof row.discount === 'number' ? Math.round(row.discount) : 0
  if (discount >= 1 && discount <= 5) lines.push(`SKIDKA: ${discount}`)
  // Договорная цена за штуку («2 900 бераман») — точнее процента
  const price = typeof row.price === 'number' ? Math.round(row.price) : 0
  if (price > 0) lines.push(`NARX: ${price}`)
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
      line.startsWith('TOVAR:') || line.startsWith('KIMGA:') || line.startsWith('ZAKLAD:') || line.startsWith('SKIDKA:') || line.startsWith('NARX:')
        ? line
        : line
            .replace(/\s*\[?\bid=[^\s\]|,]+\]?/gi, '')
            .replace(/\s*\[(?:[a-z]{1,4}-)?\d{2,}-?\d{3,}\]/gi, '')
            .replace(/[ \t]{2,}/g, ' '),
    )
    .join('\n')
    .trim()
}
