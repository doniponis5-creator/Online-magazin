/**
 * Разбор ответа `POST /api/gallery` для формы «В галерею».
 * Коды и статусы — `src/app/api/gallery/helpers.ts`:
 * login 401 · bad-input 400 · save 500 · no-space 507 (кончилось место под картинки) ·
 * too-many 429 с reason: `day` — 5 кухонь за сутки, `often` — слишком часто (в том числе с одного адреса).
 */
export type PublishFail = 'login' | 'limit' | 'often' | 'no-space' | 'save' | 'bad-input' | 'other'
export type PublishResult = { ok: true; id: string } | { ok: false; error: PublishFail }

/** status null — ответа не было совсем (нет сети). Любой непонятный ответ сервера — `save`. */
export function readPublish(status: number | null, body: unknown): PublishResult {
  if (status === null) return { ok: false, error: 'other' }
  const b = body && typeof body === 'object' ? (body as { ok?: unknown; id?: unknown; error?: unknown; reason?: unknown }) : {}
  if (b.ok === true && typeof b.id === 'string' && b.id) return { ok: true, id: b.id }
  if (status === 401 || b.error === 'login') return { ok: false, error: 'login' }
  if (status === 507 || b.error === 'no-space') return { ok: false, error: 'no-space' }
  if (b.error === 'too-many') return { ok: false, error: b.reason === 'day' ? 'limit' : 'often' }
  if (b.error === 'bad-input') return { ok: false, error: 'bad-input' }
  return { ok: false, error: 'save' }
}
