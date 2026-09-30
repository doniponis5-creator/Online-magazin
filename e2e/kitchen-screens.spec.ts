/**
 * Доводка P2 — экраны: камера в полном экране телефона и после «Техники», компьютер
 * 1440 × 900 в одно окно, лист мастера без правки. Движок — через `window.__kp` (dev).
 */
import { expect, test, type Page } from '@playwright/test'
import { CORNER, MARBLE, fire, goStep, pointOf, ready, rect, showPlan, stacked, tap3d, tapPlan } from './kp'

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

/* ───────── P4: карточка, полоса и консультант не закрывают нужное; план «Показать всё» ───────── */

type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number }
const inside = (p: { x: number; y: number }, b: Box) => p.x > b.left && p.x < b.right && p.y > b.top && p.y < b.bottom
/** в центре кнопки — она сама (или её содержимое), а не что-то поверх */
const onTop = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!el) return false
    const b = el.getBoundingClientRect()
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
    return Boolean(hit && (hit === el || el.contains(hit)))
  }, sel)
/** все стены плана — внутри его холста */
const wallsInPlan = (page: Page) =>
  page.evaluate(() => {
    const svg = document.querySelector('.kp-plan svg')!.getBoundingClientRect()
    return [...document.querySelectorAll('.kp-plan .kp-plan__wall')].every((w) => {
      const b = w.getBoundingClientRect()
      return b.left >= svg.left - 1 && b.right <= svg.right + 1 && b.top >= svg.top - 1 && b.bottom <= svg.bottom + 1
    })
  })
/** сдвинуть план пальцем за пустое место (середина комнаты) */
const panPlan = async (page: Page, dx: number, dy: number) => {
  const svg = (await rect(page, '.kp-plan svg'))!
  const p = { x: svg.left + svg.width * 0.6, y: svg.top + svg.height * 0.7 }
  await fire(page, '.kp-plan svg', 'pointerdown', p)
  for (let i = 1; i <= 8; i++) {
    await page.waitForTimeout(25)
    await fire(page, '.kp-plan svg', 'pointermove', { x: p.x + (dx * i) / 8, y: p.y + (dy * i) / 8 })
  }
  await fire(page, '.kp-plan svg', 'pointerup', { x: p.x + dx, y: p.y + dy })
  await page.waitForTimeout(400)
}
/** выбранный — не под карточкой, карточка ≤ 30 % холста */
const cardClear = async (page: Page) => {
  const canvas = (await rect(page, '.kp-scene canvas'))!
  const card = (await rect(page, '.kp-size-card'))!
  expect((card.width * card.height) / (canvas.width * canvas.height)).toBeLessThanOrEqual(0.3)
  const key = await page.evaluate(() => window.__kp!.selectedKey())
  expect(inside(await pointOf(page, key!), card)).toBe(false)
}
const toolsRow = async (page: Page) => {
  const undo = (await rect(page, '.kp-tools__undo'))!
  const redo = (await rect(page, '.kp-tools__redo'))!
  expect(Math.abs(undo.top - redo.top)).toBeLessThanOrEqual(2)
  expect(redo.left - undo.right).toBeGreaterThanOrEqual(0)
  expect(redo.left - undo.right).toBeLessThanOrEqual(16)
}
const addDoors = async (page: Page) => {
  await ready(page, GAP)
  await showPlan(page)
  await tapPlan(page, '.kp-plan [data-add="g1"] circle')
  if ((await page.locator('.kp-add').count()) === 0) await tapPlan(page, '.kp-plan [data-add="g1"] circle')
  await page.locator('.kp-add [data-add-kind="doors"]').click()
  await expect(page.locator('.kp-size-card')).toBeVisible()
  await page.waitForTimeout(1500)
}

for (const vp of [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  test.describe(`компьютер ${vp.width} × ${vp.height}: карточка, полоса, инструменты`, () => {
    test.use({ viewport: vp, isMobile: false, hasTouch: false })
    test('карточка ≤ 30 % холста и не над выбранным — и после переноса; «+» плана открыт; «Отменить»/«Повторить» рядом', async ({ page }) => {
      await addDoors(page)
      await cardClear(page)
      await expect(page.locator('.kp-move')).toBeVisible()
      expect(await onTop(page, '.kp-plan__add')).toBe(true)
      await page.locator('.kp-move__btn:not(.kp-move__add):not(.kp-move__close)').last().click()
      await page.waitForTimeout(1500)
      await cardClear(page)
      await toolsRow(page)
      if (vp.width === 1440) expect((await rect(page, '.kp-tools'))!.height).toBeLessThanOrEqual(50)
    })
    test('«Итог» закрывает карточку', async ({ page }) => {
      await ready(page, MARBLE)
      await tap3d(page, await pointOf(page, 'sink'))
      await expect(page.locator('.kp-size-card')).toBeVisible()
      await goStep(page, 'Итог')
      await expect(page.locator('.kp-size-card')).toHaveCount(0)
    })
  })
}

test('телефон: «Итог» закрывает лист выбранного', async ({ page }) => {
  await ready(page, MARBLE)
  test.skip(!(await stacked(page)), 'только телефон стоя')
  await tap3d(page, await pointOf(page, 'sink'))
  await expect(page.locator('.kp-sel')).toBeVisible()
  await page.locator('.kp-bar__sum').click()
  await expect(page.locator('.kp-sel')).toHaveCount(0)
})

test('телефон: консультант не лежит на «+» плана и на «×» меню', async ({ page }) => {
  await ready(page, GAP)
  test.skip(!(await stacked(page)), 'только телефон стоя')
  await showPlan(page)
  const bot = (await rect(page, '.assistant__button'))!
  expect(apart(bot, (await rect(page, '.kp-plan__add'))!)).toBe(true)
  expect(await onTop(page, '.kp-plan__add')).toBe(true)
  await page.locator('.kp-plan__add').click()
  await expect(page.locator('.kp-add')).toBeVisible()
  expect(apart((await rect(page, '.assistant__button'))!, (await rect(page, '.kp-add__close'))!)).toBe(true)
  expect(await onTop(page, '.kp-add__close')).toBe(true)
})

test('телефон: ряд «Какой сделать этот шкаф?» прокручен к выделенному', async ({ page }) => {
  await addDoors(page)
  test.skip(!(await stacked(page)), 'только телефон стоя')
  const last = page.locator('.kp-fronts__list .kp-front-opt').last()
  await last.scrollIntoViewIfNeeded()
  await last.click()
  await expect(last).toHaveAttribute('aria-checked', 'true')
  await page.locator('.kp-size-card__close').click()
  await expect(page.locator('.kp-sel')).toHaveCount(0)
  if (await page.locator('.kp-views [data-scene="3d"]').isVisible()) await page.locator('.kp-views [data-scene="3d"]').click()
  await page.waitForTimeout(1200)
  await tap3d(page, await pointOf(page, 'k1'))
  await expect(page.locator('.kp-fronts__list')).toBeVisible()
  await page.waitForTimeout(600)
  const seen = await page.evaluate(() => {
    const on = document.querySelector('.kp-fronts__list [aria-checked="true"]')!.getBoundingClientRect()
    const list = document.querySelector('.kp-fronts__list')!.getBoundingClientRect()
    return on.left >= list.left - 1 && on.right <= list.right + 1
  })
  expect(seen).toBe(true)
})

test('план: сдвинули — «Показать всё» возвращает кухню; после «+» план вписан сам', async ({ page }) => {
  await ready(page, CORNER)
  await showPlan(page)
  expect(await wallsInPlan(page)).toBe(true)
  await panPlan(page, 160, 140)
  expect(await wallsInPlan(page)).toBe(false)
  await page.locator('.kp-plan__fit').click()
  await page.waitForTimeout(300)
  expect(await wallsInPlan(page)).toBe(true)
  await panPlan(page, 160, 140)
  expect(await wallsInPlan(page)).toBe(false)
  await page.locator('.kp-plan__add').click()
  await expect(page.locator('.kp-add')).toBeVisible()
  await page.locator('.kp-add [data-add-kind="doors"]').click()
  await page.waitForTimeout(800)
  if ((await page.locator('.kp-plan svg').count()) === 0) await showPlan(page)
  expect(await wallsInPlan(page)).toBe(true)
})
