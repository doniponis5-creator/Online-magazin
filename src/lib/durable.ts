import 'server-only'

/**
 * Память, которая переживает перезапуск сайта.
 *
 * store() держит данные в памяти процесса: обновили сайт посреди заказа в
 * WhatsApp — покупатель пишет адрес, а бот уже не помнит, что оформлял
 * (аудит 03.10). Здесь та же Map, но каждое изменение через секунду
 * записывается в файл рядом с отзывами и адресами (/app/data на сервере —
 * хранилище докера), а при запуске читается обратно.
 *
 *   state/<имя>.json — [[ключ, значение, когда записано], …]
 *
 * Запись старше ttl при чтении выбрасывается: черновик заказа недельной
 * давности не должен перехватить новый разговор. Ключи-числа (чат Telegram)
 * остаются числами — поэтому массив пар, а не объект.
 *
 * Черновик заказа меняют на месте (draft.step = 'phone') — set() при этом не
 * зовут. Поэтому запись планирует и get(): взяли значение — могли поменять.
 * При выходе процесса (обновление сайта) несохранённое пишется сразу.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { store } from './store'

function stateDir(): string {
  return process.env.STATE_DIR || join(process.env.ASSISTANT_LOG_DIR || 'data', 'state')
}

/** В тестах на диск не пишем: каждый тест начинает с чистой памяти. */
const onDisk = () => !process.env.VITEST

class DurableMap<K, V> extends Map<K, V> {
  private stamps = new Map<K, number>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private ready = false
  private exitHook = false

  constructor(
    private readonly file: string,
    private readonly ttl: number,
  ) {
    super()
    if (onDisk()) {
      try {
        const rows = JSON.parse(readFileSync(file, 'utf8')) as [K, V, number][]
        const now = Date.now()
        for (const [key, value, at] of rows) {
          if (now - at < ttl) {
            super.set(key, value)
            this.stamps.set(key, at)
          }
        }
      } catch {
        // файла ещё нет или он испорчен — начинаем с пустой памяти
      }
    }
    this.ready = true
  }

  private fresh(key: K): boolean {
    const at = this.stamps.get(key)
    if (at === undefined || Date.now() - at < this.ttl) return true
    this.delete(key)
    return false
  }

  override get(key: K): V | undefined {
    if (!this.fresh(key)) return undefined
    const value = super.get(key)
    // Объект могут поменять на месте (черновик заказа) — запишем через секунду.
    if (value !== undefined && typeof value === 'object') this.later()
    return value
  }

  override has(key: K): boolean {
    return this.fresh(key) && super.has(key)
  }

  override set(key: K, value: V): this {
    super.set(key, value)
    // Map вызывает set() из своего конструктора — до того, как поля готовы.
    if (!this.ready) return this
    this.stamps.set(key, Date.now())
    this.later()
    return this
  }

  override delete(key: K): boolean {
    this.stamps.delete(key)
    const had = super.delete(key)
    if (had) this.later()
    return had
  }

  override clear(): void {
    super.clear()
    this.stamps.clear()
    this.later()
  }

  /** Пишем не на каждое изменение, а раз в секунду: заказ — это пять шагов подряд. */
  private later(): void {
    if (!onDisk() || this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.save()
    }, 1000)
    this.timer.unref?.()
    // Сайт останавливают для обновления — то, что не успело записаться за секунду, пишем сейчас.
    if (!this.exitHook) {
      this.exitHook = true
      process.once('exit', () => {
        if (this.timer) this.save()
      })
    }
  }

  private save(): void {
    try {
      const now = Date.now()
      // Брошенные черновики старше ttl в файл не переносим.
      const rows = [...super.entries()]
        .map(([key, value]) => [key, value, this.stamps.get(key) ?? now] as const)
        .filter(([, , at]) => now - at < this.ttl)
      mkdirSync(stateDir(), { recursive: true })
      const temp = `${this.file}.${process.pid}.tmp`
      writeFileSync(temp, JSON.stringify(rows), 'utf8')
      renameSync(temp, this.file)
    } catch (error) {
      // Не записали — разговор продолжается из памяти, как было до этого файла.
      console.error('[durable] не записано:', error instanceof Error ? error.message : error)
    }
  }
}

/** Map, которая помнит содержимое после перезапуска сайта. ttl — сколько живёт одна запись. */
export function durableMap<K extends string | number, V>(name: string, ttlMs: number): Map<K, V> {
  return store(`durable:${name}`, () => new DurableMap<K, V>(join(stateDir(), `${name}.json`), ttlMs))
}
