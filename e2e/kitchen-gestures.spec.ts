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

/**
 * Правка 01.10.2026 (владелец: «3D уехало далеко вверх — в центр не вернуть»): как у
 * планировщиков — кнопка «Показать всё» в 3D, пока камера не на исходном кадре, и двойной
 * тап по пустому месту возвращают кадр всей кухни; дальше предела камера не отъезжает.
 */
const canvasBox = (page: Page) =>
  page.evaluate(() => {
    const b = window.__kp!.renderer.domElement.getBoundingClientRect()
    return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }
  })
/** колесо от холста: 20 шагов отдаления */
const zoomOut = (page: Page, steps = 20) =>
  page.evaluate(async (n) => {
    const el = window.__kp!.renderer.domElement
    const b = el.getBoundingClientRect()
    for (let i = 0; i < n; i++) {
      el.dispatchEvent(new WheelEvent('wheel', { deltaY: 400, deltaMode: 0, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2, bubbles: true, cancelable: true }))
      await new Promise((r) => setTimeout(r, 30))
    }
  }, steps)
/** увести камеру: отдалить до упора, повернуть вверх и вбок */
const lose = async (page: Page) => {
  await zoomOut(page)
  const b = await canvasBox(page)
  const c = { x: b.left + b.width / 2, y: b.top + b.height * 0.3 }
  await drag3d(page, c, { x: c.x + 120, y: c.y + 160 })
  await page.waitForTimeout(800)
}
/** углы кухни, что не в холсте (пусто — вся кухня в кадре) */
const outside = (page: Page) =>
  page.evaluate(() => {
    const b = window.__kp!.renderer.domElement.getBoundingClientRect()
    return window.__kp!.screenCorners().filter((p) => p.x < b.left - 1 || p.x > b.right + 1 || p.y < b.top - 1 || p.y > b.bottom + 1)
  })

test('3D: увели камеру — «Показать всё» и двойной тап по пустому возвращают кухню; дальше предела не отъехать', async ({ page }) => {
  await ready(page)
  const fit = page.locator('.kp-fit3d')
  // на исходном кадре кнопки нет
  await expect(fit).toHaveCount(0)
  // одно колесо (без поворота) — уже не исходный кадр: OrbitControls двигает камеру сам, без кадра с moved
  await zoomOut(page, 3)
  await expect(fit).toBeVisible()
  await lose(page)
  const far = await page.evaluate(() => window.__kp!.cameraInfo())
  expect(far.home).toBe(false)
  // 20 шагов колеса — не дальше двух исходных расстояний
  expect(far.dist).toBeLessThanOrEqual(far.homeDist * 2 + 0.01)
  // кнопка видна, под пальцем — она сама (не консультант, не лист), текст как у плана
  await expect(fit).toBeVisible()
  await expect(fit).toHaveText('Показать всё')
  const blocked = await fit.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return top && el.contains(top) ? '' : (top?.className?.toString() ?? 'ничего')
  })
  expect(blocked).toBe('')
  await fit.click()
  await page.waitForTimeout(1300)
  expect(await outside(page)).toEqual([])
  expect((await page.evaluate(() => window.__kp!.cameraInfo())).home).toBe(true)
  await expect(fit).toHaveCount(0)

  // двойной тап по пустому месту (пол у края холста) — то же
  await lose(page)
  await expect(fit).toBeVisible()
  const b = await canvasBox(page)
  const empty = { x: b.left + 12, y: b.bottom - 12 }
  await fire(page, null, 'pointerdown', empty)
  await page.waitForTimeout(30)
  await fire(page, null, 'pointerup', empty)
  await page.waitForTimeout(120)
  await fire(page, null, 'pointerdown', empty)
  await page.waitForTimeout(30)
  await fire(page, null, 'pointerup', empty)
  await page.waitForTimeout(1300)
  expect(await outside(page)).toEqual([])
  expect((await page.evaluate(() => window.__kp!.cameraInfo())).home).toBe(true)
  await expect(fit).toHaveCount(0)
})
