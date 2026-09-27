import 'server-only'

/**
 * Галерея кухонь — где лежит. Устроено как отзывы (`src/lib/reviews/store.ts`).
 *
 * Прямо на сайте, в томе докера (/app/data): переживает обновление сайта.
 *
 *   gallery/kitchens.json    — все кухни, новые сверху
 *   gallery/publishes.json   — журнал публикаций (телефон → времена) для «5 в сутки»
 *   gallery/images/*         — кадр 3D, превью, фото «я сделал такую»
 *
 * Запись идёт по очереди, файл заменяется целиком через временный — половинчатого
 * файла после сбоя не бывает. Файл пишется только когда что-то правда поменялось.
 * Битый kitchens.json — ошибка, а не пустая галерея: иначе следующая запись
 * затёрла бы все кухни.
 *
 * Телефон хранится у записи (своё, одна оценка, лимиты) и отсюда наружу уходит
 * только через `toPublic`/`toCard`, где его нет.
 */

import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { store } from '@/lib/store'
import type { Shape } from '@/lib/kitchen/types'
import { authorIdOf } from './author'
import {
  COMMENTS_PER_DAY,
  COMMENTS_PER_KITCHEN,
  COMMENT_GAP_MS,
  DAY_MS,
  IMAGE_BUDGET,
  MAX_KITCHENS,
  MAX_REAL_PHOTOS,
  PAGE_SIZE,
  PHOTO_NAME,
  PUBLISH_PER_DAY,
  authorNameOf,
  canonicalQuery,
  checkQuery,
  rankScore,
  sizeOfQuery,
  thumbOf,
  titleOf,
  validateComment,
  validateTitle,
  type GalleryCard,
  type GalleryComment,
  type GalleryKitchen,
  type Role,
  type SizeBand,
} from './rules'

type Status = 'published' | 'hidden'

export type StoredComment = GalleryComment & {
  phone: string
  status: Status
  reports: number
  reporters: string[]
}

export type StoredKitchen = {
  id: string
  /** каноничный: `canonicalQuery` */
  q: string
  title: string
  autoTitle: boolean
  shape: Shape
  role: Role
  authorName: string
  authorId: string
  phone: string
  createdAt: string
  status: Status
  /** телефон → звёзды: одна оценка от человека */
  ratings: Record<string, number>
  comments: StoredComment[]
  reports: number
  reporters: string[]
  image: string
  thumb: string
  photos: string[]
  /** файл → байты: место под картинки считается без обхода диска */
  sizes: Record<string, number>
}

type Ext = 'jpg' | 'png' | 'webp'
export type NewImage = { bytes: Uint8Array; ext: Ext }
/** Фото «я сделал такую» и его маленькая копия (того же формата). */
export type NewPhoto = { bytes: Uint8Array; ext: Ext; thumb?: Uint8Array }

export type PublishInput = {
  q: string
  /** null — соберём из проекта: «Угловая 300 × 240 · Неоклассика» */
  title: string | null
  role: Role
  phone: string
  /** имя из сессии; наружу — только первое слово, без телефонов и ссылок */
  name: string
  image: NewImage
  thumb?: NewImage
}

const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const

function dir(): string {
  return process.env.GALLERY_DIR || join(process.env.ASSISTANT_LOG_DIR || 'data', 'gallery')
}

/** GALLERY_MAX и GALLERY_IMAGE_BUDGET — только чтобы проверить вычистку на малых числах. */
function envNumber(name: string, fallback: number): number {
  const v = Number(process.env[name])
  return Number.isInteger(v) && v > 0 ? v : fallback
}
const maxKitchens = () => envNumber('GALLERY_MAX', MAX_KITCHENS)
const imageBudget = () => envNumber('GALLERY_IMAGE_BUDGET', IMAGE_BUDGET)

const listFile = () => join(dir(), 'kitchens.json')
const journalFile = () => join(dir(), 'publishes.json')
const imageDir = () => join(dir(), 'images')

const memory = store('gallery-rows', () => ({
  dir: '',
  rows: null as StoredKitchen[] | null,
  /** одно чтение файла на всех, кто пришёл, пока оно идёт */
  reading: null as Promise<StoredKitchen[]> | null,
  readingDir: '',
}))
const journal = store('gallery-journal', () => ({ dir: '', log: null as Record<string, number[]> | null }))
const queue = store('gallery-queue', () => ({ tail: Promise.resolve() as Promise<unknown> }))
/** Когда человек писал комментарии: слот тратится только на принятый. */
const commentHits = store('gallery-comment-hits', () => new Map<string, number[]>())
/** Размер кухни по проекту: q не меняется, считаем один раз. */
const sizeMemo = store('gallery-size-memo', () => new Map<string, SizeBand>())

function sizeOf(q: string): SizeBand {
  let band = sizeMemo.get(q)
  if (!band) {
    band = sizeOfQuery(q)
    if (sizeMemo.size > 5000) sizeMemo.clear()
    sizeMemo.set(q, band)
  }
  return band
}

function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.tail.then(job, job)
  queue.tail = run.catch(() => undefined)
  return run
}

async function readRows(from: string): Promise<StoredKitchen[]> {
  try {
    const parsed = JSON.parse(await readFile(join(from, 'kitchens.json'), 'utf8')) as unknown
    if (!Array.isArray(parsed)) throw new Error('gallery/kitchens.json: не список')
    return parsed as StoredKitchen[]
  } catch (error) {
    // Файла ещё нет — кухонь нет. Любая другая ошибка важна.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

function load(): Promise<StoredKitchen[]> {
  const d = dir()
  if (memory.rows && memory.dir === d) return Promise.resolve(memory.rows)
  if (memory.reading && memory.readingDir === d) return memory.reading
  const reading = readRows(d)
    .then((rows) => {
      // Пока читали, могли записать — записанное новее прочитанного, его не трогаем.
      if (memory.rows && memory.dir === d) return memory.rows
      memory.dir = d
      memory.rows = rows
      return rows
    })
    .finally(() => {
      if (memory.reading === reading) memory.reading = null
    })
  memory.reading = reading
  memory.readingDir = d
  return reading
}

async function writeAtomic(file: string, data: unknown): Promise<void> {
  await mkdir(dir(), { recursive: true })
  const temp = `${file}.${process.pid}.tmp`
  await writeFile(temp, JSON.stringify(data), 'utf8')
  await rename(temp, file)
}

async function save(rows: StoredKitchen[]): Promise<void> {
  await writeAtomic(listFile(), rows)
  memory.dir = dir()
  memory.rows = rows
}

/** Журнал публикаций. Он только для предела: битый — начинаем новый, кухни не теряются. */
async function loadJournal(): Promise<Record<string, number[]>> {
  if (journal.log && journal.dir === dir()) return journal.log
  let log: Record<string, number[]> = {}
  try {
    const parsed = JSON.parse(await readFile(journalFile(), 'utf8')) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) log = parsed as Record<string, number[]>
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.error('[gallery] журнал публикаций не прочитан, начинаю новый:', error)
  }
  journal.dir = dir()
  journal.log = log
  return log
}

async function saveJournal(log: Record<string, number[]>): Promise<void> {
  await writeAtomic(journalFile(), log)
  journal.dir = dir()
  journal.log = log
}

/**
 * Изменить одну видимую кухню. Правка идёт на копии; файл пишется, только если
 * запись правда поменялась — отказ или повтор той же оценки диск не трогают.
 */
async function change<T>(
  id: string,
  edit: (row: StoredKitchen, rows: StoredKitchen[]) => T | Promise<T>,
): Promise<T | 'not-found'> {
  return serial(async () => {
    const rows = await load()
    const at = rows.findIndex((r) => r.id === id && r.status === 'published')
    if (at < 0) return 'not-found' as const
    const row = structuredClone(rows[at])
    const before = JSON.stringify(row)
    const out = await edit(row, rows)
    if (JSON.stringify(row) !== before) {
      const next = [...rows]
      next[at] = row
      await save(next)
    }
    return out
  })
}

function filesOf(row: StoredKitchen): string[] {
  return [row.image, row.thumb, ...row.photos.flatMap((p) => [p, thumbOf(p)])]
}

const bytesOf = (row: StoredKitchen) => Object.values(row.sizes ?? {}).reduce((s, n) => s + n, 0)
const bytesAll = (rows: StoredKitchen[]) => rows.reduce((s, r) => s + bytesOf(r), 0)

async function removeFiles(names: string[]): Promise<void> {
  await Promise.all(
    [...new Set(names)]
      .filter((name) => PHOTO_NAME.test(name))
      .map((name) => rm(join(imageDir(), name), { force: true })),
  )
}

function stats(row: StoredKitchen): { avg: number; count: number; exact: number } {
  const stars = Object.values(row.ratings)
  const count = stars.length
  const exact = count ? stars.reduce((s, x) => s + x, 0) / count : 0
  return { avg: Math.round(exact * 100) / 100, count, exact }
}

export function toCard(row: StoredKitchen): GalleryCard {
  const { avg, count } = stats(row)
  return {
    id: row.id,
    q: row.q,
    title: row.title,
    autoTitle: row.autoTitle ?? false,
    shape: row.shape,
    role: row.role,
    authorName: row.authorName,
    authorId: row.authorId,
    createdAt: row.createdAt,
    avg,
    count,
    commentCount: row.comments.filter((c) => c.status === 'published').length,
    image: row.image,
    thumb: row.thumb,
    hasReal: row.photos.length > 0,
    ...(row.photos.length ? { realThumb: thumbOf(row.photos[0]) } : {}),
  }
}

export function toPublic(row: StoredKitchen): GalleryKitchen {
  return {
    ...toCard(row),
    comments: row.comments
      .filter((c) => c.status === 'published')
      .map((c) => ({ id: c.id, authorName: c.authorName, authorId: c.authorId, text: c.text, at: c.at })),
    realPhotos: [...row.photos],
  }
}

/**
 * Место под новую кухню: не больше `room` записей и `need` байт свободно в
 * бюджете картинок. Вычищаются сначала скрытые (старые первыми), потом самые
 * старые без оценок, потом просто старые.
 */
function evict(rows: StoredKitchen[], room: number, need: number): StoredKitchen[] {
  const dropped = new Set<StoredKitchen>()
  let count = rows.length
  let bytes = bytesAll(rows)
  const budget = imageBudget()
  const oldestFirst = [...rows].reverse()
  const pick = (test: (r: StoredKitchen) => boolean) => {
    for (const row of oldestFirst) {
      if (count <= room && bytes + need <= budget) return
      if (dropped.has(row) || !test(row)) continue
      dropped.add(row)
      count -= 1
      bytes -= bytesOf(row)
    }
  }
  pick((r) => r.status === 'hidden')
  pick((r) => Object.keys(r.ratings).length === 0)
  pick(() => true)
  return [...dropped]
}

async function writeImage(name: string, bytes: Uint8Array): Promise<void> {
  await writeFile(join(imageDir(), name), bytes)
}

/** Поставить кухню в галерею. Видна сразу. */
export async function publishKitchen(input: PublishInput): Promise<{ id: string } | 'bad-input' | 'too-many'> {
  const q = canonicalQuery(input.q)
  const checked = checkQuery(q)
  const title = validateTitle(input.title)
  if (!q || !checked || !title.ok || !(['buyer', 'master'] as const).includes(input.role)) return 'bad-input'

  return serial(async () => {
    const rows = await load()
    const log = await loadJournal()
    const now = Date.now()
    const recent = (log[input.phone] ?? []).filter((t) => now - t < DAY_MS)
    if (recent.length >= PUBLISH_PER_DAY) return 'too-many' as const

    const base = randomBytes(12).toString('hex')
    const image = `${base}.${input.image.ext}`
    const thumb = input.thumb ? `${base}-s.${input.thumb.ext}` : image
    const sizes: Record<string, number> = { [image]: input.image.bytes.length }
    if (input.thumb) sizes[thumb] = input.thumb.bytes.length
    const row: StoredKitchen = {
      id: randomBytes(8).toString('hex'),
      q,
      title: title.value ?? titleOf(q),
      autoTitle: title.value === null,
      shape: checked.shape,
      role: input.role,
      authorName: authorNameOf(input.name),
      authorId: authorIdOf(input.phone),
      phone: input.phone,
      createdAt: new Date(now).toISOString(),
      status: 'published',
      ratings: {},
      comments: [],
      reports: 0,
      reporters: [],
      image,
      thumb,
      photos: [],
      sizes,
    }
    const dropped = evict(rows, maxKitchens() - 1, bytesOf(row))
    const next = [row, ...rows.filter((r) => !dropped.includes(r))]

    try {
      await mkdir(imageDir(), { recursive: true })
      await writeImage(image, input.image.bytes)
      if (input.thumb) await writeImage(thumb, input.thumb.bytes)
      await save(next)
    } catch (error) {
      await removeFiles([image, thumb]).catch(() => undefined)
      throw error
    }
    // Журнал — после кухни: не записался — предел в этот раз мягче, кухня не теряется.
    const pruned = Object.fromEntries(
      Object.entries({ ...log, [input.phone]: [...recent, now] })
        .map(([phone, times]) => [phone, times.filter((t) => now - t < DAY_MS)] as const)
        .filter(([, times]) => times.length > 0),
    )
    await saveJournal(pruned).catch((error) => console.error('[gallery] журнал публикаций не записан:', error))
    await removeFiles(dropped.flatMap(filesOf)).catch(() => undefined)
    return { id: row.id }
  })
}

export type ListQuery = {
  sort: 'new' | 'top'
  shape?: Shape
  authorId?: string
  /** «мои»: телефон из сессии, не из адреса */
  phone?: string
  /** только с фото вживую */
  real?: boolean
  /** размер по сумме стен: до 2,7 м / 2,7–4 м / больше 4 м */
  size?: SizeBand
  page?: number
  /** кухонь на странице: по умолчанию 24, не больше 5 страниц (120) */
  limit?: number
}

export async function listKitchens(query: ListQuery): Promise<{ items: GalleryCard[]; total: number; page: number; pages: number }> {
  // все фильтры — за один проход по списку
  let rows = (await load()).filter(
    (r) =>
      r.status === 'published' &&
      (!query.shape || r.shape === query.shape) &&
      (!query.authorId || r.authorId === query.authorId) &&
      (!query.phone || r.phone === query.phone) &&
      (!query.real || r.photos.length > 0) &&
      (!query.size || sizeOf(r.q) === query.size),
  )
  if (query.sort === 'top') {
    const score = new Map(
      rows.map((r) => {
        const s = stats(r)
        return [r.id, rankScore(s.exact, s.count)] as const
      }),
    )
    // при равной оценке выше кухня с фото вживую
    const real = (r: StoredKitchen) => (r.photos.length > 0 ? 1 : 0)
    rows = [...rows].sort((x, y) => score.get(y.id)! - score.get(x.id)! || real(y) - real(x))
  } else {
    rows = [...rows].sort((x, y) => Date.parse(y.createdAt) - Date.parse(x.createdAt))
  }
  const size = Math.min(PAGE_SIZE * 5, Math.max(1, Math.floor(query.limit ?? PAGE_SIZE) || PAGE_SIZE))
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const page = Math.min(pages, Math.max(1, Math.floor(query.page ?? 1) || 1))
  return {
    items: rows.slice((page - 1) * size, page * size).map(toCard),
    total: rows.length,
    page,
    pages,
  }
}

async function published(id: string): Promise<StoredKitchen | null> {
  return (await load()).find((r) => r.id === id && r.status === 'published') ?? null
}

/** Кухня для страницы; скрытой — нет. */
export async function getKitchen(id: string): Promise<GalleryKitchen | null> {
  const row = await published(id)
  return row ? toPublic(row) : null
}

/** Что эта кухня для вошедшего: своя ли, его оценка. */
export async function viewerOf(id: string, phone: string): Promise<{ mine: boolean; stars: number | null } | null> {
  const row = await published(id)
  if (!row) return null
  return { mine: row.phone === phone, stars: row.ratings[phone] ?? null }
}

/** Видимые кухни: id и дата — для карты сайта, за один проход. */
export async function publishedIndex(): Promise<{ id: string; createdAt: string }[]> {
  return (await load()).filter((r) => r.status === 'published').map((r) => ({ id: r.id, createdAt: r.createdAt }))
}

/** Все записи — для панели владельца. */
export async function allKitchens(): Promise<StoredKitchen[]> {
  return [...(await load())]
}

export async function rateKitchen(
  id: string,
  phone: string,
  stars: number,
): Promise<{ avg: number; count: number } | 'not-found' | 'forbidden' | 'bad-input'> {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return 'bad-input'
  return change(id, (row) => {
    if (row.phone === phone) return 'forbidden' as const
    row.ratings[phone] = stars
    const { avg, count } = stats(row)
    return { avg, count }
  })
}

/**
 * Комментарий. Текст проверяется здесь (2–500 знаков, телефоны и ссылки
 * прячутся). Не чаще раза в 30 с и 20 в сутки от человека (too-many), не
 * больше 300 на кухню (full); слот предела тратится только на принятый.
 */
export async function addComment(
  id: string,
  phone: string,
  name: string,
  text: string,
): Promise<GalleryComment | 'not-found' | 'bad-input' | 'too-many' | 'full'> {
  const checked = validateComment(text)
  if (!checked.ok) return 'bad-input'
  return change(id, (row) => {
    const now = Date.now()
    const hits = (commentHits.get(phone) ?? []).filter((t) => now - t < DAY_MS)
    if (hits.length >= COMMENTS_PER_DAY || (hits.length && now - hits[hits.length - 1] < COMMENT_GAP_MS)) return 'too-many' as const
    if (row.comments.length >= COMMENTS_PER_KITCHEN) return 'full' as const
    const comment: StoredComment = {
      id: randomBytes(8).toString('hex'),
      authorName: authorNameOf(name),
      authorId: authorIdOf(phone),
      text: checked.value,
      at: new Date(now).toISOString(),
      phone,
      status: 'published',
      reports: 0,
      reporters: [],
    }
    row.comments.push(comment)
    commentHits.set(phone, [...hits, now])
    if (commentHits.size > 5000) commentHits.clear()
    return { id: comment.id, authorName: comment.authorName, authorId: comment.authorId, text: comment.text, at: comment.at }
  })
}

/** Жалоба на кухню или комментарий: одна от человека; ничего не скрывает сама. */
export async function reportItem(id: string, phone: string, commentId?: string): Promise<'ok' | 'already' | 'not-found'> {
  return change(id, (row) => {
    const target = commentId ? row.comments.find((c) => c.id === commentId && c.status === 'published') : row
    if (!target) return 'not-found' as const
    if (target.reporters.includes(phone)) return 'already' as const
    target.reporters.push(phone)
    target.reports += 1
    return 'ok' as const
  })
}

/** Автор убирает свою кухню: запись и картинки стираются. Журнал публикаций остаётся. */
export async function removeOwn(id: string, phone: string): Promise<'ok' | 'not-found' | 'forbidden'> {
  return serial(async () => {
    const rows = await load()
    const row = rows.find((r) => r.id === id && r.status === 'published')
    if (!row) return 'not-found' as const
    if (row.phone !== phone) return 'forbidden' as const
    await save(rows.filter((r) => r !== row))
    await removeFiles(filesOf(row)).catch(() => undefined)
    return 'ok' as const
  })
}

/** «Я сделал такую»: фото готовой кухни, только автор, всего до 5; кончилось место — no-space. */
export async function addRealPhotos(
  id: string,
  phone: string,
  photos: NewPhoto[],
): Promise<string[] | 'not-found' | 'forbidden' | 'too-many' | 'bad-input' | 'no-space'> {
  if (photos.length === 0) return 'bad-input'
  const names: string[] = []
  try {
    return await change(id, async (row, rows) => {
      if (row.phone !== phone) return 'forbidden' as const
      if (row.photos.length + photos.length > MAX_REAL_PHOTOS) return 'too-many' as const
      const incoming = photos.reduce((s, p) => s + p.bytes.length + (p.thumb?.length ?? 0), 0)
      const used = bytesAll(rows)
      if (used + incoming > imageBudget()) {
        console.error(`[gallery] галерея: место под картинки кончилось (${used} из ${imageBudget()} байт) — фото вживую не приняты`)
        return 'no-space' as const
      }
      await mkdir(imageDir(), { recursive: true })
      row.sizes = { ...(row.sizes ?? {}) }
      for (const photo of photos) {
        const name = `${randomBytes(12).toString('hex')}.${photo.ext}`
        names.push(name)
        await writeImage(name, photo.bytes)
        row.sizes[name] = photo.bytes.length
        if (photo.thumb) {
          await writeImage(thumbOf(name), photo.thumb)
          row.sizes[thumbOf(name)] = photo.thumb.length
        }
      }
      row.photos.push(...names)
      return [...names]
    })
  } catch (error) {
    await removeFiles(names.flatMap((n) => [n, thumbOf(n)])).catch(() => undefined)
    throw error
  }
}

/** Скрыть кухню (решение владельца). Картинки стираются сразу. */
export async function hideKitchen(id: string): Promise<boolean> {
  let files: string[] = []
  const out = await change(id, (row) => {
    files = filesOf(row)
    row.status = 'hidden'
    row.photos = []
    row.sizes = {}
    return true
  })
  if (out !== true) return false
  await removeFiles(files).catch(() => undefined)
  return true
}

export async function hideComment(id: string, commentId: string): Promise<boolean> {
  const out = await change(id, (row) => {
    const c = row.comments.find((x) => x.id === commentId && x.status === 'published')
    if (!c) return false
    c.status = 'hidden'
    return true
  })
  return out === true
}

export async function hidePhoto(id: string, name: string): Promise<boolean> {
  const out = await change(id, (row) => {
    if (!row.photos.includes(name)) return false
    row.photos = row.photos.filter((p) => p !== name)
    const sizes = { ...(row.sizes ?? {}) }
    delete sizes[name]
    delete sizes[thumbOf(name)]
    row.sizes = sizes
    return true
  })
  if (out !== true) return false
  await removeFiles([name, thumbOf(name)]).catch(() => undefined)
  return true
}

/**
 * Картинка по имени. Имя проверяется строго, и отдаём только картинки видимых
 * кухонь: у скрытой и убранной — 404, даже если файл ещё на диске.
 * Маленькой копии фото нет — отдаём большое.
 */
export async function readImage(name: string): Promise<{ bytes: Buffer; type: string } | null> {
  const match = PHOTO_NAME.exec(name)
  if (!match) return null
  const rows = await load()
  const allowed = rows.some((r) => r.status === 'published' && filesOf(r).includes(name))
  if (!allowed) return null
  const type = TYPES[match[2] as keyof typeof TYPES]
  const candidates = match[1] ? [name, name.replace('-s.', '.')] : [name]
  for (const file of candidates) {
    try {
      return { bytes: await readFile(join(imageDir(), file)), type }
    } catch {
      // нет файла — пробуем следующий
    }
  }
  return null
}
