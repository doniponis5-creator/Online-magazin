import 'server-only'

/**
 * Постоянный адрес доставки покупателя — чтобы не набирать его каждый раз.
 *
 * Лежит на самом сайте, рядом с отзывами (/app/data на сервере — хранилище
 * докера, переживает обновление сайта). Ключ — номер телефона из входа: адрес
 * виден с любого устройства, где покупатель вошёл. Серверу SBonus и 1С адрес
 * не нужен — в заказ он уходит как обычно, из формы оформления.
 *
 *   customers/addresses.json — { "996555123456": { city, address, updatedAt } }
 *
 * Запись по очереди, файл заменяется целиком: половинчатого файла после сбоя
 * не бывает. Удалили учётную запись — адрес стирается вместе с ней.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { store } from '@/lib/store'
import { cleanAddress, type SavedAddress } from './address-rules'

type Book = Record<string, SavedAddress & { updatedAt: string }>

function dir(): string {
  return process.env.CUSTOMERS_DIR || join(process.env.ASSISTANT_LOG_DIR || 'data', 'customers')
}

const bookFile = () => join(dir(), 'addresses.json')

/** Книга в памяти: кабинет и оформление открывают часто, файл читаем один раз. */
const memory = store('addresses-memory', () => ({ file: '', book: null as Book | null }))

/** Очередь записи: два сохранения одновременно не затрут друг друга. */
const queue = store('addresses-queue', () => ({ tail: Promise.resolve() as Promise<unknown> }))

function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.tail.then(job, job)
  queue.tail = run.catch(() => undefined)
  return run
}

async function load(): Promise<Book> {
  const file = bookFile()
  if (memory.book && memory.file === file) return memory.book
  let book: Book = {}
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) book = parsed as Book
  } catch {
    // файла ещё нет — книга пустая
  }
  memory.file = file
  memory.book = book
  return book
}

async function save(book: Book): Promise<void> {
  await mkdir(dir(), { recursive: true })
  const temp = `${bookFile()}.${process.pid}.tmp`
  await writeFile(temp, JSON.stringify(book), 'utf8')
  await rename(temp, bookFile())
  memory.book = book
}

export async function getAddress(phone: string): Promise<SavedAddress | null> {
  const found = (await load())[phone]
  return found ? { city: found.city, address: found.address } : null
}

/** Сохранить адрес. null — адрес не прошёл проверку (пустой или слишком длинный). */
export function setAddress(phone: string, input: unknown): Promise<SavedAddress | null> {
  const clean = cleanAddress(input)
  if (!clean) return Promise.resolve(null)
  return serial(async () => {
    const book = { ...(await load()) }
    book[phone] = { ...clean, updatedAt: new Date().toISOString() }
    await save(book)
    return clean
  })
}

export function removeAddress(phone: string): Promise<void> {
  return serial(async () => {
    const book = await load()
    if (!(phone in book)) return
    const next = { ...book }
    delete next[phone]
    await save(next)
  })
}
