import { describe, expect, it } from 'vitest'
import { governStep, newGovernor, type GovernorState } from '@/components/kitchen/three/governor'

/*
  Губернатор кадров: чистая функция, которую движок 3D зовёт на каждом кадре
  в движении. Здесь проверяем поведение с известными числами из спецификации,
  а не внутренности: кадр 60 Гц (16,7 мс) не роняет чёткость, один рывок (даже длиннее капа) —
  тоже, десять медленных кадров роняют на 0,25, тридцать быстрых возвращают.
*/

/** прогнать n кадров одной длительности */
function frames(s: GovernorState, dt: number, n: number): GovernorState {
  for (let i = 0; i < n; i++) s = governStep(s, dt)
  return s
}

describe('губернатор кадров', () => {
  it('60 Гц (16,7 мс × 100) чёткость не роняет', () => {
    const s = frames(newGovernor(1), 16.7, 100)
    expect(s.ratio).toBe(1)
  })

  it('один рывок 400 мс среди 16-мс кадров не роняет', () => {
    // 400 мс — заведомо больше GOVERNOR_CAP_MS (80): без обрезки замера среднее
    // из 10 кадров было бы (9 × 16 + 400) / 10 = 54,4 мс > 30 — и тест покраснел бы.
    // С обрезкой: (9 × 16 + 80) / 10 = 22,4 мс — чёткость на месте.
    let s = frames(newGovernor(1), 16, 5)
    s = governStep(s, 400)
    s = frames(s, 16, 20)
    expect(s.ratio).toBe(1)
  })

  it('10 × 31 мс роняет на 0,25, дальше — до минимума 0,6', () => {
    let s = frames(newGovernor(1), 31, 10)
    expect(s.ratio).toBe(0.75)
    s = frames(s, 31, 10)
    expect(s.ratio).toBe(0.6)
    s = frames(s, 31, 10)
    expect(s.ratio).toBe(0.6)
  })

  it('после падения 30 × 16 мс возвращает +0,25 до базового, но не выше', () => {
    let s = frames(newGovernor(1.5), 31, 20)
    expect(s.ratio).toBe(1)
    s = frames(s, 16, 30)
    expect(s.ratio).toBe(1.25)
    s = frames(s, 16, 30)
    expect(s.ratio).toBe(1.5)
    s = frames(s, 16, 30)
    expect(s.ratio).toBe(1.5)
  })
})
