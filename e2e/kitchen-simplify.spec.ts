import { expect, test, type Page } from '@playwright/test'
import { FRONT_COLORS } from '../src/lib/kitchen/finishes'

/**
 * Таск 06 — меньше лишнего (спецификация, истории 25, 26, 28, 38; Решения §6):
 * карусель из 8 стилей и «Все стили», 16 цветов и «Точный код (RAL / декор)»,
 * «Ещё N» у ручек, один WhatsApp на «Итоге», «Ещё» без переключателя чёткости.
 * Шов — разметка планировщика: `.kp-carousel .kp-style`, `.kp-styles__all`,
 * `#kp-styles-all .kp-style`, `.kp-colors__exact`, `#kp-exact`, `.kp-more-btn`,
 * `#kp-tools-extra`, `a[href*="wa.me"]`. Профиль — телефон стоя (390 × 844 из конфига).
 */
const ready = async (page: Page, query = 'f=corner&a=300&b=240&s=marble') => {
  await page.goto(`/ru/kitchen?${query}`)
  await page.locator('.kp-views [data-scene="plan"]').waitFor({ state: 'attached', timeout: 60000 })
  await page.locator('.kp-tags').waitFor({ state: 'attached', timeout: 60000 })
}
const step = async (page: Page, name: string) => {
  await page.locator('.kp-steps__btn', { hasText: name }).click()
}

test('стили: карусель из 8 без заметок, «Все стили» раскрывает полный список, выбор оттуда встаёт первым', async ({ page }) => {
  await ready(page)
  await step(page, 'Стиль')
  const carousel = page.locator('.kp-carousel .kp-style')
  await expect(carousel).toHaveCount(8)
  await expect(page.locator('.kp-carousel .kp-style__note')).toHaveCount(0)
  await expect(page.locator('.kp-style__new')).toHaveCount(0)
  // «marble» из адреса не в карусели → он первый и отмечен
  await expect(carousel.first()).toHaveAttribute('aria-checked', 'true')

  const all = page.locator('.kp-styles__all')
  await expect(all).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('#kp-styles-all')).toHaveCount(0)
  await all.click()
  await expect(all).toHaveAttribute('aria-expanded', 'true')
  const full = page.locator('#kp-styles-all .kp-style')
  expect(await full.count()).toBeGreaterThan(8)
  // полный список раскрыт — карусель спрятана: выбранный стиль отмечен ровно в одной группе (ревью 06)
  await expect(page.locator('.kp-carousel')).toHaveCount(0)
  await expect(page.locator('.kp-style[aria-checked="true"]')).toHaveCount(1)
  // выбираем стиль, которого нет среди 8 — «Прованс»
  await page.locator('#kp-styles-all .kp-style', { hasText: 'Прованс' }).click()
  await expect(page).toHaveURL(/s=provence/)
  await expect(page.locator('.kp-style[aria-checked="true"]')).toHaveCount(1)
  await expect(page.locator('.kp-style[aria-checked="true"]')).toContainText('Прованс')
  // свернули — карусель снова из 8, выбранный первым
  await all.click()
  await expect(all).toHaveAttribute('aria-expanded', 'false')
  await expect(carousel).toHaveCount(8)
  await expect(carousel.first()).toContainText('Прованс')
  await expect(carousel.first()).toHaveAttribute('aria-checked', 'true')
})

test('цвета: 16 сразу, «Точный код» раскрывает RAL и декоры с поиском; выбранный RAL — первым', async ({ page }) => {
  await ready(page)
  await step(page, 'Стиль')
  const grid = page.locator('.kp-parts .kp-part').first().locator('.kp-colors').first()
  // плитки материала: «как в стиле» + min(16, цветов материала) — ровно (ревью 06)
  const colorsOf = (mat: string) => FRONT_COLORS.filter((c) => c.material === mat).length
  const tiles = (mat: string) => Math.min(16, colorsOf(mat)) + 1
  expect(colorsOf('laminate')).toBeGreaterThan(colorsOf('veneer'))
  await expect(grid.locator('.kp-color')).toHaveCount(tiles('laminate'))
  await page.locator('.kp-parts .kp-part').first().locator('.kp-chip[role="tab"]', { hasText: 'Шпон' }).click()
  await expect(grid.locator('.kp-color')).toHaveCount(tiles('veneer'))
  await page.locator('.kp-parts .kp-part').first().locator('.kp-chip[role="tab"]', { hasText: 'Ламинат' }).click()
  await expect(grid.locator('.kp-color')).toHaveCount(tiles('laminate'))
  await expect(page.locator('#kp-exact')).toHaveCount(0)
  await expect(page.locator('.kp-ralgroups')).toHaveCount(0)
  const exact = page.locator('.kp-colors__exact')
  await exact.click()
  await expect(exact).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#kp-exact input[type="search"]')).toBeVisible()
  await expect(page.locator('#kp-exact .kp-ralgroups')).toBeVisible()
  // код RAL через форму — цвет применён и виден первой плиткой среди 16
  await page.locator('#kp-ral-code').fill('7016')
  await page.locator('.kp-ralcode__apply').click()
  await expect(page).toHaveURL(/fc=ral-7016/)
  const first = grid.locator('.kp-color').nth(1)
  await expect(first).toContainText('RAL 7016')
  await expect(first).toHaveAttribute('aria-checked', 'true')
  // точный цвет — первым и в счёт 16: «как в стиле» + точный + min(15, цветов материала)
  const tilesExact = Math.min(15, colorsOf('laminate')) + 2
  await expect(grid.locator('.kp-color')).toHaveCount(tilesExact)
  // декоры — вкладка внутри «Точного кода»; выбранный декор — тоже первым при закрытом блоке (ревью 06)
  await page.locator('#kp-exact [role="tab"]', { hasText: 'Декор' }).click()
  // группа декоров: первая плитка — «как в стиле» (сброс), берём первый настоящий декор
  const decor = page.locator('#kp-exact .kp-colors--codes[aria-label="Декоры ЛДСП"] .kp-color').nth(1)
  await expect(decor).toBeVisible()
  const decorName = (await decor.textContent())!
  await decor.click()
  await expect(page).toHaveURL(/fc=dec-/)
  // свернули — каталог на месте, выбор не потерян
  await exact.click()
  await expect(page.locator('#kp-exact')).toHaveCount(0)
  await expect(first).toHaveAttribute('aria-checked', 'true')
  // в 16 плитка подписана с брендом («Egger W1000 ST9 …»), в списке декоров бренд — вкладка
  await expect(first).toContainText(decorName)
  await expect(grid.locator('.kp-color')).toHaveCount(tilesExact)
})

test('ручки: 5 сразу и «Ещё N»; раскрытие не теряет выбор', async ({ page }) => {
  // «classic» — стиль с ручками (у «marble» ручек нет: gola)
  await ready(page, 'f=corner&a=300&b=240&s=classic')
  await step(page, 'Стиль')
  await page.locator('.kp-part__head', { hasText: 'Ручки' }).click()
  const handles = page.locator('.kp-handles .kp-handle')
  await expect(handles).toHaveCount(5)
  const more = page.locator('.kp-handles + .kp-more-btn')
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  await more.click()
  expect(await handles.count()).toBeGreaterThan(5)
  await handles.nth(8).click()
  const picked = await handles.nth(8).textContent()
  await more.click()
  await expect(handles).toHaveCount(5)
  await expect(handles.first()).toHaveAttribute('aria-checked', 'true')
  await expect(handles.first()).toHaveText(picked!)
})

test('«Итог»: одна кнопка WhatsApp, «Поделиться» и «PDF мастеру» отдельно, «Скопировать список» нет', async ({ page }) => {
  await ready(page)
  await step(page, 'Итог')
  await expect(page.locator('.kp a[href*="wa.me"]')).toHaveCount(1)
  await expect(page.locator('.kp-sum__wa')).toHaveText('Спросить в WhatsApp')
  await expect(page.locator('.kp-maker__actions .btn', { hasText: 'Поделиться' })).toHaveCount(1)
  await expect(page.locator('.kp-spec__actions .btn', { hasText: 'PDF мастеру' })).toHaveCount(1)
  await expect(page.locator('.kp button', { hasText: 'Скопировать список' })).toHaveCount(0)
  await expect(page.locator('.kp button', { hasText: 'Вернуть отделку' })).toHaveCount(0)
})

test('«Ещё»: вечер, цены, размеры, камеры, «?» — и никакой чёткости', async ({ page }) => {
  await ready(page)
  await page.locator('.kp-tools__more').click()
  const menu = page.locator('#kp-tools-extra')
  await expect(menu).toHaveClass(/is-open/)
  await expect(menu.locator('.kp-tools__evening')).toBeVisible()
  await expect(menu.locator('.kp-tools__prices')).toBeVisible()
  await expect(menu.locator('.kp-tools__dims')).toBeVisible()
  await expect(menu.locator('.kp-camera .kp-seg__btn')).toHaveCount(2)
  await expect(menu.locator('.kp-quality, [aria-label="Чёткость 3D"]')).toHaveCount(0)
  await expect(page.locator('.kp-help')).toHaveCount(0)
  await menu.locator('.kp-tools__help').click()
  await expect(page.locator('.kp-hint')).toBeVisible()
})

test('«Кухня»: готовые кухни выше форм, одна строка фильтров', async ({ page }) => {
  await ready(page)
  await expect(page.locator('.kp-ready__filter')).toHaveCount(1)
  const ready0 = (await page.locator('.kp-ready').boundingBox())!
  const shapes = (await page.locator('.kp-shapes').boundingBox())!
  expect(ready0.y).toBeLessThan(shapes.y)
})
