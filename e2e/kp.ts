/**
 * Движок конструктора в dev-сборке: `KitchenPlanner.tsx` кладёт `KitchenEngine` в `window.__kp`
 * (только `NODE_ENV !== 'production'`). Здесь — та часть его API, которой пользуются e2e
 * (`kitchen-gestures`, `kitchen-plan`, `kitchen-acceptance`); объявление одно на все спеки —
 * два `declare global` с разными типами tsc не принимает.
 */
export type Pt = { x: number; y: number }
export type Place = { wall: string; center: number; w: number; row: string }
export type Kp = {
  placeOf: (key: string) => Place | null
  screenPointOf: (key: string, dx?: number) => Pt | null
  screenPointOnWall: (wall: string, cm: number) => Pt | null
  selectedKey: () => string | null
  lastDrag: { phase: string; key: string; wall: string; cm: number; grab: number } | null
  getTier: () => { name: string }
  renderer: { domElement: HTMLElement }
}
declare global {
  interface Window {
    __kp?: Kp
  }
}
