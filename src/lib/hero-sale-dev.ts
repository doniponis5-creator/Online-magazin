import 'server-only'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { SALE_MIN, type SaleCard } from './hero-sale'

/**
 * Только для проверки на своём компьютере (`next dev`): локальный catalog.json устарел —
 * в нём 3 скидки, и их фото на сервере уже заменены (карточки пустые). Поэтому в dev
 * берём снимок скидок живого сайта из `__tests__/fixtures/hero-sale-live.json`
 * (снят с главной smarket.kg 01.10.2026). На боевом сайте (production) — всегда настоящий каталог.
 */
export function devSaleCards(real: SaleCard[]): SaleCard[] {
  if (process.env.NODE_ENV !== 'development') return real
  try {
    const file = path.join(process.cwd(), '__tests__', 'fixtures', 'hero-sale-live.json')
    const cards = (JSON.parse(readFileSync(file, 'utf8')) as { cards?: SaleCard[] }).cards ?? []
    return cards.length >= SALE_MIN ? cards : real
  } catch {
    return real
  }
}
