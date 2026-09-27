import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { kitchenTexts } from '@/components/kitchen/texts'
import { READY } from '@/data/kitchen-ready'
import live from './fixtures/kitchen-live-appliances.json'
import { products } from '@/data/products'
import { kitchenAppliances } from '@/lib/kitchen/catalog'
import { checkProject } from '@/lib/kitchen/checks'
import { planKitchen } from '@/lib/kitchen/layout'
import { chosenItems, planInputOf, projectItems, projectTotal } from '@/lib/kitchen/order'
import { queryFromState, stateFromQuery } from '@/lib/kitchen/share'
import { getStyle } from '@/lib/kitchen/styles'
import type { KitchenAppliance, KitchenState, Shape } from '@/lib/kitchen/types'

/**
 * 12 готовых кухонь (истории 1–5): каждая — рабочий проект конструктора на
 * технике из каталога, с названием RU/KY и тремя картинками 3D.
 */

/**
 * Каталог — как на живом сайте: локальный catalog.json устарел (в нём нет
 * холодильников и варочных), поэтому техника живого сайта — из фикстуры
 * (`node scripts/kitchen-ready-shots.mjs --fixture`). Там только товары с
 * ценой и в наличии: так их отбирает kitchenAppliances.
 */
const liveList = live.appliances as KitchenAppliance[]
const liveIds = new Set(liveList.map((a) => a.id))
const catalog = [...kitchenAppliances(products).filter((a) => !liveIds.has(a.id)), ...liveList]
const known = new Map(catalog.map((a) => [a.id, a]))
const SLOT_PARAMS = ['fr', 'ov', 'mw', 'hb', 'hd', 'dw', 'wm']

const stateOf = (q: string) => stateFromQuery(new URLSearchParams(q), known)
const planOf = (s: KitchenState, list: readonly KitchenAppliance[]) =>
  planKitchen(planInputOf(s, chosenItems(s.picks, list)), { shelves: getStyle(s.style).shelves })

/** Ширина и высота JPEG — из заголовка кадра (SOF0/SOF2). */
function jpegSize(file: string): { w: number; h: number } {
  const b = readFileSync(file)
  let i = 2
  while (i < b.length) {
    if (b[i] !== 0xff) return { w: 0, h: 0 }
    const marker = b[i + 1]
    const len = b.readUInt16BE(i + 2)
    if (marker >= 0xc0 && marker <= 0xc2) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }
    i += 2 + len
  }
  return { w: 0, h: 0 }
}

describe('готовые кухни (kitchen-ready.ts)', () => {
  it('12 кухонь, id уникальны и годятся для адреса', () => {
    expect(READY).toHaveLength(12)
    expect(new Set(READY.map((k) => k.id)).size).toBe(12)
    for (const k of READY) expect(k.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })

  it('по три кухни каждой формы; размеры — от маленькой до большой', () => {
    const shapes = READY.map((k) => stateOf(k.q).shape)
    for (const s of ['straight', 'corner', 'u', 'island'] as Shape[]) expect(shapes.filter((x) => x === s)).toHaveLength(3)
    // меньше 300 см по стене A с холодильником и «треугольником» не собрать
    const lengths = READY.map((k) => stateOf(k.q).a)
    expect(Math.min(...lengths)).toBe(300)
    expect(Math.min(...READY.map((k) => stateOf(k.q)).filter((s) => s.shape === 'corner').map((s) => s.b))).toBe(180)
    expect(Math.max(...lengths)).toBeGreaterThanOrEqual(420)
  })

  it('каждая q разбирается без потерь: техника, стиль и отделка — известные', () => {
    for (const k of READY) expect(queryFromState(stateOf(k.q)), k.id).toBe(k.q)
  })

  it('вся техника из q — с живого сайта (в наличии); у каждой кухни свой холодильник, духовка, варочная, вытяжка', () => {
    for (const k of READY) {
      const q = new URLSearchParams(k.q)
      const ids = SLOT_PARAMS.map((p) => q.get(p)).filter((v): v is string => Boolean(v && v !== '-'))
      // модели нет в старом локальном catalog.json — не ошибка (история 4), но в живых данных она обязана быть
      for (const id of ids) expect(liveIds.has(id), `${k.id}: ${id} нет на живом сайте`).toBe(true)
      for (const p of ['fr', 'ov', 'hb', 'hd']) expect(liveIds.has(q.get(p) ?? ''), `${k.id}: ${p}`).toBe(true)
      expect(q.get('dw'), `${k.id}: посудомойка — модель или «-»`).toBeTruthy()
    }
    expect(READY.filter((k) => liveIds.has(new URLSearchParams(k.q).get('dw') ?? '')).length).toBeGreaterThanOrEqual(8)
  })

  it('planKitchen ничего не выкидывает, checkProject без замечаний', () => {
    // все замечания разом, чтобы видеть каждую кухню, а не первую
    const bad = READY.flatMap((k) => {
      const plan = planOf(stateOf(k.q), catalog)
      const warns = checkProject(plan).filter((c) => c.level === 'warn')
      return plan.dropped.length || warns.length ? [{ id: k.id, dropped: plan.dropped, warns }] : []
    })
    expect(bad).toEqual([])
  })

  it('разный бюджет техники и разная отделка: RAL, декор ЛДСП, свой цвет острова', () => {
    const sums = READY.map((k) => {
      const s = stateOf(k.q)
      return projectTotal(projectItems(s, planOf(s, catalog), catalog)).sum
    })
    // чипы «до 100 000 / до 200 000 / больше» — в каждом есть кухни
    expect(sums.filter((x) => x > 0 && x <= 100_000).length).toBeGreaterThanOrEqual(3)
    expect(sums.filter((x) => x > 100_000 && x <= 200_000).length).toBeGreaterThanOrEqual(3)
    expect(sums.filter((x) => x > 200_000).length).toBeGreaterThanOrEqual(3)
    expect(READY.some((k) => /(?:^|&)fc=ral-\d{4}/.test(k.q))).toBe(true)
    expect(READY.some((k) => /(?:^|&)fc=dec-/.test(k.q))).toBe(true)
    expect(READY.some((k) => /(?:^|&)if=/.test(k.q))).toBe(true)
    expect(new Set(READY.map((k) => stateOf(k.q).style)).size).toBe(12)
  })

  it('названия короткие и начинаются с формы, как в конструкторе (RU/KY)', () => {
    for (const k of READY) {
      const shape = stateOf(k.q).shape
      expect(k.ru.startsWith(kitchenTexts('ru').shapes[shape][0] + ' '), k.id).toBe(true)
      expect(k.ky.startsWith(kitchenTexts('ky').shapes[shape][0] + ' '), k.id).toBe(true)
      for (const name of [k.ru, k.ky]) {
        expect(name.length, name).toBeLessThanOrEqual(60)
        expect(name).toContain(' · ')
        expect(name).not.toMatch(/Плита|Духовой шкаф|Сордургуч/)
      }
    }
  })

  it('картинки на месте: 1200×750 ≤ 250 КБ, превью 480×300, карточка 1200×630', () => {
    const file = (url: string) => path.join(process.cwd(), 'public', url)
    for (const k of READY) {
      expect(k.image).toBe(`/kitchen/ready/${k.id}.jpg`)
      expect(k.thumb).toBe(`/kitchen/ready/${k.id}-s.jpg`)
      expect(k.card).toBe(`/kitchen/ready/${k.id}-card.jpg`)
      for (const [url, w, h] of [[k.image, 1200, 750], [k.thumb, 480, 300], [k.card, 1200, 630]] as const) {
        expect(existsSync(file(url)), url).toBe(true)
        expect(jpegSize(file(url)), url).toEqual({ w, h })
        expect(statSync(file(url)).size, url).toBeLessThanOrEqual(250 * 1024)
      }
    }
  })
})
