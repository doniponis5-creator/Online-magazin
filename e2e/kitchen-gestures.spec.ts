import { expect, test, type Page } from '@playwright/test'

/**
 * Таск 03 — жесты в 3D (спецификация §3; R19i, R05, R05.5): одно правило
 * пальца. Шов — движок в dev-сборке (`window.__kp`): `placeOf`, `screenPointOf`,
 * `screenPointOnWall`, `selectedKey`, `lastDrag`. Пальцы — синтетические
 * PointerEvent на холсте: Playwright не умеет второй палец.
 */
import type { Place, Pt } from './kp'

const ready = async (page: Page, query = 'f=corner&a=300&b=240') => {
  await page.goto(`/ru/kitchen?${query}`)
  await page.waitForFunction(() => Boolean(window.__kp?.placeOf('sink') && window.__kp.screenPointOf('sink')), null, { timeout: 60000 })
  // камера ещё может подъезжать к кухне
  await page.waitForTimeout(1500)
}
const place = (page: Page, key: string) => page.evaluate((k) => window.__kp!.placeOf(k), key)
const pointOf = async (page: Page, key: string, dx = 0): Promise<Pt> => (await page.evaluate(([k, d]) => window.__kp!.screenPointOf(k, d), [key, dx] as const))!
const wallPoint = async (page: Page, wall: string, cm: number): Promise<Pt> => (await page.evaluate(([w, c]) => window.__kp!.screenPointOnWall(w, c), [wall, cm] as const))!
const selected = (page: Page) => page.evaluate(() => window.__kp!.selectedKey())
const lastDrag = (page: Page) => page.evaluate(() => window.__kp!.lastDrag)

const fire = (page: Page, type: string, p: Pt, id = 1, primary = true) =>
  page.evaluate(
    ([type, p, id, primary]) => {
      const c = window.__kp!.renderer.domElement
      c.dispatchEvent(
        new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: primary, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1, clientX: p.x, clientY: p.y }),
      )
    },
    [type, p, id, primary] as const,
  )
const tap = async (page: Page, p: Pt) => {
  await fire(page, 'pointerdown', p)
  await page.waitForTimeout(40)
  await fire(page, 'pointerup', p)
  await page.waitForTimeout(500)
}
/** Палец от p0 к p1 за восемь шагов; second — на полпути ложится второй палец (щипок). */
const drag = async (page: Page, p0: Pt, p1: Pt, opts: { second?: boolean } = {}) => {
  await fire(page, 'pointerdown', p0)
  const steps = opts.second ? 5 : 8
  for (let i = 1; i <= steps; i++) {
    await page.waitForTimeout(25)
    await fire(page, 'pointermove', { x: p0.x + ((p1.x - p0.x) * i) / 8, y: p0.y + ((p1.y - p0.y) * i) / 8 })
  }
  if (opts.second) {
    const q = { x: p1.x + 80, y: p1.y - 40 }
    await fire(page, 'pointerdown', q, 2, false)
    await page.waitForTimeout(30)
    await fire(page, 'pointerup', q, 2, false)
  }
  await fire(page, 'pointerup', p1)
  await page.waitForTimeout(900)
}

test('тап выбирает; тянуть невыбранный — не перетаскивание', async ({ page }) => {
  await ready(page)
  expect(await selected(page)).toBeNull()
  await tap(page, await pointOf(page, 'sink'))
  expect(await selected(page)).toBe('sink')
  const hob = (await place(page, 'hob'))!
  await drag(page, await pointOf(page, 'hob'), await pointOf(page, 'hob', 40))
  expect(await lastDrag(page)).toBeNull()
  expect(await place(page, 'hob')).toEqual(hob)
  expect(await selected(page)).toBe('sink')
})

test('выбранный идёт за пальцем с точкой захвата: взяли у края — сдвиг равен пути пальца', async ({ page }) => {
  await ready(page)
  await tap(page, await pointOf(page, 'sink'))
  const before = (await place(page, 'sink'))!
  // взяли в 25 см от середины (у правого края 60-см мойки), палец ушёл на 40 см вправо
  await drag(page, await pointOf(page, 'sink', 25), await pointOf(page, 'sink', 65))
  const last = (await lastDrag(page))!
  expect(last.phase).toBe('end')
  const after = (await place(page, 'sink'))!
  expect(after.wall).toBe('A')
  expect(Math.abs(after.center - (before.center + 40))).toBeLessThanOrEqual(2)
  expect(Math.abs(after.center - (last.cm - last.grab))).toBeLessThanOrEqual(2)
  expect(await selected(page)).toBe('sink')
})

test('второй палец отменяет перетаскивание — модуль на месте', async ({ page }) => {
  await ready(page)
  await tap(page, await pointOf(page, 'sink'))
  const before = (await place(page, 'sink'))!
  await drag(page, await pointOf(page, 'sink', -20), await pointOf(page, 'sink', -60), { second: true })
  expect((await lastDrag(page))!.phase).toBe('cancel')
  expect(await place(page, 'sink')).toEqual(before)
})

test('перенос на другую стену: плита с B на A; впритык — «не помещается» без кнопки «Сузить», когда сужение не поможет', async ({ page }) => {
  await ready(page)
  // освободить место на A: мойку к правому краю
  await tap(page, await pointOf(page, 'sink'))
  await drag(page, await pointOf(page, 'sink'), await wallPoint(page, 'A', 300))
  expect((await place(page, 'sink'))!.center).toBeGreaterThan(250)
  expect((await place(page, 'hob'))!.wall).toBe('B')
  await tap(page, await pointOf(page, 'hob'))
  expect(await selected(page)).toBe('hob')
  // плите нужна столешница по 30 см с боков: в 170 остаётся 10-см обрезок у угла — не встаёт, конструктор предлагает сузить мойку
  await drag(page, await pointOf(page, 'hob'), await wallPoint(page, 'A', 170))
  expect((await lastDrag(page))!).toMatchObject({ phase: 'end', key: 'hob', wall: 'A' })
  expect((await place(page, 'hob'))!.wall).toBe('B')
  // сузить мойку не поможет (обрезок у угла останется) — тост без кнопки «Сузить»
  const toast = page.locator('.kp-toast')
  await expect(toast).toContainText('Не помещается: на стене нет места')
  await expect(toast.getByRole('button')).toHaveCount(0)
  // ближе к углу обрезка нет — плита переезжает на A
  await drag(page, await pointOf(page, 'hob'), await wallPoint(page, 'A', 160))
  const hob = (await place(page, 'hob'))!
  expect(hob.wall).toBe('A')
  expect(Math.abs(hob.center - 160)).toBeLessThanOrEqual(8)
  expect(await selected(page)).toBe('hob')
})
