import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { computeRadarData, getRadarBreakdown } from '../../lib/scoring'
import type { MemberPhysicals } from '../../lib/scoring'

interface Props {
  physicals: MemberPhysicals | null
}

const TICK_LABELS: Record<number, string> = {
  0: '',
  25: 'Needs Work',
  50: 'Below Avg',
  75: 'Good',
  100: 'Excellent',
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: { axis: string; score: number } }>
}) {
  if (!active || !payload?.length) return null
  const { axis, score } = payload[0].payload
  const label =
    score >= 75
      ? 'Excellent'
      : score >= 50
      ? 'Good'
      : score >= 25
      ? 'Below Average'
      : 'Needs Work'
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-md"
      style={{
        background: 'var(--bg2)',
        borderColor: 'var(--border)',
        color: 'var(--text)',
      }}
    >
      <p className="font-bold mb-0.5">{axis}</p>
      {axis === 'Bloods' ? (
        <p style={{ color: 'var(--text-muted)' }}>Coming soon</p>
      ) : (
        <p style={{ color: 'var(--text-muted)' }}>
          {score}% — <span style={{ color: 'var(--color-gold)' }}>{label}</span>
        </p>
      )}
    </div>
  )
}

const RADAR_SCORE_FLOOR = 5

export function RadarOverview({ physicals }: Props) {
  const rawData = computeRadarData(physicals)
  // Floor scores so zero/null axes still produce a visible polygon shape
  const chartData = rawData.map((d) => ({ ...d, score: Math.max(RADAR_SCORE_FLOOR, d.score) }))
  const breakdown = getRadarBreakdown(physicals)
  const hasAnyData = physicals !== null

  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-wide"
            style={{ color: 'var(--text-muted)' }}
          >
            Performance Overview
          </p>
          <p className="text-base font-bold mt-0.5" style={{ color: 'var(--text)' }}>
            Physical Capacity Radar
          </p>
        </div>
        {!hasAnyData && (
          <span
            className="text-xs px-2 py-1 rounded-md border"
            style={{
              color: 'var(--text-muted)',
              borderColor: 'var(--border)',
              background: 'var(--bg3)',
            }}
          >
            No data — showing baseline
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4">
        {[
          { label: 'Needs Work', color: 'var(--red)' },
          { label: 'Below Avg', color: 'var(--orange)' },
          { label: 'Good', color: '#facc15' },
          { label: 'Excellent', color: 'var(--green)' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="h-72 relative">
        <style>{`
          /* Outer pentagon — solid black */
          .recharts-polar-grid-concentric-polygon:last-of-type {
            stroke: #1a1f2e !important;
            stroke-width: 2px !important;
            stroke-opacity: 1 !important;
          }
          /* Inner concentric polygons — visible light grey */
          .recharts-polar-grid-concentric-polygon:not(:last-of-type) {
            stroke: #9ca3af !important;
            stroke-width: 1px !important;
            stroke-opacity: 1 !important;
          }
          /* Spoke lines from centre — visible light grey */
          .recharts-polar-grid-angle line {
            stroke: #9ca3af !important;
            stroke-opacity: 1 !important;
          }
        `}</style>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
            <PolarGrid gridType="polygon" stroke="#9ca3af" strokeWidth={1} />
            <PolarAngleAxis
              dataKey="axis"
              tick={{
                fill: 'var(--text)',
                fontSize: 12,
                fontWeight: 600,
              }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tickCount={5}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              tickFormatter={(v: number) => TICK_LABELS[v] ?? ''}
              axisLine={false}
            />
            <Radar
              name="Score"
              dataKey="score"
              stroke="var(--color-gold)"
              fill="var(--color-gold)"
              fillOpacity={0.25}
              strokeWidth={2}
              dot={{ r: 4, fill: 'var(--color-gold)', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Axis breakdown */}
      <div
        className="grid grid-cols-5 gap-3 mt-6 pt-5"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        {rawData.map((d) => {
          const pct = d.score
          const color =
            d.axis === 'Bloods'
              ? 'var(--text-muted)'
              : pct >= 75
              ? 'var(--green)'
              : pct >= 50
              ? 'var(--color-gold)'
              : pct >= 25
              ? 'var(--orange)'
              : 'var(--red)'

          const items = breakdown[d.axis] ?? []

          return (
            <div
              key={d.axis}
              className="rounded-xl border p-3 flex flex-col"
              style={{ background: 'var(--bg3)', borderColor: 'var(--border)' }}
            >
              <div
                className="text-center pb-3 mb-3"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-wide mb-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {d.axis}
                </p>
                <p className="text-lg font-black" style={{ color }}>
                  {d.axis === 'Bloods' ? '—' : `${pct}%`}
                </p>
              </div>

              {/* Sub-metrics */}
              <div className="space-y-2 px-1 flex-1">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold" style={{ color: 'var(--text)' }}>
                        {item.value != null ? item.value : '-'}
                        {item.value != null && item.unit ? ` ${item.unit}` : ''}
                      </span>
                      {item.rag && (
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{
                            background:
                              item.rag === 'green'
                                ? 'var(--green)'
                                : item.rag === 'amber'
                                ? 'var(--orange)'
                                : 'var(--red)',
                          }}
                        />
                      )}
                    </div>
                  </div>
                ))}
                {items.length === 0 && d.axis === 'Bloods' && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-[10px] italic" style={{ color: 'var(--text-muted)' }}>
                      Coming soon
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
