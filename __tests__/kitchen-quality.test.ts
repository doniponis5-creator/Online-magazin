import { afterEach, describe, expect, it } from 'vitest'
import { msaaSamples, msaaFallback, governIdle, governStep, governorPlan, newGovernor, pickTier, type DeviceEnv, type GovernorState } from '@/components/kitchen/three/quality'

/*
  Класс устройства и регулятор кадров (quality.ts) — чистые функции, шов
  «quality» из спецификации (§7). Числа — из спецификации: телефон в движении
  min(dpr, 1,5), в покое min(dpr, 3) в бюджете 4 Мп; регулятор снижает тени
  (2048 → 1024 → выкл), потом текстуры, потом резкость не ниже 0,85 при dpr ≥ 2;
  восстановление — по времени (3 с), а не по 30 быстрым кадрам подряд.
*/

const iphone: DeviceEnv = { coarse: true, fine: false, memory: undefined, cores: 4, gpu: 'Apple GPU', dpr: 3 }
const cheapAndroid: DeviceEnv = { coarse: true, fine: false, memory: 3, cores: 8, gpu: 'Mali-G52', dpr: 2 }
const macbook: DeviceEnv = { coarse: false, fine: true, memory: undefined, cores: 8, gpu: 'Apple M1', dpr: 2 }
const intelLaptop: DeviceEnv = { coarse: false, fine: true, memory: 8, cores: 4, gpu: 'ANGLE (Intel(R) UHD Graphics 620)', dpr: 1 }

describe('класс устройства', () => {
  it('четыре класса по указателю, памяти, ядрам и видеокарте', () => {
    expect(pickTier(iphone).name).toBe('phone')
    expect(pickTier(cheapAndroid).name).toBe('phone-low')
    expect(pickTier(macbook).name).toBe('desktop')
    expect(pickTier(intelLaptop).name).toBe('desktop-weak')
  })

  it('iPhone не «простой»: Safari врёт про 4 ядра и не называет память', () => {
    expect(pickTier({ ...iphone, cores: 2 }).name).toBe('phone')
    // а Android с 4 ядрами — простой
    expect(pickTier({ ...cheapAndroid, memory: 6, gpu: 'Adreno (TM) 640', cores: 4 }).name).toBe('phone-low')
  })

  it('телефон: стандартные материалы, K = 1, настоящее сглаживание (MSAA, не FXAA), тени 2048; простой — FXAA и 1024', () => {
    const t = pickTier(iphone)
    expect(t.physical).toBe(false)
    expect(t.detail).toBe(1)
    // FXAA при ratio = dpr рвёт швы дверец в пунктир (P4, п. 8): у phone — MSAA
    expect(t.msaa).toBe(true)
    expect(t.fxaa).toBe(false)
    const low = pickTier(cheapAndroid)
    expect(low.msaa).toBe(false)
    expect(low.fxaa).toBe(true)
    // в покое кадр = точки экрана (ratio = холст): сэмплы нужны и при ratio 2–3; память — по числу точек
    expect(msaaSamples(t, 3, 3, 375, 406)).toBe(4)
    expect(msaaSamples(t, 2, 2, 390, 420)).toBe(4)
    expect(msaaSamples(t, 3, 3, 375, 812)).toBe(2)
    expect(msaaSamples(t, 1.5, 3, 375, 406)).toBe(4)
    expect(msaaSamples(low, 2, 2, 375, 406)).toBe(0)
    // компьютер как было: двойная чёткость сама сглаживает
    const pc = pickTier(macbook)
    expect(msaaSamples(pc, 2, 2, 1200, 700)).toBe(0)
    expect(msaaSamples(pc, 1, 1, 1200, 700)).toBe(4)
  })

  it('MSAA без поддержки половинной точности или с ошибкой GL — 0 сэмплов и FXAA, как у phone-low', () => {
    const t = pickTier(iphone)
    const none = msaaFallback(t, { halfFloat: false, glError: false })
    expect(none.msaa).toBe(false)
    expect(none.fxaa).toBe(true)
    expect(msaaSamples(none, 3, 3, 375, 406)).toBe(0)
    const broken = msaaFallback(t, { halfFloat: true, glError: true })
    expect(msaaSamples(broken, 3, 3, 375, 406)).toBe(0)
    expect(broken.fxaa).toBe(true)
    // всё есть — класс тот же
    expect(msaaFallback(t, { halfFloat: true, glError: false })).toBe(t)
    // phone-low и так без MSAA — не трогаем
    const low = pickTier(cheapAndroid)
    expect(msaaFallback(low, { halfFloat: false, glError: false })).toBe(low)
    expect(t.shadow).toBe(2048)
    expect(pickTier(cheapAndroid).shadow).toBe(1024)
    const d = pickTier(macbook)
    expect(d.physical).toBe(true)
    expect(d.detail).toBe(2)
    expect(d.shadow).toBe(4096)
  })

  it('телефон: движение min(dpr, 1,5), покой min(dpr, 3) в бюджете 4 Мп', () => {
    const t = pickTier(iphone)
    expect(t.moveRatio(3)).toBe(1.5)
    expect(t.moveRatio(1)).toBe(1)
    // 390 × 300 css × 3 = 1,05 Мп — в бюджет входит целиком
    expect(t.restRatio(3, 390, 300)).toBe(3)
    // бюджет по существу (концерн 10): точек в покое ≤ 4 Мп и не больше 3 на css-точку —
    // на любом экране телефона стоя и боком; экран больше бюджета — ratio < 3 и бюджет выбран (≥ 99 %)
    for (const [w, h] of [[375, 812], [390, 844], [430, 932], [812, 375], [800, 600], [1024, 1366], [2000, 1200]]) {
      const r = t.restRatio(3, w, h)
      expect(r * r * w * h, `${w}×${h}`).toBeLessThanOrEqual(4e6 * (1 + 1e-9))
      expect(r, `${w}×${h}`).toBeLessThanOrEqual(3)
      if (9 * w * h > 4e6) {
        expect(r, `${w}×${h}`).toBeLessThan(3)
        if (r > 1) expect(r * r * w * h, `${w}×${h}`).toBeGreaterThanOrEqual(0.99 * 4e6)
      }
    }
  })

  it('класс «фото»: полные материалы и тени 2048 — для снимка 4K на телефоне', () => {
    const p = pickTier(iphone, 'photo')
    expect(p.name).toBe('photo')
    expect(p.physical).toBe(true)
    expect(p.shadow).toBe(2048)
    expect(p.detail).toBe(2)
  })
})

describe('класс устройства: хранилище', () => {
  const g = globalThis as { localStorage?: unknown; window?: unknown; navigator?: unknown }
  // navigator в node — геттер без сеттера: подменяем через defineProperty
  const navDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const saved = { ls: g.localStorage, win: g.window }
  afterEach(() => {
    g.localStorage = saved.ls
    g.window = saved.win
    if (navDesc) Object.defineProperty(globalThis, 'navigator', navDesc)
    else delete g.navigator
  })

  it('pickTier() без параметров читает устройство и не трогает localStorage', () => {
    let touched = 0
    g.localStorage = new Proxy({}, { get: () => (touched++, () => null), set: () => (touched++, true) })
    g.window = {
      matchMedia: (q: string) => ({ matches: q.includes('coarse') }),
      devicePixelRatio: 3,
      localStorage: g.localStorage,
    }
    Object.defineProperty(globalThis, 'navigator', { value: { hardwareConcurrency: 6, deviceMemory: undefined }, configurable: true, writable: true })
    expect(pickTier().name).toBe('phone')
    expect(touched).toBe(0)
  })
})

/** прогнать n кадров одной длительности, часы идут на dt */
function frames(s: GovernorState, dt: number, n: number, from = 1000): { s: GovernorState; now: number } {
  let now = from
  for (let i = 0; i < n; i++) {
    now += dt
    s = governStep(s, dt, now)
  }
  return { s, now }
}

describe('регулятор кадров', () => {
  const phone = pickTier(iphone)

  it('60 Гц (16,7 мс × 100) ничего не снижает', () => {
    expect(frames(newGovernor(), 16.7, 100).s.level).toBe(0)
  })

  it('один рывок 400 мс среди 16-мс кадров не снижает', () => {
    let { s, now } = frames(newGovernor(), 16, 5)
    s = governStep(s, 400, now + 400)
    expect(frames(s, 16, 20, now + 400).s.level).toBe(0)
  })

  it('10 × 31 мс — шаг вниз: сначала тени 2048 → 1024 → выкл, потом текстуры, потом резкость', () => {
    let { s, now } = frames(newGovernor(), 31, 10)
    expect(governorPlan(s.level, phone, 3)).toEqual({ shadow: 1024, detail: 1, ratio: 1.5 })
    ;({ s, now } = frames(s, 31, 10, now))
    expect(governorPlan(s.level, phone, 3)).toEqual({ shadow: 0, detail: 1, ratio: 1.5 })
    ;({ s, now } = frames(s, 31, 10, now))
    expect(governorPlan(s.level, phone, 3)).toEqual({ shadow: 0, detail: 0.5, ratio: 1.5 })
    ;({ s, now } = frames(s, 31, 10, now))
    expect(governorPlan(s.level, phone, 3).ratio).toBeLessThan(1.5)
    expect(governorPlan(s.level, phone, 3).ratio).toBeGreaterThanOrEqual(0.85)
    // дальше вниз резкость не падает ниже 0,85 при dpr ≥ 2
    ;({ s } = frames(s, 31, 40, now))
    expect(governorPlan(s.level, phone, 3).ratio).toBe(0.85)
    expect(governorPlan(s.level, phone, 2).ratio).toBe(0.85)
  })

  it('восстановление по времени: 3 с без медленных кадров — шаг вверх, ещё 3 с — ещё шаг', () => {
    let { s, now } = frames(newGovernor(), 31, 20)
    expect(s.level).toBe(2)
    // 2,5 с быстрых кадров — ещё рано
    ;({ s, now } = frames(s, 16, 156, now))
    expect(s.level).toBe(2)
    // перевалили за 3 с
    ;({ s, now } = frames(s, 16, 40, now))
    expect(s.level).toBe(1)
    ;({ s, now } = frames(s, 16, 190, now))
    expect(s.level).toBe(0)
  })

  it('медленный кадр откладывает восстановление, а покой (governIdle) восстанавливает по часам', () => {
    let { s, now } = frames(newGovernor(), 31, 10)
    expect(s.level).toBe(1)
    ;({ s, now } = frames(s, 16, 150, now))
    s = governStep(s, 40, now + 40)
    now += 40
    // 1,6 с после рывка — ещё уровень 1 (без рывка было бы уже 3,4 с и уровень 0)
    ;({ s, now } = frames(s, 16, 100, now))
    expect(s.level).toBe(1)
    // остановились: через 3 с после рывка уровень возвращается сам
    expect(governIdle(s, now + 1000).level).toBe(1)
    expect(governIdle(s, now + 1500).level).toBe(0)
  })
})
