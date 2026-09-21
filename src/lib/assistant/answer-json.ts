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
    return raw
  }
  const row = data as { reply?: unknown; productIds?: unknown }
  if (typeof row.reply !== 'string' || !row.reply.trim()) throw new Error('empty-reply')
  const ids = Array.isArray(row.productIds) ? row.productIds.filter((id): id is string => typeof id === 'string') : []
  return ids.length > 0 ? `${row.reply.trim()}\nTOVAR: ${ids.slice(0, 3).join(', ')}` : row.reply.trim()
}
