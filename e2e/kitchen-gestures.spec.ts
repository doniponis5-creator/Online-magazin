import { expect, test, type Page } from '@playwright/test'

/**
 * Таск 03 — жесты в 3D (спецификация §3; R19i, R05, R05.5): одно правило
 * пальца. Шов — движок в dev-сборке (`window.__kp`): `placeOf`, `screenPointOf`,
 * `screenPointOnWall`, `selectedKey`, `lastDrag`. Пальцы — синтетические
 * PointerEvent на холсте: Playwright не умеет второй палец.
 */
import { drag3d, dragPlan, fire, lastDrag, place, pointOf, ready, selected, showPlan, tap3d, tapPlan, wallPoint, type Place, type Pt } from './kp'


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

/**
 * Стартовая кухня (угловая 300 × 240): мойка 182…242, справа автошкаф 58. Палец на 40 см вправо —
 * мойка встаёт под палец, автошкаф уступает ровно на нехватку (P1, мягкие соседи).
 */
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

/**
 * Кухня переноса задана адресом явно (C2, 18; P1): угловая, стена A 300 см, стена B 240 см;
 * мойка у правого конца A (`s_270`, 240…300), варочная на B (`h_150`). На A угол 0…100.
 * `MOVE` — как со старта: 100…240 заняты автошкафами 70 + 70. Они мягкие (P1): варочная в 160
 * (панель 130…190, столешница 100…220) встаёт, первый уходит, второй уступает до 20.
 * `MOVE_FREE` — 100…240 пустое место: встаёт так же, остаток пустого места 220…240.
 */
const MOVE = 'f=corner&a=300&b=240&o=dwtpqfs_270.h_150v'
const MOVE_FREE = 'f=corner&a=300&b=240&o=dwtpqf140g_170s_270.h_150v'

test('перенос на другую стену: варочная с B на A из автошкафов (как со старта) — встаёт в 160, мойка на месте', async ({ page }) => {
  await ready(page, MOVE)
  expect(await place(page, 'sink')).toMatchObject({ wall: 'A', center: 270 })
  expect(await place(page, 'hob')).toMatchObject({ wall: 'B', center: 150 })
  await tap3d(page, await pointOf(page, 'hob'))
  expect(await selected(page)).toBe('hob')
  await drag3d(page, await pointOf(page, 'hob'), await wallPoint(page, 'A', 160))
  expect((await lastDrag(page))!).toMatchObject({ phase: 'end', key: 'hob', wall: 'A' })
  const hob = (await place(page, 'hob'))!
  expect(hob.wall).toBe('A')
  expect(Math.abs(hob.center - 160)).toBeLessThanOrEqual(1)
  expect(await place(page, 'sink')).toMatchObject({ wall: 'A', center: 270 })
  await expect(page.locator('.kp-toast')).toHaveCount(0)
})

test('перенос на другую стену: варочная с B в пустое место A — встаёт в 160', async ({ page }) => {
  await ready(page, MOVE_FREE)
  expect(await place(page, 'hob')).toMatchObject({ wall: 'B', center: 150 })
  await tap3d(page, await pointOf(page, 'hob'))
  expect(await selected(page)).toBe('hob')
  await drag3d(page, await pointOf(page, 'hob'), await wallPoint(page, 'A', 160))
  const hob = (await place(page, 'hob'))!
  expect(hob.wall).toBe('A')
  expect(Math.abs(hob.center - 160)).toBeLessThanOrEqual(1)
  expect(await selected(page)).toBe('hob')
})

/**
 * Положительный путь «Сузить» (C2, 24). Прямая стена 400: мойка 0…60, пусто g1 60…100,
 * свой шкаф k1 100…160 (60 см), варочная 190…250, свой шкаф k2 340…400 (60 см).
 * k2 кладём в пустое место (палец в 80): там 40 см, шкафу 60 — не хватает 20, сузить можно
 * соседа справа k1 на 20 → 40 см. После «Сузить» k1 прижат к своему правому краю (120…160),
 * а k2 встаёт вплотную к мойке: 60…120.
 */
const NARROW = 'f=straight&a=400&s=marble&o=s_03040g_08060o_130h_22060o_370'

test('«Сузить»: шкаф не влез в пустое место — кнопка есть, сужает соседа и ставит шкаф', async ({ page }) => {
  await ready(page, NARROW)
  await showPlan(page)
  // ячейка плана — в сантиметрах, с зазором 0,4 см с каждой стороны: берём края, округлённые до см
  const box = (sel: string) =>
    page
      .locator(`.kp-plan [data-key="${sel}"] rect`)
      .first()
      .evaluate((r) => {
        const x = Number(r.getAttribute('x'))
        return {
          from: Math.round(x),
          to: Math.round(x + Number(r.getAttribute('width'))),
        }
      })
  expect(await box('k1')).toEqual({ from: 100, to: 160 })
  expect(await box('k2')).toEqual({ from: 340, to: 400 })
  await tapPlan(page, '.kp-plan [data-key="k2"]')
  await expect(page.locator('.kp-plan .is-sel')).toHaveAttribute('data-key', 'k2')
  // пикселей на сантиметр плана — по самому шкафу
  const px = (await page.locator('.kp-plan [data-key="k2"] rect').first().boundingBox())!.width / 60
  await dragPlan(page, '.kp-plan [data-key="k2"]', Math.round((80 - 370) * px))
  const toast = page.locator('.kp-toast')
  await expect(toast).toContainText('на 20 см')
  const act = toast.getByRole('button', { name: 'Сузить' })
  await expect(act).toHaveCount(1)
  await act.click()
  await expect.poll(() => box('k1')).toEqual({ from: 120, to: 160 })
  expect(await box('k2')).toEqual({ from: 60, to: 120 })
})
