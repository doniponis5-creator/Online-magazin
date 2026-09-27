/**
 * Галерея кухонь — правила, общие для сайта и браузера.
 *
 * Кухня в галерее — это строка проекта (как ссылка на кухню) и кадр 3D.
 * Ставить, оценивать и комментировать может только вошедший (код в Telegram).
 * Телефон автора хранится только на сервере и наружу не уходит: у всех на
 * виду имя («Азамат») и непрозрачный authorId.
 *
 * Здесь нет ни файлов, ни сети, ни секретов: этот модуль читает и форма в
 * браузере. authorId считается на сервере — `author.ts`.
 */

import type { Lang } from '@/lib/i18n/config'
import { cleanText } from '@/lib/reviews/rules'
import { queryFromState, stateFromQuery } from '@/lib/kitchen/share'
import { STYLES } from '@/lib/kitchen/styles'
import type { Shape } from '@/lib/kitchen/types'

export { imageType, PHOTO_NAME, thumbOf } from '@/lib/reviews/rules'

/** Столько кухонь держим; дальше вычищаются скрытые, потом старые без оценок. */
export const MAX_KITCHENS = 2000
/** Кухонь на странице галереи. */
export const PAGE_SIZE = 24
export const MAX_QUERY = 4000
export const MAX_TITLE = 80
export const MIN_COMMENT = 2
export const MAX_COMMENT = 500
/** «Я сделал такую» — фото готовой кухни у автора. */
export const MAX_REAL_PHOTOS = 5
/** Кадр 3D 1200×750 JPEG — браузер сжимает до этого предела. */
export const MAX_IMAGE_BYTES = 400_000
/** Превью 480×300. */
export const MAX_PREVIEW_BYTES = 80_000
/** Фото «я сделал такую» — те же пределы, что у фото отзывов. */
export { MAX_PHOTO_BYTES, MAX_THUMB_BYTES } from '@/lib/reviews/rules'

export const DAY_MS = 24 * 3600 * 1000
/** id кухни и комментария — 16 hex. */
export const KITCHEN_ID = /^[a-f0-9]{16}$/

/** Публикаций в сутки от одного телефона (по журналу: убранная кухня лимит не возвращает). */
export const PUBLISH_PER_DAY = 5
/** Оценок в минуту от одного телефона — от перебора кухонь скриптом. */
export const RATES_PER_MINUTE = 30
/** Комментариев на одной кухне. */
export const COMMENTS_PER_KITCHEN = 300
/** Место на диске под все картинки галереи. */
export const IMAGE_BUDGET = 3 * 1024 ** 3
/** Комментарий не чаще раза в 30 с и не больше 20 в сутки. */
export const COMMENT_GAP_MS = 30_000
export const COMMENTS_PER_DAY = 20

/** Байесовское среднее: априорная оценка и её вес в «голосах». */
export const PRIOR_STARS = 3.5
export const PRIOR_WEIGHT = 5

export const SHAPES: readonly Shape[] = ['straight', 'corner', 'u', 'island']
export type Role = 'buyer' | 'master'
export const ROLES: readonly Role[] = ['buyer', 'master']

/** no-space — кончилось место под картинки галереи (507). */
export type GalleryError = 'login' | 'too-many' | 'bad-input' | 'not-found' | 'forbidden' | 'no-space'
/** Уточнение к too-many: больше 5 фото, 300 комментариев на кухне, слишком часто. */
export type TooManyReason = 'photos' | 'comments' | 'often'

/** Комментарий, каким его видят все. */
export type GalleryComment = {
  id: string
  /** только имя: «Азамат»; пусто — подпись делает экран */
  authorName: string
  authorId: string
  text: string
  at: string
}

/**
 * Кухня в списке галереи. Картинки — имена файлов: /api/gallery/image/<имя>.
 * Телефонов, оценок по людям и жалоб здесь нет — и не будет.
 */
export type GalleryCard = {
  id: string
  /** проект: строка queryFromState — открыть в конструкторе /kitchen?<q> */
  q: string
  /** по-русски; если autoTitle — страница собирает своё: titleOf(q, lang) */
  title: string
  /** автор названия не дал — собрано из формы, размеров и стиля */
  autoTitle: boolean
  shape: Shape
  role: Role
  authorName: string
  authorId: string
  createdAt: string
  /** средняя оценка, до сотых; 0 — оценок нет */
  avg: number
  count: number
  commentCount: number
  image: string
  thumb: string
  /** есть фото готовой кухни «вживую» */
  hasReal: boolean
  /** превью первого фото «вживую»: /api/gallery/image/<имя> */
  realThumb?: string
}

/** Страница кухни: карточка + комментарии + фото «я сделал такую» (маленькая копия — thumbOf(имя)). */
export type GalleryKitchen = GalleryCard & {
  comments: GalleryComment[]
  realPhotos: string[]
}

/** Взвешенная оценка для «Лучших»: мало оценок не выстреливает. */
export function rankScore(avg: number, count: number): number {
  const n = Math.max(0, count)
  return (PRIOR_STARS * PRIOR_WEIGHT + (n ? avg : 0) * n) / (PRIOR_WEIGHT + n)
}

/** Только имя: «Азамат Абдыкадыров» → «Азамат». Пусто — пусто. */
export function firstName(full: string): string {
  const first = full.trim().split(/\s+/)[0] ?? ''
  return first.slice(0, 30)
}

/** Подпись автора для всех: только имя, без телефонов и ссылок; не имя — пусто. */
export function authorNameOf(full: string): string {
  const name = cleanComment(firstName(full))
  return /^[\p{L}][\p{L}\p{M}'’-]*$/u.test(name) ? name : ''
}

/** Телефоны — то же правило, что `hideDigits` журнала чата (там модуль только для сервера). */
function hidePhones(text: string): string {
  return text.replace(/\+?\d[\d\s()+-]{5,}\d/g, (run) => (run.replace(/\D/g, '').length >= 6 ? '…' : run))
}

const LINK =
  /(?:https?:\/\/|www\.)\S+|(?<![\p{L}\d@.-])[\p{L}\d-]+(?:\.[\p{L}\d-]+)*\.(?:com|net|org|info|biz|kg|ru|kz|uz|me|io|app|shop|store|site|online|link|pro|su|рф)(?![\p{L}\d-])(?:\/\S*)?/giu

/** Текст для всех: без мусора, без телефонов и ссылок. */
export function cleanComment(value: string): string {
  return hidePhones(cleanText(value).replace(LINK, '…'))
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: 'bad-input' }

export function validateComment(raw: unknown): Checked<string> {
  if (typeof raw !== 'string') return { ok: false, error: 'bad-input' }
  const text = cleanText(raw)
  if (text.length < MIN_COMMENT || text.length > MAX_COMMENT) return { ok: false, error: 'bad-input' }
  return { ok: true, value: cleanComment(text) }
}

/** Название: необязательно (null — соберём из проекта), одной строкой, до 80. */
export function validateTitle(raw: unknown): Checked<string | null> {
  if (raw === undefined || raw === null) return { ok: true, value: null }
  if (typeof raw !== 'string') return { ok: false, error: 'bad-input' }
  const title = cleanComment(raw.replace(/\s+/g, ' '))
  if (!title) return { ok: true, value: null }
  if (title.length > MAX_TITLE) return { ok: false, error: 'bad-input' }
  return { ok: true, value: title }
}

/**
 * Проект из формы: строка queryFromState, до 4000 знаков, с формой кухни.
 * Разбирается тем же `stateFromQuery`, что и ссылка на кухню.
 */
export function checkQuery(raw: unknown): { shape: Shape } | null {
  if (typeof raw !== 'string' || !raw || raw.length > MAX_QUERY) return null
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null
  try {
    const params = new URLSearchParams(raw)
    const state = stateFromQuery(params, new Set())
    return state.shape === params.get('f') ? { shape: state.shape } : null
  } catch {
    return null
  }
}

/** id техники из каталога: «cb-00002489» или UUID из 1С — других не бывает. */
const APPLIANCE_ID = /^(?:cb-\d{4,12}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/

/**
 * «Каталог», который пропускает любой id правильного вида: при публикации
 * модели, которой нет в каталоге этого сервера, не теряются, а мусор отсекается.
 */
class AnyApplianceId extends Set<string> {
  override has(id: string): boolean {
    return APPLIANCE_ID.test(id)
  }
}

/**
 * Проект в каноничном виде: разобран и собран заново `stateFromQuery` →
 * `queryFromState`. Остаются только ключи, которые пишет конструктор, значения
 * заново закодированы; чужие ключи и мусор в id техники выбрасываются.
 */
export function canonicalQuery(raw: unknown): string | null {
  if (!checkQuery(raw)) return null
  try {
    return queryFromState(stateFromQuery(new URLSearchParams(raw as string), new AnyApplianceId()))
  } catch {
    return null
  }
}

const SHAPE_NAMES: Record<Lang, Record<Shape, string>> = {
  ru: { straight: 'Прямая', corner: 'Угловая', u: 'П-образная', island: 'С островом' },
  ky: { straight: 'Түз', corner: 'Бурчтук', u: 'П-формалуу', island: 'Аралчасы менен' },
}

/** Название по умолчанию: «Угловая 300 × 240 · Неоклассика». */
export function titleOf(q: string, lang: Lang = 'ru'): string {
  const s = stateFromQuery(new URLSearchParams(q), new Set())
  const sizes =
    s.shape === 'corner' ? [s.a, s.b] : s.shape === 'u' ? [s.a, s.b, s.c] : s.shape === 'island' ? [s.a, s.island] : [s.a]
  const style = STYLES.find((x) => x.id === s.style)
  return [`${SHAPE_NAMES[lang][s.shape]} ${sizes.join(' × ')}`, style?.[lang]].filter(Boolean).join(' · ')
}

/** Длина всех стен, см; остров — не стена. */
export function wallLength(s: { shape: Shape; a: number; b: number; c: number }): number {
  return s.a + (s.shape === 'corner' || s.shape === 'u' ? s.b : 0) + (s.shape === 'u' ? s.c : 0)
}

export type SizeBand = 'small' | 'mid' | 'big'
export const SIZE_BANDS: readonly SizeBand[] = ['small', 'mid', 'big']

/** Длина всех стен (см) → размер: до 270, 270–400, больше 400. */
export function sizeBand(length: number): SizeBand {
  return length <= 270 ? 'small' : length <= 400 ? 'mid' : 'big'
}

/** Размер кухни по проекту. */
export function sizeOfQuery(q: string): SizeBand {
  return sizeBand(wallLength(stateFromQuery(new URLSearchParams(q), new Set())))
}
