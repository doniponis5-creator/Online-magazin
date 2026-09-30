/**
 * Доводка P2 — экраны: камера в полном экране телефона и после «Техники», компьютер
 * 1440 × 900 в одно окно, лист мастера без правки. Движок — через `window.__kp` (dev).
 */
import { expect, test, type Page } from '@playwright/test'
import { CORNER, MARBLE, goStep, pointOf, ready, rect, showPlan, tap3d, tapPlan } from './kp'

/** проекции углов кухни (стены A и B у пола) и выбранного — внутри холста */
const inFrame = async (page: Page, a = 300, b = 240) => {
  const box = (await rect(page, '.kp-scene canvas'))!
  const pts = await page.evaluate(
    ([a, b]) => [window.__kp!.screenPointOnWall('A', 0), window.__kp!.screenPointOnWall('A', a), window.__kp!.screenPointOnWall('B', b)],
    [a, b] as const,
  )
  for (const p of pts) {
    expect(p!.x).toBeGreaterThanOrEqual(box.left)
    expect(p!.x).toBeLessThanOrEqual(box.right)
    expect(p!.y).toBeGreaterThanOrEqual(box.top)
    expect(p!.y).toBeLessThanOrEqual(box.bottom)
  }
  return box
}

test('телефон, полный экран: вся кухня и выбранный в кадре, «3D / План» над листом', async ({ page }) => {
  await ready(page, MARBLE)
  test.skip((await page.locator('.kp-bar').count()) === 0, 'только телефон стоя')
  await tap3d(page, await pointOf(page, 'sink'))
  await expect(page.locator('.kp-sel')).toBeVisible()
  await page.locator('.kp-tools__full').click()
  await page.waitForTimeout(500)
  // кадр нарисован сразу: холст уже нового размера и не пустой по размеру
  const early = (await rect(page, '.kp-scene canvas'))!
  expect(early.height).toBeGreaterThan(200)
  await page.waitForTimeout(1500)
  const box = await inFrame(page)
  const key = await page.evaluate(() => window.__kp!.selectedKey())
  const sel = await pointOf(page, key!)
  expect(sel.y).toBeLessThanOrEqual(box.bottom)
  expect(sel.y).toBeGreaterThanOrEqual(box.top)
  const views = (await rect(page, '.kp-views'))!
  const sheet = (await rect(page, '.kp-sel'))!
  await expect(page.locator('.kp-views')).toBeVisible()
  expect(views.bottom).toBeLessThanOrEqual(sheet.top + 1)
})

test('«Техника» → «Стиль»: камера снова на всю кухню', async ({ page }) => {
  await ready(page, MARBLE)
  await goStep(page, 'Техника')
  await page.locator('.kp-slots button').first().click()
  await page.waitForTimeout(1500)
  await goStep(page, 'Стиль')
  await page.waitForTimeout(1500)
  await inFrame(page)
})

test.describe('компьютер 1440 × 900', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false })
  test('редактор целиком в окне, образцы цвета не обрезаны', async ({ page }) => {
    await ready(page, MARBLE, 'built')
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    const h = await page.evaluate(() => window.innerHeight)
    expect((await rect(page, '.kp-work'))!.bottom).toBeLessThanOrEqual(h)
    expect((await rect(page, '.kp-stage'))!.bottom).toBeLessThanOrEqual(h)
    expect((await rect(page, '.kp-next-row'))!.bottom).toBeLessThanOrEqual(h)
    await goStep(page, 'Стиль')
    const panel = (await rect(page, '.kp-panel'))!
    const right = await page.locator('.kp-colors > *').evaluateAll((els) => Math.max(...els.map((e) => e.getBoundingClientRect().right)))
    expect(right).toBeLessThanOrEqual(panel.right)
  })
})

test('лист мастера: чертежи первыми, инструментов правки нет', async ({ page }) => {
  await page.goto(`/ru/kitchen/master?${CORNER}`)
  await page.locator('.kp-spec svg').first().waitFor({ timeout: 60000 })
  const spec = (await rect(page, '.kp-spec'))!
  const work = (await rect(page, '.kp-work'))!
  expect(spec.top).toBeLessThan(work.top)
  await expect(page.locator('.kp-tools__undo')).toBeHidden()
  await expect(page.locator('.kp-tools__prices')).toBeHidden()
  await expect(page.locator('.kp-plan__add')).toHaveCount(0)
  await expect(page.locator('.kp-add')).toHaveCount(0)
  // консультант не лежит на развёртке
  const bot = await rect(page, '.assistant')
  if (bot && bot.width > 0 && (await page.locator('.assistant').isVisible())) {
    const svg = (await rect(page, '.kp-spec svg'))!
    expect(bot.left >= svg.right || bot.top >= svg.bottom || bot.right <= svg.left || bot.bottom <= svg.top).toBe(true)
  }
})

/** что есть в листе выбранного: набор блоков (первый класс каждого), без повторов */
const selParts = (page: Page) =>
  page.locator('.kp-sel [class]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('class')!.split(' ')[0]))].sort())
const apart = (a: { left: number; right: number; top: number; bottom: number }, b: typeof a) =>
  a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top
const GAP = 'f=straight&a=300&o=s_03040g_080h_220'

/** «+» в пустое место → «Шкаф с дверцами»; потом закрыть и нажать на тот же шкаф в 3D */
const addThenTap = async (page: Page) => {
  await ready(page, GAP)
  await showPlan(page)
  // план мог ещё переложиться под высоту окна — не открылось меню, нажимаем ещё раз
  await tapPlan(page, '.kp-plan [data-add="g1"] circle')
  if ((await page.locator('.kp-add').count()) === 0) await tapPlan(page, '.kp-plan [data-add="g1"] circle')
  await expect(page.locator('.kp-add')).toBeVisible()
  await page.locator('.kp-add [data-add-kind="doors"]').click()
  await expect(page.locator('.kp-size-card')).toBeVisible()
  await page.waitForTimeout(1200)
  const added = { parts: await selParts(page), card: (await rect(page, '.kp-size-card'))! }
  const title = page.locator('.kp-size-card__title')
  await expect(title).toHaveText(/^Шкаф.* \d+ см$/)
  expect(await title.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  const hint = await rect(page, '.kp-hint')
  if (hint && hint.width > 0) for (const s of ['.kp-size-card', '.kp-move']) expect(apart(hint, (await rect(page, s))!)).toBe(true)
  await page.locator('.kp-size-card__close').click()
  await expect(page.locator('.kp-sel')).toHaveCount(0)
  if (await page.locator('.kp-views [data-scene="3d"]').isVisible()) await page.locator('.kp-views [data-scene="3d"]').click()
  await page.waitForFunction(() => Boolean(window.__kp?.screenPointOf('k1')), null, { timeout: 30000 })
  await page.waitForTimeout(800)
  await tap3d(page, await pointOf(page, 'k1'))
  await expect(page.locator('.kp-size-card')).toBeVisible()
  await page.waitForTimeout(1200)
  return { added, tapped: { parts: await selParts(page), card: (await rect(page, '.kp-size-card'))! } }
}

test('выбор после «+» и после нажатия в 3D — одна и та же карточка, название целиком', async ({ page }) => {
  const { added, tapped } = await addThenTap(page)
  expect(added.parts).toEqual(tapped.parts)
  expect(added.parts).toEqual(expect.arrayContaining(['kp-size-card', 'kp-cabw', 'kp-move']))
})

test('телефон: у выбранного ярлыки ширины, высоты и глубины, друг на друга не лезут', async ({ page }) => {
  await ready(page, MARBLE)
  test.skip((await page.locator('.kp-bar').count()) === 0, 'только телефон стоя')
  await tap3d(page, await pointOf(page, 'sink'))
  await expect(page.locator('.kp-sel')).toBeVisible()
  const tags = page.locator('.kp-dim--measure .kp-dim__in')
  await expect(tags).toHaveCount(3)
  for (let i = 0; i < 3; i++) await expect(tags.nth(i)).toBeVisible()
  const boxes = await tags.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect))
  const canvas = (await rect(page, '.kp-scene canvas'))!
  for (const b of boxes) {
    expect(b.top).toBeGreaterThanOrEqual(canvas.top - 1)
    expect(b.bottom).toBeLessThanOrEqual(canvas.bottom + 1)
  }
  expect(apart(boxes[0], boxes[1]) && apart(boxes[0], boxes[2]) && apart(boxes[1], boxes[2])).toBe(true)
})

test.describe('компьютер: карточка выбора', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false })
  test('после «+» и после нажатия — та же карточка на том же месте', async ({ page }) => {
    const { added, tapped } = await addThenTap(page)
    expect(added.parts).toEqual(tapped.parts)
    expect(Math.abs(added.card.left - tapped.card.left)).toBeLessThanOrEqual(2)
    expect(Math.abs(added.card.top - tapped.card.top)).toBeLessThanOrEqual(2)
  })
})
