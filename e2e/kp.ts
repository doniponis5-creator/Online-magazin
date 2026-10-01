/**
 * Общее для e2e конструктора (`kitchen-*.spec.ts`), одно на все спеки (C1, 50):
 *
 * 1. Движок в dev-сборке: `KitchenPlanner.tsx` кладёт `KitchenEngine` в `window.__kp`
 *    (только `NODE_ENV !== 'production'`). Здесь — та часть его API, которой пользуются e2e;
 *    объявление одно — два `declare global` с разными типами tsc не принимает.
 * 2. Помощники: `ready`, синтетический палец `fire` на холсте 3D (`sel = null`) или на элементе
 *    плана, `tap3d`/`drag3d`, `tapPlan`/`dragPlan`, `centerOf`, `rect`, `goStep`, `showPlan`.
 *    Ожидания и паузы — как в `kitchen-acceptance` (телефон и компьютер ими проходят).
 */
import { expect, type Page } from '@playwright/test'

export type Pt = { x: number; y: number }
export type Place = { wall: string; center: number; w: number; row: string }
export type Kp = {
  placeOf: (key: string) => Place | null
  screenPointOf: (key: string, dx?: number) => Pt | null
  screenPointOnWall: (wall: string, cm: number) => Pt | null
  selectedKey: () => string | null
  lastDrag: { phase: string; key: string; wall: string; cm: number; grab: number } | null
  getTier: () => { name: string }
  /** углы кухни на экране (как у кадра при загрузке) — для проверки «кухня в кадре» */
  screenCorners: () => Pt[]
  /** камера: расстояние до точки вращения, то же у исходного кадра, на исходном ли кадре */
  cameraInfo: () => { dist: number; homeDist: number; home: boolean }
  renderer: { domElement: HTMLElement }
}
declare global {
  interface Window {
    __kp?: Kp
  }
}

/** Угловая кухня 300 × 240 в стиле по умолчанию — кухня большинства проверок */
export const CORNER = 'f=corner&a=300&b=240'
/** Та же кухня в стиле «мрамор» (без ручек — gola): проверки телефона и упрощения */
export const MARBLE = `${CORNER}&s=marble`

/**
 * Открыть конструктор и дождаться: `page` — только разметки (переключатель видов),
 * `built` — ещё и ценников `.kp-tags` (движок собрал кухню), `engine` — мойка в сцене
 * и её точка на экране, плюс 1,5 с на подъезд камеры (перед жестами в 3D).
 */
export const ready = async (page: Page, query = CORNER, wait: 'engine' | 'built' | 'page' = 'engine') => {
  await page.goto(`/ru/kitchen?${query}`)
  await page.locator('.kp-views [data-scene="plan"]').waitFor({ state: 'attached', timeout: 60000 })
  if (wait === 'built') await page.locator('.kp-tags').waitFor({ state: 'attached', timeout: 60000 })
  if (wait === 'engine') {
    await page.waitForFunction(() => Boolean(window.__kp?.placeOf('sink') && window.__kp.screenPointOf('sink')), null, { timeout: 60000 })
    // камера ещё может подъезжать к кухне
    await page.waitForTimeout(1500)
  }
}
/** телефон стоя — есть липкая нижняя панель (STACKED); компьютер — нет */
export const stacked = async (page: Page) => (await page.locator('.kp-bar').count()) > 0
/** план на экране: на компьютере — колонкой всегда, на телефоне — по переключателю «План» */
export const showPlan = async (page: Page) => {
  if ((await page.locator('.kp-plan svg').count()) === 0) await page.locator('.kp-views [data-scene="plan"]').click()
  await expect(page.locator('.kp-plan svg')).toBeVisible()
}
export const goStep = async (page: Page, name: string) => {
  const btn = page.locator('.kp-steps__btn', { hasText: name })
  await btn.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await btn.click()
  await expect(page.locator('.kp-steps__btn[aria-current="step"]')).toHaveText(name)
}
export const rect = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const b = document.querySelector(s)?.getBoundingClientRect()
    return b ? { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height } : null
  }, sel)

export const place = (page: Page, key: string) => page.evaluate((k) => window.__kp!.placeOf(k), key)
export const pointOf = async (page: Page, key: string, dx = 0): Promise<Pt> => (await page.evaluate(([k, d]) => window.__kp!.screenPointOf(k, d), [key, dx] as const))!
export const wallPoint = async (page: Page, wall: string, cm: number): Promise<Pt> => (await page.evaluate(([w, c]) => window.__kp!.screenPointOnWall(w, c), [wall, cm] as const))!
export const selected = (page: Page) => page.evaluate(() => window.__kp!.selectedKey())
export const lastDrag = (page: Page) => page.evaluate(() => window.__kp!.lastDrag)
export const planKeys = (page: Page) => page.locator('.kp-plan [data-key]').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))

/** синтетический палец на холсте 3D (sel = null) или на элементе плана */
export const fire = (page: Page, sel: string | null, type: string, p: Pt, id = 1, primary = true) =>
  page.evaluate(
    ([sel, type, p, id, primary]) => {
      const el = sel ? document.querySelector(sel)! : window.__kp!.renderer.domElement
      el.dispatchEvent(
        new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: primary, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1, clientX: p.x, clientY: p.y }),
      )
    },
    [sel, type, p, id, primary] as const,
  )
export const tap3d = async (page: Page, p: Pt) => {
  await fire(page, null, 'pointerdown', p)
  await page.waitForTimeout(40)
  await fire(page, null, 'pointerup', p)
  await page.waitForTimeout(500)
}
/** Палец от p0 к p1 за восемь шагов; second — на полпути ложится второй палец (щипок). */
export const drag3d = async (page: Page, p0: Pt, p1: Pt, opts: { second?: boolean } = {}) => {
  await fire(page, null, 'pointerdown', p0)
  const steps = opts.second ? 5 : 8
  for (let i = 1; i <= steps; i++) {
    await page.waitForTimeout(25)
    await fire(page, null, 'pointermove', { x: p0.x + ((p1.x - p0.x) * i) / 8, y: p0.y + ((p1.y - p0.y) * i) / 8 })
  }
  if (opts.second) {
    const q = { x: p1.x + 80, y: p1.y - 40 }
    await fire(page, null, 'pointerdown', q, 2, false)
    await page.waitForTimeout(30)
    await fire(page, null, 'pointerup', q, 2, false)
  }
  await fire(page, null, 'pointerup', p1)
  await page.waitForTimeout(900)
}
export const centerOf = async (page: Page, sel: string): Promise<Pt> => {
  const b = (await page.locator(sel).boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
export const tapPlan = async (page: Page, sel: string) => {
  const p = await centerOf(page, sel)
  await fire(page, sel, 'pointerdown', p)
  await page.waitForTimeout(40)
  await fire(page, '.kp-plan svg', 'pointerup', p)
  await page.waitForTimeout(400)
}
export const dragPlan = async (page: Page, sel: string, dx: number) => {
  const p = await centerOf(page, sel)
  await fire(page, sel, 'pointerdown', p)
  for (let i = 1; i <= 8; i++) {
    await page.waitForTimeout(25)
    await fire(page, '.kp-plan svg', 'pointermove', { x: p.x + (dx * i) / 8, y: p.y })
  }
  await fire(page, '.kp-plan svg', 'pointerup', { x: p.x + dx, y: p.y })
  await page.waitForTimeout(800)
}
