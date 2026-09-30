import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Таск 04 — план сверху (спецификация §4; R16i, R16i.1, R18i): переключатель
 * «3D · План», перетаскивание в плане через ту же связку, что у 3D, «+» на
 * пустом месте → шкаф. Шов — разметка плана: `[data-key]` у ячеек, `[data-add]`
 * у «+» пустого места, `[data-preview]` у предпросмотра, `.kp-add` — меню.
 * Пальцы — синтетические PointerEvent (как в kitchen-gestures.spec.ts).
 */
type Pt = { x: number; y: number }
type Place = { wall: string; center: number; w: number; row: string }
/** движок в dev (`window.__kp`, объявлен в kitchen-gestures.spec.ts) — здесь нужен только placeOf */
const placeOf = (page: Page, key: string) => page.evaluate((k) => (window as unknown as { __kp?: { placeOf: (key: string) => Place | null } }).__kp!.placeOf(k), key)

const ready = async (page: Page, query: string) => {
  await page.goto(`/ru/kitchen?${query}`)
  await page.locator('.kp-views [data-scene="plan"]').waitFor({ state: 'attached', timeout: 60000 })
}
const center = async (loc: Locator): Promise<Pt> => {
  const b = (await loc.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
const fire = (page: Page, sel: string, type: string, p: Pt) =>
  page.evaluate(
    ([sel, type, p]) => {
      const el = document.querySelector(sel)!
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1, clientX: p.x, clientY: p.y }))
    },
    [sel, type, p] as const,
  )
const tap = async (page: Page, sel: string) => {
  const p = await center(page.locator(sel))
  await fire(page, sel, 'pointerdown', p)
  await page.waitForTimeout(40)
  await fire(page, '.kp-plan svg', 'pointerup', p)
  await page.waitForTimeout(400)
}
const drag = async (page: Page, sel: string, dx: number) => {
  const p = await center(page.locator(sel))
  await fire(page, sel, 'pointerdown', p)
  for (let i = 1; i <= 8; i++) {
    await page.waitForTimeout(25)
    await fire(page, '.kp-plan svg', 'pointermove', { x: p.x + (dx * i) / 8, y: p.y })
  }
  await fire(page, '.kp-plan svg', 'pointerup', { x: p.x + dx, y: p.y })
  await page.waitForTimeout(800)
}
const keys = (page: Page) => page.locator('.kp-plan [data-key]').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))

test('переключатель «3D · План»: два вида, план — SVG со стенами и ячейками; «Спереди» — в «ещё»', async ({ page }) => {
  await ready(page, 'f=corner&a=300&b=240')
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
  await ready(page, 'f=straight&a=300')
  await page.locator('.kp-views [data-scene="plan"]').click()
  await expect(page.locator('.kp-plan [data-key="sink"]')).toHaveCount(1)
  // невыбранный тянуть нельзя — панорама, адрес не меняется
  const url0 = page.url()
  await drag(page, '.kp-plan [data-key="sink"]', 60)
  expect(page.url()).toBe(url0)
  await tap(page, '.kp-plan [data-key="sink"]')
  await expect(page.locator('.kp-plan .is-sel')).toHaveAttribute('data-key', 'sink')
  await expect(page.locator('.kp-move')).toContainText('Мойка')
  const x0 = (await page.locator('.kp-plan [data-key="sink"]').boundingBox())!.x
  const p = await center(page.locator('.kp-plan [data-key="sink"]'))
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
  await ready(page, 'f=straight&a=300&o=s_03040g_080h_220')
  await page.locator('.kp-views [data-scene="plan"]').click()
  await expect(page.locator('.kp-plan [data-key="g1"]')).toHaveCount(1)
  await tap(page, '.kp-plan [data-add="g1"] circle')
  await expect(page.locator('.kp-add [role="menuitem"]')).toHaveCount(6)
  await page.locator('.kp-add [data-add-kind="doors"]').click()
  await expect(page.locator('.kp-add')).toHaveCount(0)
  expect(await keys(page)).toContain('k1')
  expect(await keys(page)).not.toContain('g1')
  await expect(page.locator('.kp-plan .is-sel')).toHaveAttribute('data-key', 'k1')
})

test('стена B: см от угла — тянем плиту к углу, после отпускания она там, где палец (не зеркально)', async ({ page }) => {
  await ready(page, 'f=corner&a=300&b=240')
  await page.waitForFunction(() => Boolean((window as unknown as { __kp?: { placeOf: (k: string) => unknown } }).__kp?.placeOf('hob')), null, { timeout: 60000 })
  await page.locator('.kp-views [data-scene="plan"]').click()
  const before = (await placeOf(page, 'hob'))!
  expect(before.wall).toBe('B')
  await tap(page, '.kp-plan [data-key="hob"]')
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
  const after = (await placeOf(page, 'hob'))!
  expect(after.wall).toBe('B')
  // к углу — см от угла уменьшились ровно на путь пальца (±8 см на магнит к соседу)
  expect(after.center).toBeLessThan(before.center)
  expect(Math.abs(after.center - (before.center - 15))).toBeLessThanOrEqual(8)
})

test.describe('компьютер 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test('план колонкой рядом с 3D, а ценники и подписи 3D видны (is-plan не стоит)', async ({ page }) => {
    await ready(page, 'f=corner&a=300&b=240')
    await page.waitForFunction(() => Boolean((window as unknown as { __kp?: { placeOf: (k: string) => unknown } }).__kp?.placeOf('sink')), null, { timeout: 60000 })
    await expect(page.locator('.kp-stage')).toHaveClass(/has-col/)
    await expect(page.locator('.kp-stage')).not.toHaveClass(/is-plan/)
    await expect(page.locator('.kp-plan svg')).toBeVisible()
    // ценники: сама кнопка .kp-tag — точка 0×0 у якоря, видна её плашка .kp-tag__in
    await expect(page.locator('.kp-tags')).toBeVisible()
    await expect(page.locator('.kp-tags .kp-tag .kp-tag__in').first()).toBeVisible({ timeout: 15000 })
  })
})
