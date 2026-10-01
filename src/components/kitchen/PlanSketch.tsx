import type { Module, ModuleKind, Plan } from '@/lib/kitchen/layout'
import type { PlanNames } from './PlanView'
import { rectOf } from './planGeom'

/**
 * Чертёж кухни сверху: стены, шкафы и техника в масштабе. Тот же план, что и
 * в 3D, — поэтому мебельщик видит ровно то, что покупатель собрал.
 */

const FILL: Record<ModuleKind, string> = {
  doors: 'var(--kp-sk-cab)',
  drawers: 'var(--kp-sk-cab)',
  corner: 'var(--kp-sk-cab)',
  bottle: 'var(--kp-sk-cab)',
  filler: 'var(--kp-sk-filler)',
  sink: 'var(--kp-sk-sink)',
  hob: 'var(--kp-sk-hob)',
  dishwasher: 'var(--kp-sk-tech)',
  washer: 'var(--kp-sk-tech)',
  fridge: 'var(--kp-sk-tech)',
  tall: 'var(--kp-sk-tech)',
  pantry: 'var(--kp-sk-cab)',
  oven: 'var(--kp-sk-tech)',
}

type Props = {
  plan: Plan
  labels: { a: string; b?: string; c?: string }
  /** подпись под модулем: ширина в см */
  showWidths?: boolean
  /** мойка, варочная и техника — названием, как в плане (`t.planNames`) */
  names?: PlanNames
  /** узкий модуль (< 25 см) — сокращённым названием (`t.modules`) */
  modules?: Partial<Record<string, string>>
  className?: string
}

/** Подпись модуля на схеме: мойка/варочная/техника — названием, шкаф — шириной, узкий — сокращением. */
function sketchLabel(m: { kind: string; w: number }, names?: PlanNames, modules?: Partial<Record<string, string>>): string {
  const named = names && (m.kind in names ? names[m.kind as keyof PlanNames] : undefined)
  if (named && m.kind !== 'corner') return m.w >= 25 ? named : short(named)
  if (m.w >= 25) return String(Math.round(m.w))
  const name = modules?.[m.kind]
  return name ? short(name) : ''
}
const short = (s: string) => (s.length <= 5 ? s : `${s.slice(0, 4)}.`)

export function PlanSketch({ plan, labels, showWidths = false, names, modules, className }: Props) {
  const W = plan.room.w
  const island = plan.island
  // повёрнутый остров рисуется своей группой с поворотом (как в 3D), не рамками по осям
  const turned = island?.turn ? plan.runs.find((r) => !r.wall) : undefined
  const turnedPt = (x: number, z: number) =>
    turned ? [turned.ox + x * Math.cos(turned.rot) + z * Math.sin(turned.rot), turned.oz - x * Math.sin(turned.rot) + z * Math.cos(turned.rot)] : [x, z]
  // столешница острова в координатах ряда: вдоль — 0…w, вглубь — от свеса (−30) до края у кухни (62)
  const islandTop = turned && island ? [turnedPt(0, -30), turnedPt(island.w, -30), turnedPt(island.w, 62), turnedPt(0, 62)] : null
  // окно на боковой стене (у прямой кухни) должно лечь на стену, а не за её конец
  const winEnd = plan.window?.wall === 'left' ? plan.window.at + plan.window.w / 2 + 20 : 0
  const islandEnd = islandTop ? Math.max(...islandTop.map((p) => p[1])) + 10 : (island?.z ?? 0) + 40
  const D = Math.max(...plan.runs.map((r) => (r.id === 'A' ? 60 : r.id === 'I' ? islandEnd : r.length)), 120, winEnd)
  const pad = 34
  const T = 12

  const rects = plan.runs.flatMap((run) =>
    run === turned ? [] : run.modules.map((m, i) => ({ key: `${run.id}${i}`, ...rectOf(run, m.x, m.w, 0, 60), m, vertical: run.rot !== 0 && run.rot !== Math.PI })),
  )

  const win = plan.window
  // одна клетка модуля: мойка с чашей, варочная с конфорками; x, y, w, h — в координатах, где её рисуют
  const cell = (m: Module, x: number, y: number, w: number, h: number) => (
    <>
      <rect x={x + 0.6} y={y + 0.6} width={Math.max(0, w - 1.2)} height={Math.max(0, h - 1.2)} rx={2} fill={FILL[m.kind]} />
      {m.kind === 'sink' && <rect x={x + w * 0.18} y={y + h * 0.2} width={w * 0.64} height={h * 0.6} rx={5} fill="var(--kp-sk-sink-bowl)" />}
      {m.kind === 'hob' &&
        [0.3, 0.7].flatMap((fx) =>
          [0.32, 0.7].map((fy) => (
            <circle key={`${fx}${fy}`} cx={x + w * fx} cy={y + h * fy} r={Math.min(w, h) * 0.13} fill="none" stroke="var(--kp-sk-hob-ring)" strokeWidth={1.5} />
          )),
        )}
    </>
  )
  return (
    <svg
      className={className}
      viewBox={`${-pad - T} ${-pad - T} ${W + 2 * pad + 2 * T} ${D + 2 * pad + T}`}
      role="img"
      aria-label={[labels.a, labels.b, labels.c].filter(Boolean).join(', ')}
    >
      {/* стены */}
      <rect x={-T} y={-T} width={W + T + (plan.shape === 'u' ? T : 0)} height={T} fill="var(--kp-sk-wall)" />
      <rect x={-T} y={0} width={T} height={D} fill="var(--kp-sk-wall)" />
      {plan.shape === 'u' && <rect x={W} y={0} width={T} height={D} fill="var(--kp-sk-wall)" />}
      {win?.wall === 'back' && <rect x={win.at - win.w / 2} y={-T} width={win.w} height={T} fill="var(--kp-sk-window)" />}
      {win?.wall === 'left' && <rect x={-T} y={win.at - win.w / 2} width={T} height={win.w} fill="var(--kp-sk-window)" />}
      {island && !turned && <rect x={island.x} y={island.z - 62} width={island.w} height={92} rx={3} fill="var(--kp-sk-top)" />}
      {islandTop && <polygon points={islandTop.map((p) => p.join(',')).join(' ')} fill="var(--kp-sk-top)" />}
      {turned && (
        <g transform={`translate(${turned.ox} ${turned.oz}) rotate(${(-turned.rot * 180) / Math.PI})`}>
          {turned.modules.map((m, i) => (
            <g key={`${turned.id}${i}`}>{cell(m, m.x, 0, m.w, 60)}</g>
          ))}
        </g>
      )}
      {/* ширины у повёрнутого острова — прямо, посередине модуля */}
      {showWidths &&
        turned?.modules
          .filter((m) => m.w >= 25)
          .map((m, i) => {
            const [cx, cy] = turnedPt(m.x + m.w / 2, 30)
            return (
              <text key={`w${i}`} x={cx} y={cy} className="kp-sketch__num" textAnchor="middle" dominantBaseline="central">
                {Math.round(m.w)}
              </text>
            )
          })}
      {rects.map((r) => (
        <g key={r.key}>
          {cell(r.m, r.x, r.y, r.w, r.h)}
          {showWidths && sketchLabel(r.m, names, modules) && (
            <text
              x={r.x + r.w / 2}
              y={r.y + r.h / 2}
              className="kp-sketch__num"
              textAnchor="middle"
              dominantBaseline="central"
              transform={r.vertical !== r.m.w < 25 ? `rotate(-90 ${r.x + r.w / 2} ${r.y + r.h / 2})` : undefined}
            >
              {sketchLabel(r.m, names, modules)}
            </text>
          )}
        </g>
      ))}
      {/* размеры стен */}
      <text x={W / 2} y={-T - 10} className="kp-sketch__dim" textAnchor="middle">
        {labels.a}
      </text>
      {labels.b && (
        <text x={-T - 10} y={D / 2} className="kp-sketch__dim" textAnchor="middle" transform={`rotate(-90 ${-T - 10} ${D / 2})`}>
          {labels.b}
        </text>
      )}
      {labels.c && (
        <text x={W + T + 10} y={D / 2} className="kp-sketch__dim" textAnchor="middle" transform={`rotate(90 ${W + T + 10} ${D / 2})`}>
          {labels.c}
        </text>
      )}
    </svg>
  )
}
