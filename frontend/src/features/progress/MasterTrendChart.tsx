import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { MemberPhysicals } from '../../lib/scoring'
import { cn } from '../../lib/utils'

interface Props {
  data: MemberPhysicals[]
}

interface MetricConfig {
  key: string
  label: string
  color: string
  unit: string
  raw: (row: MemberPhysicals) => number | null | undefined
}

// All benchmark metrics
const METRICS: MetricConfig[] = [
  {
    key: 'grip',
    label: 'Grip Strength',
    color: '#b8860b',
    unit: 'kg',
    raw: (r) => r.grip_strength_value,
  },
  {
    key: 'chin',
    label: 'Chin Hold',
    color: '#2563eb',
    unit: 'sec',
    raw: (r) => r.chin_hold_value,
  },
  {
    key: 'jump',
    label: 'Vertical Jump',
    color: '#16a34a',
    unit: 'cm',
    raw: (r) => r.vertical_jump_value,
  },
  {
    key: 'rsi',
    label: 'RSI',
    color: '#9333ea',
    unit: '',
    raw: (r) => r.rsi_value,
  },
  {
    key: 'cardio',
    label: 'Cardio',
    color: '#0891b2',
    unit: 'V/W',
    raw: (r) => (r.picked_cardio === 'bike' ? r.bike_test_avg_watt : r.vo2_value),
  },
  {
    key: 'pushups',
    label: 'Push-ups',
    color: '#dc2626',
    unit: 'reps',
    raw: (r) => r.push_ups_value,
  },
]

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })
}

interface TooltipPayloadItem {
  name: string
  value: number
  stroke: string
  payload: Record<string, unknown>
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg min-w-[160px]"
      style={{ background: 'var(--bg2)', borderColor: 'var(--border)', color: 'var(--text)' }}
    >
      <p className="font-bold mb-2" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      {payload.map((p) => {
        const metric = METRICS.find((m) => m.key === p.name)
        const unit = metric?.unit ? ` ${metric.unit}` : ''
        return (
          <div key={p.name} className="flex items-center justify-between gap-4 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: p.stroke }} />
              {metric?.label ?? p.name}
            </span>
            <span className="font-bold">
              {p.value}
              <span className="font-normal" style={{ color: 'var(--text-muted)' }}>{unit}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function MasterTrendChart({ data }: Props) {
  const [activeMetrics, setActiveMetrics] = useState<Set<string>>(
    new Set(METRICS.map((m) => m.key)),
  )

  function toggleMetric(key: string) {
    setActiveMetrics((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size > 1) next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const chartData = data.map((row) => {
    const point: Record<string, unknown> = { date: formatDate(row.submission_date) }
    for (const m of METRICS) {
      point[m.key] = m.raw(row)
    }
    return point
  })

  // Calculate dynamic Y-axis bounds based on active metrics
  const activeValues = chartData.flatMap((row) =>
    Array.from(activeMetrics).map((key) => row[key] as number | undefined | null).filter((v) => v != null),
  )
  const minVal = activeValues.length > 0 ? Math.min(...activeValues) : 0
  const maxVal = activeValues.length > 0 ? Math.max(...activeValues) : 100
  const padding = (maxVal - minVal) * 0.1 || 1
  const yDomain = [Math.floor(minVal - padding), Math.ceil(maxVal + padding)]

  const hasData = data.length > 0

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
            Benchmark Trends
          </p>
          <p className="text-base font-bold mt-0.5" style={{ color: 'var(--text)' }}>
            All Metrics (Raw Values)
          </p>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Toggle metrics below
        </p>
      </div>

      {/* Metric toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {METRICS.map((m) => {
          const active = activeMetrics.has(m.key)
          return (
            <button
              key={m.key}
              onClick={() => toggleMetric(m.key)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all',
                active ? 'opacity-100' : 'opacity-40',
              )}
              style={{
                borderColor: m.color,
                color: active ? m.color : 'var(--text-muted)',
                background: active ? `${m.color}18` : 'transparent',
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: m.color }}
              />
              {m.label}
            </button>
          )
        })}
      </div>

      {!hasData ? (
        <div
          className="flex items-center justify-center h-52 rounded-lg border"
          style={{ borderColor: 'var(--border)', background: 'var(--bg3)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No assessment history found.
          </p>
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
              />
              <YAxis
                domain={yDomain}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value, entry) => {
                  const metric = METRICS.find((m) => m.key === entry.dataKey)
                  return <span style={{ color: 'var(--text-muted)' }}>{metric?.label ?? value}</span>
                }}
              />
              {METRICS.filter((m) => activeMetrics.has(m.key)).map((m) => (
                <Line
                  key={m.key}
                  type="monotone"
                  dataKey={m.key}
                  name={m.key} // Use key as name so tooltip can look up full config
                  stroke={m.color}
                  strokeWidth={2}
                  dot={{ r: 4, fill: m.color, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
