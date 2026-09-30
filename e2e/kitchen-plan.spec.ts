import { expect, test, type Page } from '@playwright/test'
import { centerOf, dragPlan, fire, place, planKeys, ready, tapPlan, type Pt } from './kp'

/**
 * Таск 04 — план сверху (спецификация §4; R16i, R16i.1, R18i): переключатель
 * «3D · План», перетаскивание в плане через ту же связку, что у 3D, «+» на
 * пустом месте → шкаф. Шов — разметка плана: `[data-key]` у ячеек, `[data-add]`
 * у «+» пустого места, `[data-preview]` у предпросмотра, `.kp-add` — меню.
 * Пальцы — синтетические PointerEvent (`fire`/`tapPlan`/`dragPlan` из `e2e/kp.ts`).
 */

test('переключатель «3D · План»: два вида, план — SVG со стенами и ячейками; «Спереди» — в «ещё»', async ({ page }) => {
  await ready(page, 'f=corner&a=300&b=240', 'page')
  await expect(page.locator('.kp-views [role="radio"]')).toHaveCount(2)
  await expect(page.locator('.kp-plan')).toHaveCount(0)
  await page.locator('.kp-views [data-scene="plan"]').click()
  await expect(page.locator('.kp-plan svg')).toBeVisible()
  await expect(page.locator('.kp-plan [data-key="sink"]')).toHaveCount(1)
  await expect(page.locator('.kp-plan [data-key="hob"]')).toHaveCount(1)
  await expect(page.locator('.kp-plan .kp-plan__wall')).toHaveCount(2)
  await expect(page.locator('#kp-tools-extra .kp-camera [role="radio"]')).toHaveText(['С высоты глаз', 'Спереди'])
  await page.locator('.kp-views [data-scene="3d"]').click()
  await expect(page.locator('.kp-plan')).toHaveCount(0)
})

test('тап выбирает, тянуть выбранный — двигать с предпросмотром; после отпускания мойка на новом месте, выбор остаётся', async ({ page }) => {
  // справа от мойки пустое место 60…160 (P1: в закреплённых соседей мойка не въезжает)
  await ready(page, 'f=straight&a=300&o=s_030100g_110h_220', 'page')
  await page.locator('.kp-views [data-scene="plan"]').click()
  await expect(page.locator('.kp-plan [data-key="sink"]')).toHaveCount(1)
  // невыбранный тянуть нельзя — панорама, адрес не меняется
  const url0 = page.url()
  await dragPlan(page, '.kp-plan [data-key="sink"]', 60)
  expect(page.url()).toBe(url0)
  await tapPlan(page, '.kp-plan [data-key="sink"]')
  await expect(page.locator('.kp-plan .is-sel')).toHaveAttribute('data-key', 'sink')
  await expect(page.locator('.kp-move')).toContainText('Мойка')
  const x0 = (await page.locator('.kp-plan [data-key="sink"]').boundingBox())!.x
  const p = await centerOf(page, '.kp-plan [data-key="sink"]')
  await fire(page, '.kp-plan [data-key="sink"]', 'pointerdown', p)
  for (let i = 1; i <= 6; i++) {
    await page.waitForTimeout(25)
    await fire(page, '.kp-plan svg', 'pointermove', { x: p.x + i * 10, y: p.y })
  }
  await expect(page.locator('.kp-plan [data-preview="ok"]')).toHaveCount(1)
  await expect(page.locator('.kp-plan .kp-plan__drag').first()).toContainText('см')
  await fire(page, '.kp-plan svg', 'pointerup', { x: p.x + 60, y: p.y })
  await page.waitForTimeout(800)
  await expect(page.locator('.kp-plan [data-preview]')).toHaveCount(0)
  const x1 = (await page.locator('.kp-plan [data-key="sink"]').boundingBox())!.x
  expect(x1 - x0).toBeGreaterThan(30)
  expect(page.url()).toContain('o=')
  await expect(page.locator('.kp-plan .is-sel')).toHaveAttribute('data-key', 'sink')
})

test('«+» на пустом месте → меню → «Шкаф с дверцами»: свой шкаф k1 встаёт в пустое место', async ({ page }) => {
  await ready(page, 'f=straight&a=300&o=s_03040g_080h_220', 'page')
  await page.locator('.kp-views [data-scene="plan"]').click()
  await expect(page.locator('.kp-plan [data-key="g1"]')).toHaveCount(1)
  await tapPlan(page, '.kp-plan [data-add="g1"] circle')
  await expect(page.locator('.kp-add [role="menuitem"]')).toHaveCount(6)
  // P1: у каждого пункта значок, у шкафов и планки — ширина, которая встанет (проём 40 см)
  await expect(page.locator('.kp-add [role="menuitem"] svg')).toHaveCount(6)
  await expect(page.locator('.kp-add [data-add-kind="doors"]')).toContainText('Шкаф с дверцами40 см')
  await expect(page.locator('.kp-add [data-add-kind="drawers"]')).toHaveAttribute('data-add-w', '40')
  await expect(page.locator('.kp-add [data-add-kind="strip"]')).toHaveAttribute('data-add-w', '40')
  await page.locator('.kp-add [data-add-kind="doors"]').click()
  await expect(page.locator('.kp-add')).toHaveCount(0)
  expect(await planKeys(page)).toContain('k1')
  expect(await planKeys(page)).not.toContain('g1')
  await expect(page.locator('.kp-plan .is-sel')).toHaveAttribute('data-key', 'k1')
})

test('нижняя «+» при проёме на плане ведёт к нему: не «пустого места нет», а шкаф в проём (P1)', async ({ page }) => {
  await ready(page, 'f=straight&a=300&o=s_03040g_080h_220', 'page')
  await page.locator('.kp-views [data-scene="plan"]').click()
  await expect(page.locator('.kp-plan [data-key="g1"]')).toHaveCount(1)
  await page.locator('.kp-plan__add').click()
  await expect(page.locator('.kp-add__title')).toHaveText('Поставить сюда · пустое место 40 см')
  await page.locator('.kp-add [data-add-kind="doors"]').click()
  await expect(page.locator('.kp-add')).toHaveCount(0)
  expect(await planKeys(page)).toContain('k1')
  expect(await planKeys(page)).not.toContain('g1')
})

test('стена B: см от угла — тянем плиту к углу, после отпускания она там, где палец (не зеркально)', async ({ page }) => {
  await ready(page, 'f=corner&a=300&b=240', 'page')
  await page.waitForFunction(() => Boolean(window.__kp?.placeOf('hob')), null, { timeout: 60000 })
  await page.locator('.kp-views [data-scene="plan"]').click()
  const before = (await place(page, 'hob'))!
  expect(before.wall).toBe('B')
  await tapPlan(page, '.kp-plan [data-key="hob"]')
  await expect(page.locator('.kp-plan .is-sel')).toHaveAttribute('data-key', 'hob')
  // ряд B вертикальный, угол сверху: высота ячейки в px = ширина плиты в см; 15 см — столешница у плиты (30) до углового ещё остаётся
  const box = (await page.locator('.kp-plan [data-key="hob"]').boundingBox())!
  const pxPerCm = box.height / before.w
  const dy = -Math.round(pxPerCm * 15)
  const p = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await fire(page, '.kp-plan [data-key="hob"]', 'pointerdown', p)
  for (let i = 1; i <= 8; i++) {
    await page.waitForTimeout(25)
    await fire(page, '.kp-plan svg', 'pointermove', { x: p.x, y: p.y + (dy * i) / 8 })
  }
  await fire(page, '.kp-plan svg', 'pointerup', { x: p.x, y: p.y + dy })
  await page.waitForTimeout(900)
  const after = (await place(page, 'hob'))!
  expect(after.wall).toBe('B')
  // к углу — см от угла уменьшились ровно на путь пальца (±8 см на магнит к соседу)
  expect(after.center).toBeLessThan(before.center)
  expect(Math.abs(after.center - (before.center - 15))).toBeLessThanOrEqual(8)
})

test('полная стена: шкаф 82 тянут на мойку в стартовой «мрамор» → поменялись местами, ширины прежние (P3)', async ({ page }) => {
  await ready(page, 'f=corner&a=300&b=240&s=marble', 'page')
  await page.waitForFunction(() => Boolean(window.__kp?.placeOf('sink') && window.__kp.placeOf('A100')), null, { timeout: 60000 })
  await page.locator('.kp-views [data-scene="plan"]').click()
  const cab = (await place(page, 'A100'))!
  const sink0 = (await place(page, 'sink'))!
  expect([cab.wall, cab.w, sink0.wall, sink0.w]).toEqual(['A', 82, 'A', 60])
  expect(cab.center).toBeLessThan(sink0.center)
  await tapPlan(page, '.kp-plan [data-key="A100"]')
  await expect(page.locator('.kp-plan .is-sel')).toHaveAttribute('data-key', 'A100')
  // ряд A горизонтальный: ширина ячейки в px = ширина шкафа в см; палец — на середину мойки
  const px = (await page.locator('.kp-plan [data-key="A100"]').boundingBox())!.width / cab.w
  await dragPlan(page, '.kp-plan [data-key="A100"]', Math.round((sink0.center - cab.center) * px))
  await expect(page.locator('.kp-toast')).toHaveCount(0)
  const sink1 = (await place(page, 'sink'))!
  expect(sink1.wall).toBe('A')
  expect(sink1.w).toBe(60)
  // мойка встала на место шкафа (его левый край), шкаф 82 — справа от неё
  expect(Math.abs(sink1.center - (cab.center - cab.w / 2 + 30))).toBeLessThanOrEqual(1)
  const keys = (await planKeys(page)).filter((k): k is string => Boolean(k))
  const places = await Promise.all(keys.map((k) => place(page, k)))
  const moved = places.find((p) => p && p.wall === 'A' && p.row === 'base' && p.w === 82)
  expect(moved).toBeTruthy()
  expect(moved!.center).toBeGreaterThan(sink1.center)
})

test.describe('компьютер 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test('план колонкой рядом с 3D, а ценники и подписи 3D видны (is-plan не стоит)', async ({ page }) => {
    await ready(page, 'f=corner&a=300&b=240', 'page')
    await page.waitForFunction(() => Boolean(window.__kp?.placeOf('sink')), null, { timeout: 60000 })
    await expect(page.locator('.kp-stage')).toHaveClass(/has-col/)
    await expect(page.locator('.kp-stage')).not.toHaveClass(/is-plan/)
    await expect(page.locator('.kp-plan svg')).toBeVisible()
    // ценники: сама кнопка .kp-tag — точка 0×0 у якоря, видна её плашка .kp-tag__in
    await expect(page.locator('.kp-tags')).toBeVisible()
    await expect(page.locator('.kp-tags .kp-tag .kp-tag__in').first()).toBeVisible({ timeout: 15000 })
  })
})
