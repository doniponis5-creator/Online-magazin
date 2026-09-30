import { expect, test, type Page } from '@playwright/test'

/**
 * Таск 03 — жесты в 3D (спецификация §3; R19i, R05, R05.5): одно правило
 * пальца. Шов — движок в dev-сборке (`window.__kp`): `placeOf`, `screenPointOf`,
 * `screenPointOnWall`, `selectedKey`, `lastDrag`. Пальцы — синтетические
 * PointerEvent на холсте: Playwright не умеет второй палец.
 */
import { drag3d, fire, lastDrag, place, pointOf, ready, selected, tap3d, wallPoint, type Place, type Pt } from './kp'


test('тап выбирает; тянуть невыбранный — не перетаскивание', async ({ page }) => {
  await ready(page)
  expect(await selected(page)).toBeNull()
  await tap3d(page, await pointOf(page, 'sink'))
  expect(await selected(page)).toBe('sink')
  const hob = (await place(page, 'hob'))!
  await drag3d(page, await pointOf(page, 'hob'), await pointOf(page, 'hob', 40))
  expect(await lastDrag(page)).toBeNull()
  expect(await place(page, 'hob')).toEqual(hob)
  expect(await selected(page)).toBe('sink')
})

test('выбранный идёт за пальцем с точкой захвата: взяли у края — сдвиг равен пути пальца', async ({ page }) => {
  await ready(page)
  await tap3d(page, await pointOf(page, 'sink'))
  const before = (await place(page, 'sink'))!
  // взяли в 25 см от середины (у правого края 60-см мойки), палец ушёл на 40 см вправо
  await drag3d(page, await pointOf(page, 'sink', 25), await pointOf(page, 'sink', 65))
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
  await tap3d(page, await pointOf(page, 'sink'))
  const before = (await place(page, 'sink'))!
  await drag3d(page, await pointOf(page, 'sink', -20), await pointOf(page, 'sink', -60), { second: true })
  expect((await lastDrag(page))!.phase).toBe('cancel')
  expect(await place(page, 'sink')).toEqual(before)
})

test('перенос на другую стену: плита с B на A; впритык — «не помещается» без кнопки «Сузить», когда сужение не поможет', async ({ page }) => {
  await ready(page)
  // освободить место на A: мойку к правому краю
  await tap3d(page, await pointOf(page, 'sink'))
  await drag3d(page, await pointOf(page, 'sink'), await wallPoint(page, 'A', 300))
  expect((await place(page, 'sink'))!.center).toBeGreaterThan(250)
  expect((await place(page, 'hob'))!.wall).toBe('B')
  await tap3d(page, await pointOf(page, 'hob'))
  expect(await selected(page)).toBe('hob')
  // плите нужна столешница по 30 см с боков: в 170 остаётся 10-см обрезок у угла — не встаёт, конструктор предлагает сузить мойку
  await drag3d(page, await pointOf(page, 'hob'), await wallPoint(page, 'A', 170))
  expect((await lastDrag(page))!).toMatchObject({ phase: 'end', key: 'hob', wall: 'A' })
  expect((await place(page, 'hob'))!.wall).toBe('B')
  // сузить мойку не поможет (обрезок у угла останется) — тост без кнопки «Сузить»
  const toast = page.locator('.kp-toast')
  await expect(toast).toContainText('Не помещается: на стене нет места')
  await expect(toast.getByRole('button')).toHaveCount(0)
  // ближе к углу обрезка нет — плита переезжает на A
  await drag3d(page, await pointOf(page, 'hob'), await wallPoint(page, 'A', 160))
  const hob = (await place(page, 'hob'))!
  expect(hob.wall).toBe('A')
  expect(Math.abs(hob.center - 160)).toBeLessThanOrEqual(8)
  expect(await selected(page)).toBe('hob')
})
