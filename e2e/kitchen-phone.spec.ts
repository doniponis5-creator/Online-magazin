import { expect, test, type Locator, type Page } from '@playwright/test'
import { MARBLE, pointOf, ready, rect, tap3d, tapPlan } from './kp'

/**
 * Таск 05 — телефон (спецификация §5, §6; R20i, R20i.1–3, R08, R03): 3D на
 * полэкрана, липкая нижняя панель, четыре шага, лист выбранного ≤ 40svh,
 * клавиатура, «не больше трёх касаний». Шов — разметка планировщика:
 * `.kp-bar`, `.kp-steps__btn`, `.kp-sel`, `.kp-size__field input`, класс
 * `kp-typing` на `<html>`. Профиль — `iphone` (375 × 812, WebKit); помощники — `e2e/kp.ts`.
 */
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


test('телефон: шапка скрыта, 3D — половина экрана, нижняя панель липкая, четыре шага', async ({ page }) => {
  await ready(page, MARBLE, 'built')
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
  await ready(page, MARBLE, 'built')
  await page.locator('.kp-views [data-scene="plan"]').click()
  await page.locator('.kp-plan [data-key="sink"]').waitFor()
  await tapPlan(page, '.kp-plan [data-key="sink"]')
  const sel = (await rect(page, '.kp-sel'))!
  const stage = (await rect(page, '.kp-stage'))!
  const h = await vh(page)
  expect(sel.height).toBeLessThanOrEqual(h * 0.4 + 1)
  expect(sel.top).toBeGreaterThanOrEqual(stage.bottom - 1)
  // три строки: размеры/тип · ширина · перемещение
  await expect(page.locator('.kp-sel .kp-cabw')).toHaveCount(1)
  await expect(page.locator('.kp-sel .kp-move')).toBeVisible()
  // пока лист открыт, нижней панели с лимонной «Дальше» нет (лист на её месте, правка 01.10.2026);
  // своей лимонной у листа тоже нет — закрыли, и лимонная снова одна
  await expect(page.locator('.kp-bar')).toBeHidden()
  expect(await lemons(page)).toBe(0)
  await page.locator('.kp-sel .kp-size-card__close').click()
  await expect(page.locator('.kp-bar')).toBeVisible()
  expect(await lemons(page)).toBe(1)
})

test('клавиатура: фокус в числовом поле — сцена 25svh, число применяется через 300 мс без blur', async ({ page }) => {
  await ready(page, MARBLE, 'built')
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
  await ready(page, MARBLE, 'built')
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

test('«Ещё» поверх листа выбранного: меню целиком видно и нажимается (слепая приёмка)', async ({ page }) => {
  await ready(page, MARBLE, 'built')
  await page.locator('.kp-views [data-scene="plan"]').click()
  await tapPlan(page, '.kp-plan [data-key="sink"]')
  await expect(page.locator('.kp-sel')).toBeVisible()
  await page.locator('.kp-tools__more').click()
  const menu = page.locator('#kp-tools-extra')
  await expect(menu).toBeVisible()
  await page.waitForTimeout(400)
  // в трёх точках по середине меню под пальцем — само меню, а не лист выбранного или что-то ещё
  const covered = await page.evaluate(() => {
    const m = document.querySelector('#kp-tools-extra')!.getBoundingClientRect()
    return [0.1, 0.5, 0.9]
      .map((k) => document.elementFromPoint(m.left + m.width * k, m.top + m.height * 0.5))
      .map((el) => (el?.closest('#kp-tools-extra') ? '' : (el?.className?.toString() ?? el?.tagName ?? '?')))
      .filter(Boolean)
  })
  expect(covered).toEqual([])
  // «Как управлять» («?») — в меню и его можно нажать
  await expect(menu.locator('button', { hasText: '?' }).first()).toBeVisible()
})

/**
 * Срочная правка 01.10.2026 (скриншот владельца с живого сайта): выбран шкаф — нижняя панель
 * `.kp-bar` ложилась поверх листа выбранного, ряд «Шкаф 60 см · ← →» срезан посередине.
 * Как у планировщиков: пока лист выбора открыт, панели нет, лист прилегает к низу экрана,
 * ← → под пальцем — сами кнопки (не панель, не консультант, не край экрана); закрыли — панель вернулась.
 */
const SIZES = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 360, height: 740 },
  { width: 414, height: 896 },
]
/** под центром каждой кнопки ← → — сама кнопка (пусто — всё нажимается) */
const blockedArrows = (page: Page) =>
  page.evaluate(() => {
    const btns = [...document.querySelectorAll<HTMLElement>('.kp-sel > .kp-move .kp-move__btn:not(.kp-move__add):not(.kp-move__close)')]
    if (btns.length !== 2) return [`кнопок ← →: ${btns.length}`]
    return btns.flatMap((b, i) => {
      const r = b.getBoundingClientRect()
      const x = r.left + r.width / 2
      const y = r.top + r.height / 2
      if (y < 0 || y > window.innerHeight || x < 0 || x > window.innerWidth) return [`кнопка ${i}: центр за экраном (${Math.round(x)}, ${Math.round(y)})`]
      const el = document.elementFromPoint(x, y)
      return el && b.contains(el) ? [] : [`кнопка ${i}: сверху ${el ? (el.className?.toString() || el.tagName) : 'ничего'}`]
    })
  })
const overlap = (a: { left: number; right: number; top: number; bottom: number }, b: { left: number; right: number; top: number; bottom: number }) =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5

/** лист выбора открыт: панели нет (или она не задевает лист), лист в экране и у его низа, ← → нажимаются; закрыли — панель на месте */
const checkSheet = async (page: Page, how: string) => {
  await expect(page.locator('.kp-sel'), how).toBeVisible()
  await page.waitForTimeout(400)
  const h = await vh(page)
  const sel = (await rect(page, '.kp-sel'))!
  const bar = await rect(page, '.kp-bar')
  if (bar && bar.height > 0) expect(overlap(bar, sel), `${how}: панель на листе`).toBe(false)
  expect(sel.bottom, `${how}: лист за краем`).toBeLessThanOrEqual(h + 0.5)
  // лист прилегает к низу экрана (меню сайта при выборе уехало — kp-pinned)
  expect(Math.round(sel.bottom), `${how}: лист не у низа`).toBe(h)
  expect(await blockedArrows(page), how).toEqual([])
  // лимонной «Дальше» при открытом листе нет — она в спрятанной панели; лимонных не больше одной
  expect(await lemons(page), how).toBe(0)
  await page.locator('.kp-sel .kp-size-card__close').click()
  await expect(page.locator('.kp-sel')).toHaveCount(0)
  const back = (await rect(page, '.kp-bar'))!
  expect(back.height, `${how}: панель не вернулась`).toBe(60)
  expect(Math.round(back.bottom)).toBe(h)
  expect(await lemons(page)).toBe(1)
}

for (const size of SIZES) {
  test(`выбор шкафа ${size.width}×${size.height}: нижняя панель не ложится на лист, ← → нажимаются`, async ({ page }) => {
    await page.setViewportSize(size)
    await ready(page, MARBLE)
    // тап в 3D по шкафу под мойкой
    await tap3d(page, await pointOf(page, 'sink'))
    await checkSheet(page, '3D')
    // тот же шкаф на плане
    await page.locator('.kp-views [data-scene="plan"]').click()
    await page.locator('.kp-plan [data-key="sink"]').waitFor()
    await tapPlan(page, '.kp-plan [data-key="sink"]')
    await checkSheet(page, 'план')
  })
}
