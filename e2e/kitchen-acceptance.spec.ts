import { expect, test, type Page } from '@playwright/test'
import { READY } from '../src/data/kitchen-ready'
import live from '../__tests__/fixtures/kitchen-live-appliances.json'

/**
 * Таск 07 — сквозная приёмка (спецификация, истории 30–36; reference.md — семь черт).
 * Идёт в двух профилях из `playwright.config.ts`: `iphone` (375 × 812, касания, WebKit —
 * ядро приложения для iPhone) и `desktop` (1440 × 900, Chrome). Швы — те же, что у
 * таска 03–06: разметка планировщика (`.kp-*`, `[data-key]`, `[data-add]`, `[data-scene]`)
 * и движок в dev-сборке (`window.__kp`: `placeOf`, `screenPointOf`, `lastDrag`, `getTier`).
 * Пальцы — синтетические PointerEvent (второй палец Playwright не умеет).
 *
 * Запуск: `PW_BASE_URL=http://localhost:3001 npx playwright test e2e/kitchen-acceptance.spec.ts`
 * (памятка — docs/KITCHEN_E2E_UZ.md).
 */
import { CORNER, centerOf, drag3d, dragPlan, fire, goStep, lastDrag, place, planKeys, pointOf, ready, rect, selected, showPlan, stacked, tap3d, tapPlan, type Place, type Pt } from './kp'

/** Порог среднего кадра при вращении на слабом телефоне (CPU ×4): 33 мс = 30 к/с (спецификация, история 22 / R06). */
const FRAME_MS = 33

const gone = (page: Page) => page.evaluate(() => window.__kp?.placeOf('sink'))

/* ───────── путь клиента: готовая кухня → техника → «Всё в корзину» → лист мастера ───────── */

test('путь клиента: готовая кухня → духовка → «Всё в корзину» → «Лист мастера»', async ({ page }) => {
  await page.goto('/ru/kitchen')
  await page.locator('.kp-views [data-scene="plan"]').waitFor({ state: 'attached', timeout: 60000 })
  // готовые кухни — первое, что видит покупатель на шаге «Кухня»
  const card = page.locator('.kp-ready__card').first()
  await card.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  expect(await page.locator('.kp-ready__card').count()).toBeGreaterThanOrEqual(READY.length)
  await card.click()
  await expect(page).toHaveURL(/[?&]f=/)
  await page.waitForFunction(() => Boolean(window.__kp?.placeOf('sink')), null, { timeout: 60000 })
  // техника: духовка из наличия (ov= из готовой кухни на локальном каталоге может отсутствовать)
  const phone = await stacked(page)
  if (phone) await page.locator('.kp-bar__next').click()
  else await goStep(page, 'Техника')
  await expect(page.locator('.kp-steps__btn[aria-current="step"]')).toHaveText('Техника')
  const head = page.locator('#kp-slot-oven .kp-slot__head')
  await head.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await head.click()
  // касание по названию модели (в строке ещё кнопка «Подробнее» — она не выбор; сама радиокнопка скрыта)
  const opt = page.locator('#kp-slot-oven .kp-opt .kp-opt__name').first()
  await opt.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await opt.click()
  await expect(page.locator('#kp-slot-oven .kp-opt input[type="radio"]').first()).toBeChecked()
  // адрес пишется с задержкой 400 мс — духовка должна попасть в него
  await page.waitForURL(/ov=cb-/)
  // «Итог»: сумма и лимонная «Всё в корзину» — в нижней панели на телефоне, в .kp-sum на компьютере
  if (phone) {
    await page.locator('.kp-bar__next').click()
    await page.locator('.kp-bar__next').click()
  } else await goStep(page, 'Итог')
  await expect(page.locator('.kp-steps__btn[aria-current="step"]')).toHaveText('Итог')
  const cta = page.locator(phone ? '.kp-bar__next' : '.kp-sum__cta')
  await expect(cta).toHaveText(/Всё в корзину/)
  await expect(cta).toBeEnabled()
  await cta.click()
  await expect(page.locator('.kp-sum__done')).toContainText(/Добавлено: \d+/)
  await expect(page.locator('.kp-sum__done a[href$="/cart"]')).toHaveText('Перейти в корзину')
  if (phone) await expect(page.locator('.kp-bar__count')).toHaveText(/^[1-9]\d*$/)
  // лист мастера — та же кухня по ссылке, отдельная страница
  const link = page.locator('.kp-spec--link a[href*="/kitchen/master"]')
  await link.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  // та же кухня: форма, стены и духовка в ссылке — как в адресе страницы
  const here = new URL(page.url()).searchParams
  const there = new URL((await link.getAttribute('href'))!, page.url()).searchParams
  for (const k of ['f', 'a', 'b', 'ov']) expect(there.get(k)).toBe(here.get(k))
  await link.click()
  await expect(page).toHaveURL(/\/ru\/kitchen\/master\?/)
  await expect(page.locator('.kp')).toHaveClass(/kp--master/)
  await expect(page.locator('.kp-walls')).toBeAttached({ timeout: 60000 })
  await expect(page.locator('.kp-steps')).toHaveCount(0)
  await expect(page.locator('.kp-bar')).toHaveCount(0)
})

/* ───────── семь черт эталона ───────── */

test('черта 1 — план сверху рядом с 3D: SVG со стенами и ячейками, тот же выбор', async ({ page }) => {
  await ready(page)
  if (await stacked(page)) {
    await expect(page.locator('.kp-plan')).toHaveCount(0)
    await expect(page.locator('.kp-views [role="radio"]')).toHaveCount(2)
  } else await expect(page.locator('.kp-stage')).toHaveClass(/has-col/)
  await showPlan(page)
  await expect(page.locator('.kp-plan .kp-plan__wall')).toHaveCount(2)
  await expect(page.locator('.kp-plan [data-key="sink"]')).toHaveCount(1)
  await expect(page.locator('.kp-plan [data-key="hob"][data-wall="B"]')).toHaveCount(1)
  // выбор в плане = выбор в 3D
  await tapPlan(page, '.kp-plan [data-key="sink"]')
  await expect(page.locator('.kp-plan .is-sel')).toHaveAttribute('data-key', 'sink')
  expect(await selected(page)).toBe('sink')
})

test('черта 2 — свободная постановка: пустое место живёт в адресе и на плане, после сдвига остаётся', async ({ page }) => {
  await ready(page, 'f=straight&a=300&o=s_03040g_080h_220')
  await showPlan(page)
  await expect(page.locator('.kp-plan [data-key="g1"][data-row="gap"]')).toHaveCount(1)
  await expect(page.locator('.kp-plan [data-add="g1"]')).toHaveCount(1)
  const before = (await place(page, 'sink'))!
  await tapPlan(page, '.kp-plan [data-key="sink"]')
  // мойка у угла (0…60) — уносим её на 120 см вправо: старое пустое место занято, а освобождённое у угла
  // становится новым пустым местом — свободная постановка, без автозаполнения (спецификация §1)
  const box = (await page.locator('.kp-plan [data-key="sink"]').boundingBox())!
  await dragPlan(page, '.kp-plan [data-key="sink"]', Math.round((box.width / before.w) * 120))
  const after = (await place(page, 'sink'))!
  // до 130: правее мойку не пускает столешница 30 см у варочной (HOB_SIDE)
  expect(after.center).toBeGreaterThanOrEqual(before.center + 90)
  expect(page.url()).toMatch(/o=[^&]*g_/)
  // два пустых места: освобождённое у угла (0…60) и остаток старого (60…100) — автозаполнение их не закрыло
  await expect(page.locator('.kp-plan [data-row="gap"][data-wall="A"]')).toHaveCount(2)
  expect(await page.locator('.kp-plan [data-row="gap"] rect').evaluateAll((els) => els.map((e) => Number(e.getAttribute('x'))))).toContain(0)
  // магнит (C2, 47): отпустили мойку 60 см так, что её левый край в 4 см от конца стены (середина 34), —
  // она прилипает к стене: середина 30 = w/2, а не 34
  const px = (await page.locator('.kp-plan [data-key="sink"]').boundingBox())!.width / after.w
  await dragPlan(page, '.kp-plan [data-key="sink"]', Math.round((after.w / 2 + 4 - after.center) * px))
  expect((await place(page, 'sink'))!).toMatchObject({ wall: 'A', center: after.w / 2 })
})

test('черта 3 — «+ из каталога»: меню на пустом месте ведёт в технику и ставит шкаф', async ({ page }) => {
  await ready(page, 'f=straight&a=300&o=s_03040g_080h_220')
  await showPlan(page)
  await tapPlan(page, '.kp-plan [data-add="g1"] circle')
  await expect(page.locator('.kp-add [role="menuitem"]')).toHaveCount(6)
  // «Технику» — открывается шаг «Техника» с первым пустым слотом
  await page.locator('.kp-add [data-add-kind="tech"]').click()
  await expect(page.locator('.kp-add')).toHaveCount(0)
  await expect(page.locator('.kp-steps__btn[aria-current="step"]')).toHaveText('Техника')
  await expect(page.locator('.kp-slot.is-open')).toHaveCount(1)
  // «Шкаф с дверцами» — свой шкаф k1 встаёт в пустое место
  await tapPlan(page, '.kp-plan [data-add="g1"] circle')
  await page.locator('.kp-add [data-add-kind="doors"]').click()
  await expect(page.locator('.kp-add')).toHaveCount(0)
  expect(await planKeys(page)).toContain('k1')
  expect(await planKeys(page)).not.toContain('g1')
  await expect(page.locator('.kp-plan .is-sel')).toHaveAttribute('data-key', 'k1')
})

test('черта 4 — шкаф идёт за пальцем: взяли у края, сдвиг равен пути пальца', async ({ page }) => {
  await ready(page)
  await tap3d(page, await pointOf(page, 'sink'))
  expect(await selected(page)).toBe('sink')
  const before = (await place(page, 'sink'))!
  await drag3d(page, await pointOf(page, 'sink', 25), await pointOf(page, 'sink', 65))
  const last = (await lastDrag(page))!
  expect(last.phase).toBe('end')
  const after = (await place(page, 'sink'))!
  expect(after.wall).toBe('A')
  expect(Math.abs(after.center - (before.center + 40))).toBeLessThanOrEqual(2)
  expect(Math.abs(after.center - (last.cm - last.grab))).toBeLessThanOrEqual(2)
})

test('черта 5 — одно правило жестов в 3D и на плане: тап выбирает, тянуть невыбранный — крутить/листать, второй палец отменяет', async ({ page }) => {
  await ready(page)
  expect(await selected(page)).toBeNull()
  const hob = (await place(page, 'hob'))!
  await drag3d(page, await pointOf(page, 'hob'), await pointOf(page, 'hob', 40))
  expect(await lastDrag(page)).toBeNull()
  expect(await place(page, 'hob')).toEqual(hob)
  await tap3d(page, await pointOf(page, 'sink'))
  expect(await selected(page)).toBe('sink')
  const sink = (await place(page, 'sink'))!
  await drag3d(page, await pointOf(page, 'sink', -20), await pointOf(page, 'sink', -60), { second: true })
  expect((await lastDrag(page))!.phase).toBe('cancel')
  expect(await place(page, 'sink')).toEqual(sink)
  // план: то же правило — невыбранный не тянется
  await showPlan(page)
  const url0 = page.url()
  await dragPlan(page, '.kp-plan [data-key="hob"]', 40)
  expect(page.url()).toBe(url0)
  expect(await place(page, 'hob')).toEqual(hob)
})

test('черта 6 — телефон: 3D на полэкрана, липкая нижняя панель; компьютер: без панели', async ({ page }) => {
  await ready(page)
  const h = await page.evaluate(() => window.innerHeight)
  if (!(await stacked(page))) {
    await expect(page.locator('.kp-head')).toBeVisible()
    await expect(page.locator('.kp-bar')).toHaveCount(0)
    return
  }
  expect((await rect(page, '.kp-head'))!.height).toBe(0)
  expect((await rect(page, '.kp-scene'))!.height).toBeGreaterThanOrEqual(h * 0.5 - 1)
  const bar = (await rect(page, '.kp-bar'))!
  expect(bar.height).toBe(60)
  expect(Math.round(bar.bottom)).toBe(h)
  await page.evaluate(() => window.scrollTo(0, 1200))
  await page.waitForTimeout(400)
  expect(Math.round((await rect(page, '.kp-bar'))!.bottom)).toBe(h)
  await expect(page.locator('.kp-bar .btn--primary')).toHaveText(/Дальше/)
})

test('черта 7 — клиент и мастер раздельно: у покупателя чертежей нет, у мастера — нет шагов и корзины', async ({ page }) => {
  const q = 'f=corner&a=300&b=240&s=marble'
  await ready(page, q)
  await expect(page.locator('.kp-walls')).toHaveCount(0)
  await expect(page.locator('.kp-cutmap')).toHaveCount(0)
  await expect(page.locator('.kp-steps')).toHaveCount(1)
  await page.goto(`/ru/kitchen/master?${q}`)
  await expect(page.locator('.kp')).toHaveClass(/kp--master/)
  await expect(page.locator('.kp-walls')).toBeAttached({ timeout: 60000 })
  await expect(page.locator('.kp-spec:not(.kp-spec--link)')).toHaveCount(1)
  await expect(page.locator('.kp-steps')).toHaveCount(0)
  await expect(page.locator('.kp-bar')).toHaveCount(0)
  await expect(page.locator('.kp-sum__cta')).toHaveCount(0)
  await expect(page.locator('.kp-ready')).toHaveCount(0)
})

/* ───────── старые адреса и готовые кухни: та же раскладка ───────── */

/** Старые адреса — из `__tests__/kitchen-layout-snapshot.test.ts` (OLD_LINKS) */
const OLD_LINKS = [
  'f=straight&a=400&o=s_095d60ok1',
  'f=straight&a=400&o=60ok_120s-1325dh',
  'f=corner&a=300&b=240&o=sd.hv&pn=1',
  'f=u&a=360&b=240&c=240&o=s_150d.h_120v.wtpf&wd=s80h90',
  'f=island&a=320&i=180&o=fts.h_090d',
]

/** План сверху как текст: стена · ряд · ключ · x · y · ширина · глубина (см, до 0,1) */
const planText = (page: Page) =>
  page.locator('.kp-plan g[data-wall][data-row]').evaluateAll((els) =>
    els
      .map((g) => {
        const r = g.querySelector('rect')!
        const n = (a: string) => (Math.round(Number(r.getAttribute(a)) * 10) / 10).toFixed(1)
        return [g.getAttribute('data-wall'), g.getAttribute('data-row'), g.getAttribute('data-key') ?? '-', n('x'), n('y'), n('width'), n('height')].join(' ')
      })
      .join('\n'),
  )

/** 12 готовых кухонь и 5 старых адресов — по тесту на кухню (C2, 49): упавшая называет себя, остальные идут дальше */
const LINKS = [...READY.map((k) => ({ id: `ready-${k.id}`, q: k.q })), ...OLD_LINKS.map((q, i) => ({ id: `old-${i + 1}`, q }))]
for (const { id, q } of LINKS) {
  test(`раскладка как в снимке: ${id}`, async ({ page }) => {
    test.setTimeout(90000)
    await ready(page, q)
    await showPlan(page)
    // мойка и варочная — всегда на месте; ячейки плана — как в снимке (общем для телефона и компьютера)
    expect(await place(page, 'sink')).not.toBeNull()
    expect(await place(page, 'hob')).not.toBeNull()
    const text = await planText(page)
    expect(text.split('\n').length).toBeGreaterThan(3)
    expect(text).toMatchSnapshot(`${id}.txt`)
  })
}

/* ───────── техника за три касания (по фикстуре живого каталога — там духовки есть) ───────── */

test('выбрать духовку — не больше трёх касаний', async ({ page }) => {
  // на живом сайте духовки в наличии (фикстура); в локальном каталоге тоже есть хотя бы одна
  expect((live.appliances as { slot: string }[]).filter((a) => a.slot === 'oven').length).toBeGreaterThan(0)
  await ready(page, 'f=corner&a=300&b=240&ov=-')
  let taps = 0
  const tap = async (sel: string) => {
    const loc = page.locator(sel)
    await loc.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await loc.click()
    taps++
  }
  await tap('.kp-steps__btn:has-text("Техника")')
  await tap('#kp-slot-oven .kp-slot__head')
  await tap('#kp-slot-oven .kp-opt .kp-opt__name')
  await expect(page.locator('#kp-slot-oven .kp-opt input[type="radio"]').first()).toBeChecked()
  await expect(page).toHaveURL(/ov=(?!-)/)
  expect(taps).toBeLessThanOrEqual(3)
})

/* ───────── компьютер 1440 × 900 ───────── */

test('компьютер: план + 3D рядом, панель ≥ 440 px, низ сцены ничем не перекрыт', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'только профиль компьютера')
  await ready(page)
  await expect(page.locator('.kp-stage')).toHaveClass(/has-col/)
  const plan = (await rect(page, '.kp-plan'))!
  const scene = (await rect(page, '.kp-scene'))!
  expect(plan.right).toBeLessThanOrEqual(scene.left + 1)
  expect(plan.top).toBeLessThan(scene.bottom)
  expect((await rect(page, '.kp-panel'))!.width).toBeGreaterThanOrEqual(440)
  await expect(page.locator('.kp-bar')).toHaveCount(0)
  // сцена на компьютере листается со страницей: ставим её низ в кадр и смотрим, что в трёх точках
  // у нижнего края — сама сцена, а не плашка, консультант или панель
  const covered = await page.evaluate(async () => {
    const st = document.querySelector('.kp-stage')!.getBoundingClientRect()
    window.scrollTo(0, Math.max(0, window.scrollY + st.bottom - window.innerHeight + 8))
    await new Promise((r) => setTimeout(r, 400))
    const s = document.querySelector('.kp-scene')!.getBoundingClientRect()
    if (s.bottom > window.innerHeight) return ['сцена ниже экрана: ' + Math.round(s.bottom - window.innerHeight) + ' px']
    return [0.1, 0.5, 0.9]
      .map((k) => document.elementFromPoint(s.left + s.width * k, s.bottom - 4))
      .map((el) => (el?.closest('.kp-stage') ? '' : (el?.className?.toString() ?? el?.tagName ?? '?')))
      .filter(Boolean)
  })
  expect(covered).toEqual([])
})

test('компьютер: ценник техники висит над своей техникой на холсте, а не над колонкой плана (слепая приёмка)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'только профиль компьютера')
  await ready(page)
  await expect(page.locator('.kp-stage')).toHaveClass(/has-col/)
  // духовка из наличия — у неё ценник
  await goStep(page, 'Техника')
  const head = page.locator('#kp-slot-oven .kp-slot__head')
  await head.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await head.click()
  const opt = page.locator('#kp-slot-oven .kp-opt .kp-opt__name').first()
  await opt.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await opt.click()
  await expect(page.locator('#kp-slot-oven .kp-opt input[type="radio"]').first()).toBeChecked()
  const tag = page.locator('.kp-tag[data-slot="oven"] .kp-tag__in')
  await expect(tag).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(600)
  const box = (await tag.boundingBox())!
  const scene = (await rect(page, '.kp-scene'))!
  // ценник — в прямоугольнике холста (с колонкой плана он уезжал влево на её ширину)
  expect(box.x).toBeGreaterThanOrEqual(scene.left - 1)
  expect(box.x + box.width).toBeLessThanOrEqual(scene.right + 1)
  // и над своей техникой: по горизонтали совпадает с точкой духовки на экране
  // (духовка под варочной своего ключа в сцене не имеет — тогда точки нет, и сверяем только холст)
  const p = await page.evaluate(() => window.__kp!.screenPointOf('oven'))
  if (p) expect(Math.abs(box.x + box.width / 2 - p.x)).toBeLessThan(60)
})

/* ───────── скорость: кадр при вращении, слабый телефон (CPU ×4) ───────── */

/** Порог p95 кадра: 50 мс — редкие кадры не дольше трёх обычных при 60 Гц (C2, 48). */
const FRAME_P95_MS = 50

test.describe('скорость на слабом телефоне', () => {
  test.use({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  })
  // phone — класс, который телефон-эмулятор получает сам; phone-low — принудительно (dev-параметр `kp-tier`)
  for (const tier of ['phone', 'phone-low'] as const) {
    test(`кадр при вращении с CPU ×4, класс ${tier}: среднее ≤ ${FRAME_MS} мс, p95 ≤ ${FRAME_P95_MS} мс`, async ({ page, browserName }, info) => {
      test.skip(browserName !== 'chromium', 'замедление процессора — только через CDP в Chrome')
      test.setTimeout(90000)
      await ready(page, tier === 'phone' ? CORNER : `${CORNER}&kp-tier=${tier}`)
      expect(await page.evaluate(() => window.__kp!.getTier().name)).toBe(tier)
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      try {
        const m = await page.evaluate(async (ms) => {
          const c = window.__kp!.renderer.domElement
          const r = c.getBoundingClientRect()
          const p = { x: r.left + r.width * 0.5, y: r.top + r.height * 0.45 }
          const ev = (type: string, x: number, y: number) =>
            c.dispatchEvent(
              new PointerEvent(type, {
                bubbles: true,
                cancelable: true,
                pointerId: 1,
                pointerType: 'touch',
                isPrimary: true,
                button: type === 'pointermove' ? -1 : 0,
                buttons: type === 'pointerup' ? 0 : 1,
                clientX: x,
                clientY: y,
              }),
            )
          const sink0 = window.__kp!.screenPointOf('sink')!
          // кадр = вызов draw() движка: меряем интервалы между соседними кадрами, пока палец крутит кухню
          const eng = window.__kp as unknown as { draw: () => void }
          const draw0 = eng.draw
          const times: number[] = []
          let lastDraw = 0
          eng.draw = function () {
            const now = performance.now()
            if (lastDraw) times.push(now - lastDraw)
            lastDraw = now
            return draw0.call(this)
          }
          ev('pointerdown', p.x, p.y)
          const t0 = performance.now()
          let i = 0
          await new Promise<void>((res) => {
            const step = (now: number) => {
              i++
              ev('pointermove', p.x + Math.sin(i / 25) * 140, p.y + Math.cos(i / 40) * 30)
              if (now - t0 < ms) requestAnimationFrame(step)
              else res()
            }
            requestAnimationFrame(step)
          })
          ev('pointerup', p.x, p.y)
          eng.draw = draw0
          const sink1 = window.__kp!.screenPointOf('sink')!
          const mean = times.reduce((a, b) => a + b, 0) / times.length
          const sorted = [...times].sort((a, b) => a - b)
          return {
            mean,
            p95: sorted[Math.floor(sorted.length * 0.95)],
            frames: times.length,
            tier: window.__kp!.getTier().name,
            turned: Math.hypot(sink1.x - sink0.x, sink1.y - sink0.y),
          }
        }, 3000)
        info.annotations.push({
          type: 'frame',
          description: `среднее ${m.mean.toFixed(1)} мс, p95 ${m.p95.toFixed(1)} мс, кадров ${m.frames}, класс ${m.tier}`,
        })
        console.log(`кадр при вращении (CPU ×4, ${m.tier}): среднее ${m.mean.toFixed(1)} мс, p95 ${m.p95.toFixed(1)} мс, кадров ${m.frames}`)
        // кухня действительно вращалась
        expect(m.turned).toBeGreaterThan(5)
        expect(m.frames).toBeGreaterThan(30)
        expect(m.mean).toBeLessThanOrEqual(FRAME_MS)
        expect(m.p95).toBeLessThanOrEqual(FRAME_P95_MS)
      } finally {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
      }
    })
  }
})
