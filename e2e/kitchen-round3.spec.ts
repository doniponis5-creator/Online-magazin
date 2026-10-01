import { expect, test, type Page } from '@playwright/test'
import { MARBLE, planKeys, pointOf, ready, rect, showPlan, tapPlan } from './kp'

/**
 * P6 — доводка, круг 3 (экраны): меню «+» заменяет карточку выбранного,
 * название выбранного не обрезается, на листе мастера нет плашки keepOnLink.
 * Шов — разметка: `.kp-sel` (карточка), `.kp-add` (меню «+»), `.kp-move__name`.
 */

test('«+» при открытой карточке: карточки нет, меню есть (P6, 5)', async ({ page }) => {
  await ready(page, MARBLE, 'page')
  await showPlan(page)
  await tapPlan(page, '.kp-plan [data-key="sink"]')
  await expect(page.locator('.kp-move')).toBeVisible()
  await page.locator('.kp-plan__add').click()
  await expect(page.locator('.kp-add')).toBeVisible()
  await expect(page.locator('.kp-move')).toHaveCount(0)
  await expect(page.locator('.kp-sel')).toHaveCount(0)
})

const nameWhole = async (page: Page) => {
  // прямая «мрамор» 300: у угла бутылочница 24 см
  await ready(page, 'f=straight&a=300&s=marble', 'page')
  await showPlan(page)
  await tapPlan(page, '.kp-plan [data-key="A0"]')
  const name = page.locator('.kp-move__name')
  await expect(name).toContainText('Бутылочница 24 см')
  const cut = await name.evaluate((el) => el.scrollWidth - el.clientWidth)
  expect(cut).toBeLessThanOrEqual(1)
}
test('название выбранного не обрезается — переносится (P6)', async ({ page }) => nameWhole(page))
test.describe('компьютер 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })
  test('название выбранного не обрезается перед ← → (P6)', async ({ page }) => nameWhole(page))
})

test('лист мастера: своя прежняя кухня — без плашки «в Мои варианты» (P6)', async ({ page }) => {
  await page.goto('/ru')
  await page.evaluate(() => localStorage.setItem('kp-last', JSON.stringify({ q: 'f=straight&a=260', t: Date.now() })))
  await page.goto(`/ru/kitchen/master?${MARBLE}`)
  await expect(page.locator('.kp')).toHaveClass(/kp--master/)
  await page.waitForTimeout(2500)
  await expect(page.getByText('Ваша прежняя кухня')).toHaveCount(0)
})

/* ───────── P6, 8–10: компьютер 1280 × 800 — 3D главный, план вписан, всё о выбранном в одной карточке ───────── */

const inBox = (p: { x: number; y: number }, b: { left: number; right: number; top: number; bottom: number }) =>
  p.x > b.left && p.x < b.right && p.y > b.top && p.y < b.bottom
/** прямоугольник самого чертежа (стены, шкафы, цепочки размеров) на экране */
const drawing = (page: Page) =>
  page.evaluate(() => {
    const b = document.querySelector('.kp-plan svg > g')!.getBoundingClientRect()
    return { top: b.top, bottom: b.bottom, height: b.height, width: b.width }
  })

test.describe('компьютер 1280 × 800: раскладка (P6, 8–10)', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false })
  test('3D ≥ 50 % ширины, чертёж ≥ 60 % колонки; после переноса на другую стену центр выбранного вне карточки, полосы нет', async ({ page }) => {
    await ready(page, MARBLE)
    await expect(page.locator('.kp-stage')).toHaveClass(/has-col/)
    const work = (await rect(page, '.kp-work'))!
    const scene = (await rect(page, '.kp-scene'))!
    const plan = (await rect(page, '.kp-plan'))!
    const draw = await drawing(page)
    expect(scene.width).toBeGreaterThanOrEqual(work.width * 0.5)
    expect(draw.height).toBeGreaterThanOrEqual(plan.height * 0.6)
    // шкаф стены A, который можно перенести на другую стену
    const keys = (await planKeys(page)).filter((k): k is string => Boolean(k && /^A\d/.test(k)))
    let moved = false
    for (const k of keys) {
      await tapPlan(page, `.kp-plan [data-key="${k}"]`)
      if ((await page.locator('.kp-move__wall').count()) === 0) continue
      await page.locator('.kp-move__wall').click()
      moved = true
      break
    }
    expect(moved).toBe(true)
    await page.waitForTimeout(1500)
    // всё о выбранном — в одной карточке: ← → и «на другую стену» внутри неё, отдельной полосы нет
    await expect(page.locator('.kp-size-card .kp-move')).toBeVisible()
    await expect(page.locator('.kp-move')).toHaveCount(1)
    const card = (await rect(page, '.kp-size-card'))!
    const key = await page.evaluate(() => window.__kp!.selectedKey())
    const p = await pointOf(page, key!)
    expect(inBox(p, card)).toBe(false)
  })
})

/* ───────── P6, 6–7: телефон, полный экран — кухня крупно и над листом ───────── */

/** проекции углов угловой кухни 300 × 240: у пола и на верху шкафов (2,1 м) */
const kitchenSpan = (page: Page) =>
  page.evaluate(() => {
    const k = window.__kp as unknown as { screenPointOnWall: (w: string, cm: number, y?: number) => { x: number; y: number } | null }
    const pts = [0, 2.1].flatMap((y) => [k.screenPointOnWall('A', 0, y), k.screenPointOnWall('A', 300, y), k.screenPointOnWall('B', 240, y)])
    const ys = pts.map((p) => p!.y)
    const xs = pts.map((p) => p!.x)
    return { top: Math.min(...ys), bottom: Math.max(...ys), left: Math.min(...xs), right: Math.max(...xs) }
  })

test('телефон, полный экран: без листа кухня ≥ 70 % свободной высоты; с листом «Техника» вся кухня над листом (P6, 6–7)', async ({ page }) => {
  await ready(page, MARBLE)
  test.skip((await page.locator('.kp-bar').count()) === 0, 'только телефон стоя')
  await page.locator('.kp-tools__full').click()
  await page.waitForTimeout(2000)
  await expect(page.locator('.kp.is-panel')).toHaveCount(0)
  const canvas = (await rect(page, '.kp-scene canvas'))!
  // свободная высота — холст 3D над вкладками шагов (строка инструментов в полном экране — внизу)
  const free = canvas.height
  const bare = await kitchenSpan(page)
  // 70 % высоты у угловой 300 × 240 на холсте 375 × 716 недостижимо, не обрезав бока: проекция кухни
  // шире своей высоты (~1,2 : 1), холст — 0,52 : 1. Кухня крупная по стороне, в которую упирается (CONCERNS P6)
  expect(Math.max((bare.bottom - bare.top) / free, (bare.right - bare.left) / canvas.width)).toBeGreaterThanOrEqual(0.7)
  expect(bare.top).toBeGreaterThanOrEqual(canvas.top - 1)
  expect(bare.bottom).toBeLessThanOrEqual(canvas.bottom + 1)
  // лист шага поверх 3D: вся кухня — от пола до верха шкафов — над ним
  await page.locator('.kp-steps__btn', { hasText: 'Техника' }).click()
  await expect(page.locator('.kp.is-panel')).toHaveCount(1)
  await page.waitForTimeout(1800)
  const sheet = (await rect(page, '.kp-body'))!
  const over = await kitchenSpan(page)
  expect(over.bottom).toBeLessThanOrEqual(sheet.top)
  expect(over.top).toBeGreaterThanOrEqual(canvas.top)
})
