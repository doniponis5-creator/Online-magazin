/**
 * Предупреждение «не поместилось» (`Dropped` в `KitchenPlanner.tsx`) рендерится только
 * когда ему есть что сказать: выпавшее пустое место (`gN`) — не повод для рамки (P2).
 */
import { describe, expect, it } from 'vitest'
import { droppedNotice } from '@/lib/kitchen/checks'

describe('droppedNotice — есть ли что сказать покупателю', () => {
  it('выпало только пустое место — предупреждения нет', () => {
    expect(droppedNotice({ dropped: [{ item: 'g0', need: 40, wall: 'A' }], ovenMovedUnderHob: false })).toBe(false)
  })
  it('ничего не выпало — предупреждения нет', () => {
    expect(droppedNotice({ dropped: [], ovenMovedUnderHob: false })).toBe(false)
  })
  it('выпала техника или шкаф — есть', () => {
    expect(droppedNotice({ dropped: [{ item: 'dishwasher', slot: 'dishwasher', need: 60, wall: 'A' }], ovenMovedUnderHob: false })).toBe(true)
  })
  it('вытяжку не повесить — есть', () => {
    expect(droppedNotice({ dropped: [{ item: 'hob', slot: 'hood', need: 60, wall: 'A' }], ovenMovedUnderHob: false })).toBe(true)
  })
  it('духовка переехала под варочную — есть', () => {
    expect(droppedNotice({ dropped: [{ item: 'g1', need: 20, wall: 'B' }], ovenMovedUnderHob: true })).toBe(true)
  })
})
