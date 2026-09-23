import type { ModuleKind, Plan } from '@/lib/kitchen/layout'

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
  className?: string
}

export function PlanSketch({ plan, labels, showWidths = false, className }: Props) {
  const W = plan.room.w
  const D = Math.max(...plan.runs.map((r) => (r.id === 'A' ? 60 : r.id === 'I' ? (plan.island?.z ?? 0) + 40 : r.length)), 120)
  const pad = 34
  const T = 12

  const rects = plan.runs.flatMap((run) =>
    run.modules.map((m, i) => {
      const cos = Math.cos(run.rot)
      const sin = Math.sin(run.rot)
      const pt = (x: number, z: number) => [run.ox + x * cos + z * sin, run.oz - x * sin + z * cos]
      const corners = [pt(m.x, 0), pt(m.x + m.w, 0), pt(m.x + m.w, 60), pt(m.x, 60)]
      const xs = corners.map((c) => c[0])
      const zs = corners.map((c) => c[1])
      const x = Math.min(...xs)
      const y = Math.min(...zs)
      return { key: `${run.id}${i}`, x, y, w: Math.max(...xs) - x, h: Math.max(...zs) - y, m, vertical: run.rot !== 0 && run.rot !== Math.PI }
    }),
  )

  const island = plan.island
  const win = plan.window
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
      {island && <rect x={island.x} y={island.z - 62} width={island.w} height={92} rx={3} fill="var(--kp-sk-top)" />}
      {rects.map((r) => (
        <g key={r.key}>
          <rect x={r.x + 0.6} y={r.y + 0.6} width={Math.max(0, r.w - 1.2)} height={Math.max(0, r.h - 1.2)} rx={2} fill={FILL[r.m.kind]} />
          {r.m.kind === 'sink' && <rect x={r.x + r.w * 0.18} y={r.y + r.h * 0.2} width={r.w * 0.64} height={r.h * 0.6} rx={5} fill="var(--kp-sk-sink-bowl)" />}
          {r.m.kind === 'hob' &&
            [0.3, 0.7].flatMap((fx) =>
              [0.32, 0.7].map((fy) => (
                <circle key={`${fx}${fy}`} cx={r.x + r.w * fx} cy={r.y + r.h * fy} r={Math.min(r.w, r.h) * 0.13} fill="none" stroke="var(--kp-sk-hob-ring)" strokeWidth={1.5} />
              )),
            )}
          {showWidths && r.m.w >= 25 && (
            <text
              x={r.x + r.w / 2}
              y={r.y + r.h / 2}
              className="kp-sketch__num"
              textAnchor="middle"
              dominantBaseline="central"
              transform={r.vertical ? `rotate(-90 ${r.x + r.w / 2} ${r.y + r.h / 2})` : undefined}
            >
              {Math.round(r.m.w)}
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
