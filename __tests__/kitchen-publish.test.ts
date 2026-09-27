import { describe, expect, it } from 'vitest'
import { readPublish } from '@/components/kitchen/publish'

// Ответы POST /api/gallery — из src/app/api/gallery/helpers.ts (коды и статусы).
describe('ответ «В галерею» → что сказать покупателю', () => {
  it('успех — id кухни', () => {
    expect(readPublish(200, { ok: true, id: 'abc123' })).toEqual({ ok: true, id: 'abc123' })
  })
  it('401 login — снова вход', () => {
    expect(readPublish(401, { ok: false, error: 'login' })).toEqual({ ok: false, error: 'login' })
  })
  it('429 too-many, reason day — «Сегодня уже 5 кухонь»', () => {
    expect(readPublish(429, { ok: false, error: 'too-many', reason: 'day' })).toEqual({ ok: false, error: 'limit' })
  })
  it('429 too-many, reason often или без причины — «Слишком часто»', () => {
    expect(readPublish(429, { ok: false, error: 'too-many', reason: 'often' })).toEqual({ ok: false, error: 'often' })
    expect(readPublish(429, { ok: false, error: 'too-many' })).toEqual({ ok: false, error: 'often' })
  })
  it('507 no-space — кончилось место под фото', () => {
    expect(readPublish(507, { ok: false, error: 'no-space' })).toEqual({ ok: false, error: 'no-space' })
  })
  it('400 bad-input — кухню не приняли', () => {
    expect(readPublish(400, { ok: false, error: 'bad-input' })).toEqual({ ok: false, error: 'bad-input' })
  })
  it('500 save и ответ без JSON (502 от nginx) — сервер не сохранил', () => {
    expect(readPublish(500, { ok: false, error: 'save' })).toEqual({ ok: false, error: 'save' })
    expect(readPublish(502, null)).toEqual({ ok: false, error: 'save' })
    expect(readPublish(200, { ok: true })).toEqual({ ok: false, error: 'save' })
  })
  it('ответа нет совсем (нет сети) — other', () => {
    expect(readPublish(null, null)).toEqual({ ok: false, error: 'other' })
  })
})
