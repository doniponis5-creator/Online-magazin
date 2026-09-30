import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Таск 05 — телефон (спецификация §5, §6; R20i, R20i.1–3, R08, R03): 3D на
 * полэкрана, липкая нижняя панель, четыре шага, лист выбранного ≤ 40svh,
 * клавиатура, «не больше трёх касаний». Шов — разметка планировщика:
 * `.kp-bar`, `.kp-steps__btn`, `.kp-sel`, `.kp-size__field input`, класс
 * `kp-typing` на `<html>`. Профиль — телефон стоя (390 × 844 из конфига).
 */
type Pt = { x: number; y: number }
type Rect = { top: number; bottom: number; height: number }

const rect = (page: Page, sel: string): Promise<Rect | null> =>
  page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!el) return null
    const b = el.getBoundingClientRect()
    return { top: b.top, bottom: b.bottom, height: b.height }
  }, sel)
const vh = (page: Page) => page.evaluate(() => window.innerHeight)
/** касание в панели: элемент — в середину экрана (сверху прилипли сцена и вкладки, снизу — панель), потом нажать */
let taps = 0
const tap = async (loc: Locator) => {
  await loc.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await loc.click()
  taps++
}
/** видимых лимонных кнопок на экране (шапка сайта не в счёт) */
const lemons = (page: Page) => page.locator('.btn--primary').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height > 0 && !e.closest('header')).length)

const ready = async (page: Page, query = 'f=corner&a=300&b=240&s=marble') => {
  await page.goto(`/ru/kitchen?${query}`)
  await page.locator('.kp-views [data-scene="plan"]').waitFor({ state: 'attached', timeout: 60000 })
  // движок собрал кухню — есть подписи размеров/ценники (ready + built)
  await page.locator('.kp-tags').waitFor({ state: 'attached', timeout: 60000 })
}

/** синтетический палец (как в kitchen-plan.spec.ts): тап по ячейке плана */
const fire = (page: Page, sel: string, type: string, p: Pt) =>
  page.evaluate(
    ([sel, type, p]) => {
      const el = document.querySelector(sel)!
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1, clientX: p.x, clientY: p.y }))
    },
    [sel, type, p] as const,
  )
const tapCell = async (page: Page, sel: string) => {
  const b = (await page.locator(sel).boundingBox())!
  const p = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  await fire(page, sel, 'pointerdown', p)
  await page.waitForTimeout(40)
  await fire(page, '.kp-plan svg', 'pointerup', p)
  await page.waitForTimeout(400)
}

test('телефон: шапка скрыта, 3D — половина экрана, нижняя панель липкая, четыре шага', async ({ page }) => {
  await ready(page)
  const h = await vh(page)
  expect((await rect(page, '.kp-head'))!.height).toBe(0)
  // холст 3D (.kp-scene), не вся сцена с полосой видов
  expect((await rect(page, '.kp-scene'))!.height).toBeGreaterThanOrEqual(h * 0.5 - 1)
  await expect(page.locator('.kp-steps__btn')).toHaveText(['Кухня', 'Техника', 'Стиль', 'Итог'])
  // панель внизу экрана: сумма · «Дальше» · корзина; одна лимонная кнопка на экране
  const bar = (await rect(page, '.kp-bar'))!
  expect(bar.height).toBe(60)
  expect(Math.round(bar.bottom)).toBe(h)
  await expect(page.locator('.kp-bar .btn--primary')).toHaveText(/Дальше/)
  expect(await lemons(page)).toBe(1)
  // пролистали вниз — панель на месте
  await page.evaluate(() => window.scrollTo(0, 1200))
  await page.waitForTimeout(400)
  expect(Math.round((await rect(page, '.kp-bar'))!.bottom)).toBe(h)
  // «Дальше» ведёт по шагам, на «Итоге» — «Всё в корзину»
  await page.locator('.kp-bar__next').click()
  await expect(page.locator('.kp-steps__btn[aria-current="step"]')).toHaveText('Техника')
  await page.locator('.kp-bar__next').click()
  await page.locator('.kp-bar__next').click()
  await expect(page.locator('.kp-steps__btn[aria-current="step"]')).toHaveText('Итог')
  await expect(page.locator('.kp-bar__next')).toHaveText(/Всё в корзину/)
  await expect(page.locator('.kp-total .kp-check')).toBeAttached()
  await expect(page.locator('.kp-total .kp-variants')).toBeAttached()
  expect(await lemons(page)).toBe(1)
  // ценники в 3D на телефоне выключены по умолчанию
  await expect(page.locator('.kp-tools__prices')).toHaveAttribute('aria-pressed', 'false')
})

test('лист выбранного: не выше 40 % экрана и не заходит на сцену', async ({ page }) => {
  await ready(page)
  await page.locator('.kp-views [data-scene="plan"]').click()
  await page.locator('.kp-plan [data-key="sink"]').waitFor()
  await tapCell(page, '.kp-plan [data-key="sink"]')
  const sel = (await rect(page, '.kp-sel'))!
  const stage = (await rect(page, '.kp-stage'))!
  const h = await vh(page)
  expect(sel.height).toBeLessThanOrEqual(h * 0.4 + 1)
  expect(sel.top).toBeGreaterThanOrEqual(stage.bottom - 1)
  // три строки: размеры/тип · ширина · перемещение
  await expect(page.locator('.kp-sel .kp-cabw')).toHaveCount(1)
  await expect(page.locator('.kp-sel .kp-move')).toBeVisible()
  expect(await lemons(page)).toBe(1)
})

test('клавиатура: фокус в числовом поле — сцена 25svh, число применяется через 300 мс без blur', async ({ page }) => {
  await ready(page)
  const field = page.locator('.kp-size__field input').first()
  // поле — под прилипшей сценой и вкладками: сначала ставим его в середину экрана
  await tap(field)
  await expect(page.locator('html')).toHaveClass(/kp-typing/)
  const h = await vh(page)
  expect((await rect(page, '.kp-scene'))!.height).toBeLessThanOrEqual(h * 0.25 + 1)
  await field.selectText()
  await page.keyboard.type('250')
  await page.waitForTimeout(500)
  await expect(page.locator('.kp-size__range').first()).toHaveValue('250')
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('INPUT')
  // ушли из поля (Tab в WebKit не уводит фокус с поля — снимаем его как касание мимо)
  await field.evaluate((el) => el.blur())
  await expect(page.locator('html')).not.toHaveClass(/kp-typing/)
})

test('не больше трёх касаний: стиль, цвет фасадов, длина стены A, духовка', async ({ page }) => {
  await ready(page)
  // стиль: вкладка + плитка = 2
  taps = 0
  await tap(page.locator('.kp-steps__btn', { hasText: 'Стиль' }))
  // карусель (таск 06) перестраивается после выбора: выбранный из полного списка уходит с первого места — сверяем по имени, не по номеру
  const style = page.locator('.kp-carousel .kp-style').nth(3)
  await expect(style).toHaveAttribute('aria-checked', 'false')
  const styleName = (await style.locator('.kp-style__name').textContent())!
  await tap(style)
  await expect(page.locator('.kp-carousel .kp-style[aria-checked="true"] .kp-style__name')).toHaveText(styleName)
  expect(taps).toBeLessThanOrEqual(3)
  // цвет фасадов: (та же вкладка) + тон = 1
  taps = 0
  const tone = page.locator('.kp-tone').nth(1)
  await expect(tone).toHaveAttribute('aria-checked', 'false')
  await tap(tone)
  await expect(tone).toHaveAttribute('aria-checked', 'true')
  expect(taps).toBeLessThanOrEqual(3)
  // длина стены A: вкладка «Кухня» + «+» = 2
  taps = 0
  await tap(page.locator('.kp-steps__btn', { hasText: 'Кухня' }))
  await tap(page.locator('.kp-sizes .kp-size__row .kp-size__step').nth(1))
  await expect(page.locator('.kp-size__range').first()).toHaveValue('305')
  expect(taps).toBeLessThanOrEqual(3)
  taps = 0
  // техника (духовка — в kitchen-acceptance по фикстуре живого каталога; здесь вытяжка, у неё локально две модели): вкладка «Техника» + строка + модель = 3
  await tap(page.locator('.kp-steps__btn', { hasText: 'Техника' }))
  await tap(page.locator('#kp-slot-hood .kp-slot__head'))
  const model = page.locator('#kp-slot-hood .kp-opt input[type="radio"]').nth(1)
  await tap(page.locator('#kp-slot-hood .kp-opt').nth(1))
  await expect(model).toBeChecked()
  expect(taps).toBeLessThanOrEqual(3)
})
