import 'server-only'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { KitchenAppliance } from './types'

/**
 * Только для проверки на своём компьютере (`next dev`): локальный
 * src/data/1c/catalog.json устарел — в нём нет холодильников, посудомоек и
 * варочных панелей, и конструктор показывал «нет в наличии». Добавляем технику
 * живого сайта из фикстуры тестов (`__tests__/fixtures/kitchen-live-appliances.json`,
 * обновляет `node scripts/kitchen-ready-shots.mjs --fixture`). Файл читается с
 * диска, в сборку не попадает; на боевом сайте (production) — всегда пусто.
 * Включается явно: `KP_LIVE_APPLIANCES=1 npx next dev …` — без флага dev-каталог
 * прежний, и e2e-снимки раскладки (`e2e/__snapshots__`) с ним сходятся.
 */
export function devAppliances(have: ReadonlySet<string>): KitchenAppliance[] {
  if (process.env.NODE_ENV !== 'development' || process.env.KP_LIVE_APPLIANCES !== '1') return []
  try {
    const file = path.join(process.cwd(), '__tests__', 'fixtures', 'kitchen-live-appliances.json')
    const list = (JSON.parse(readFileSync(file, 'utf8')) as { appliances?: KitchenAppliance[] }).appliances ?? []
    return list.filter((a) => a && typeof a.id === 'string' && !have.has(a.id))
  } catch {
    return []
  }
}
