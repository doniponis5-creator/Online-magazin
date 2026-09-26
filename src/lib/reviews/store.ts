import 'server-only'

/**
 * Отзывы покупателей — где лежат.
 *
 * Прямо на сайте, в той же папке, что журнал вопросов из чата. На сервере это
 * хранилище докера (/app/data): оно переживает обновление сайта и пересборку
 * образа. Сервер SBonus и 1С отзывы не трогают.
 *
 *   reviews/reviews.json   — все отзывы, новые сверху
 *   reviews/photos/*.jpg   — фото; только у 20 видимых отзывов
 *
 * Базы нет: отзывов немного, а лишняя база — это то, что однажды ломается
 * ночью. Запись идёт по очереди, файл заменяется целиком — половинчатого
 * файла после сбоя не бывает.
 */

import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { store } from '@/lib/store'
import { MAX_SHOWN, PHOTO_NAME, thumbOf, type PublicReview } from './rules'

export type StoredReview = PublicReview & {
  /** заказ, по которому написан отзыв: второй раз по нему не написать */
  orderId: string
  /**
   * published — виден на главной;
   * archived  — вытеснен новыми, фото стёрты;
   * hidden    — скрыл владелец, фото стёрты.
   */
  status: 'published' | 'archived' | 'hidden'
}

/** Фото и его маленькая копия для карточки (того же формата; нет — карточка возьмёт большое). */
export type NewPhoto = { bytes: Uint8Array; ext: 'jpg' | 'png' | 'webp'; thumb?: Uint8Array }

/** Старые записи без фото держим, чтобы по заказу не написали второй раз. */
const KEEP_RECORDS = 1000

const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const

function dir(): string {
  return process.env.REVIEWS_DIR || join(process.env.ASSISTANT_LOG_DIR || 'data', 'reviews')
}

const listFile = () => join(dir(), 'reviews.json')
const photoDir = () => join(dir(), 'photos')

/** Список в памяти: главную открывают часто, файл читаем один раз. */
const memory = store('reviews-memory', () => ({ dir: '', rows: null as StoredReview[] | null }))

/** Очередь записи: два отзыва одновременно не затрут друг друга. */
const queue = store('reviews-queue', () => ({ tail: Promise.resolve() as Promise<unknown> }))

function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.tail.then(job, job)
  queue.tail = run.catch(() => undefined)
  return run
}

async function load(): Promise<StoredReview[]> {
  if (memory.rows && memory.dir === dir()) return memory.rows
  let rows: StoredReview[] = []
  try {
    const parsed = JSON.parse(await readFile(listFile(), 'utf8')) as unknown
    if (Array.isArray(parsed)) rows = parsed as StoredReview[]
  } catch (error) {
    // Файла ещё нет — отзывов нет. Любая другая ошибка важна: молча начать с
    // пустого списка значило бы затереть все отзывы при следующей записи.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  memory.dir = dir()
  memory.rows = rows
  return rows
}

async function save(rows: StoredReview[]): Promise<void> {
  await mkdir(dir(), { recursive: true })
  const temp = `${listFile()}.${process.pid}.tmp`
  await writeFile(temp, JSON.stringify(rows), 'utf8')
  await rename(temp, listFile())
  memory.dir = dir()
  memory.rows = rows
}

async function removePhotos(names: string[]): Promise<void> {
  await Promise.all(
    names
      .filter((name) => PHOTO_NAME.test(name))
      .flatMap((name) => [name, thumbOf(name)])
      .map((name) => rm(join(photoDir(), name), { force: true })),
  )
}

export function toPublic(row: StoredReview): PublicReview {
  return {
    id: row.id,
    name: row.name,
    rating: row.rating,
    text: row.text,
    photos: row.photos,
    products: row.products,
    createdAt: row.createdAt,
  }
}

/** Видимые отзывы, новые сверху. */
export async function publishedReviews(): Promise<PublicReview[]> {
  const rows = await load()
  return rows.filter((row) => row.status === 'published').slice(0, MAX_SHOWN).map(toPublic)
}

/** Все записи — для страницы владельца. */
export async function allReviews(): Promise<StoredReview[]> {
  return [...(await load())]
}

/** Какие из этих заказов уже с отзывом. */
export async function reviewedOrders(orderIds: string[]): Promise<string[]> {
  const rows = await load()
  const done = new Set(rows.map((row) => row.orderId))
  return orderIds.filter((id) => done.has(id))
}

/**
 * Сохранить отзыв. Сначала фото, потом запись: если запись не удалась,
 * фото стираем — сирот на диске не остаётся.
 *
 * Отзыв сразу виден на главной. Если видимых стало больше 20 — самые старые
 * уходят в архив, их фото стираются.
 */
export async function addReview(
  data: Omit<StoredReview, 'id' | 'photos' | 'status' | 'createdAt'>,
  photos: NewPhoto[],
): Promise<StoredReview | 'duplicate'> {
  return serial(async () => {
    const rows = await load()
    if (rows.some((row) => row.orderId === data.orderId)) return 'duplicate'

    await mkdir(photoDir(), { recursive: true })
    const names: string[] = []
    const review: StoredReview = {
      ...data,
      id: randomBytes(8).toString('hex'),
      photos: names,
      status: 'published',
      createdAt: new Date().toISOString(),
    }

    // Копии: список в памяти меняется только после удачной записи на диск.
    const next = [review, ...rows.map((row) => ({ ...row }))]
    const drop: string[] = []
    let shown = 0
    for (const row of next) {
      if (row.status !== 'published') continue
      shown += 1
      if (shown > MAX_SHOWN) {
        drop.push(...row.photos)
        row.status = 'archived'
        row.photos = []
      }
    }
    for (const row of next.slice(KEEP_RECORDS)) drop.push(...row.photos)

    try {
      for (const photo of photos) {
        // Имя — в список до записи: сбой посередине тоже будет убран.
        const name = `${randomBytes(12).toString('hex')}.${photo.ext}`
        names.push(name)
        await writeFile(join(photoDir(), name), photo.bytes)
        if (photo.thumb) await writeFile(join(photoDir(), thumbOf(name)), photo.thumb)
      }
      await save(next.slice(0, KEEP_RECORDS))
    } catch (error) {
      await removePhotos(names).catch(() => undefined)
      throw error
    }
    // Отзыв уже сохранён. Старое фото не стёрлось — не беда, покупателю не мешаем.
    await removePhotos(drop).catch(() => undefined)
    return review
  })
}

/** Скрыть отзыв (решение владельца). Фото стираются сразу. */
export async function hideReview(id: string): Promise<boolean> {
  return serial(async () => {
    const rows = (await load()).map((row) => ({ ...row }))
    const row = rows.find((r) => r.id === id)
    if (!row || row.status === 'hidden') return false
    const drop = row.photos
    row.status = 'hidden'
    row.photos = []
    await save(rows)
    await removePhotos(drop)
    return true
  })
}

/**
 * Фото по имени. Имя проверяется строго: чужой путь с диска не отдать.
 * Маленькой копии нет (браузер не смог её сделать) — отдаём большое фото.
 */
export async function readPhoto(name: string): Promise<{ bytes: Buffer; type: string } | null> {
  const match = PHOTO_NAME.exec(name)
  if (!match) return null
  const type = TYPES[match[2] as keyof typeof TYPES]
  const candidates = match[1] ? [name, name.replace('-s.', '.')] : [name]
  for (const file of candidates) {
    try {
      return { bytes: await readFile(join(photoDir(), file)), type }
    } catch {
      // нет файла — пробуем следующий
    }
  }
  return null
}
