import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { MemberPhysicals, HealthMetrics } from '../../lib/scoring'

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })
}

interface TooltipPayloadItem {
  value: number
  payload: Record<string, unknown>
}

function MiniTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
  unit: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border px-2.5 py-1.5 text-xs shadow-md"
      style={{ background: 'var(--bg2)', borderColor: 'var(--border)', color: 'var(--text)' }}
    >
      <p style={{ color: 'var(--text-muted)' }} className="mb-0.5">
        {label}
      </p>
      <p className="font-bold">
        {payload[0].value}
        {unit && <span className="font-normal ml-1" style={{ color: 'var(--text-muted)' }}>{unit}</span>}
      </p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Single small chart
// ────────────────────────────────────────────────────────────────────────────

type YPadding =
  | { type: 'relative'; pct: number }
  | { type: 'absolute'; amount: number }

interface SmallChartProps {
  label: string
  unit: string
  color: string
  points: Array<{ date: string; value: number | null }>
  padding: YPadding
}

function SmallLineChart({ label, unit, color, points, padding }: SmallChartProps) {
  const hasData = points.some((p) => p.value != null)

  // Compute tight Y-axis domain
  let domain: [number, number] | ['auto', 'auto'] = ['auto', 'auto']
  if (hasData) {
    const vals = points.map((p) => p.value).filter((v): v is number => v != null)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    
    if (padding.type === 'absolute') {
      domain = [min - padding.amount, max + padding.amount]
    } else {
      const range = max - min || Math.abs(max * 0.2) || 10 // fallback if min==max
      domain = [min - range * padding.pct, max + range * padding.pct]
    }
    
    // Round bounds nicely
    domain = [
      Number.isInteger(domain[0]) ? domain[0] : Number(domain[0].toFixed(1)),
      Number.isInteger(domain[1]) ? domain[1] : Number(domain[1].toFixed(1)),
    ]
  }

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-wide mb-3"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </p>
      {!hasData ? (
        <div
          className="flex items-center justify-center h-20 rounded-md"
          style={{ background: 'var(--bg3)' }}
        >
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            No data
          </p>
        </div>
      ) : (
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={domain}
                tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={<MiniTooltip unit={unit} />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={{ r: 3, fill: color, strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Benchmark small multiples
// ────────────────────────────────────────────────────────────────────────────

interface BenchmarkChartsProps {
  data: MemberPhysicals[]
}

export function IndividualBenchmarkCharts({ data }: BenchmarkChartsProps) {
  const [collapsed, setCollapsed] = useState(false)

  const metrics: Array<{
    label: string
    unit: string
    color: string
    padding: YPadding
    value: (r: MemberPhysicals) => number | null
  }> = [
    {
      label: 'Grip Strength',
      unit: 'kg',
      color: '#b8860b',
      padding: { type: 'relative', pct: 0.1 },
      value: (r) => r.grip_strength_value,
    },
    {
      label: 'Chin Hold',
      unit: 'sec',
      color: '#2563eb',
      padding: { type: 'relative', pct: 0.1 },
      value: (r) => r.chin_hold_value,
    },
    {
      label: 'Vertical Jump',
      unit: 'cm',
      color: '#16a34a',
      padding: { type: 'relative', pct: 0.1 },
      value: (r) => r.vertical_jump_value,
    },
    {
      label: 'RSI',
      unit: '',
      color: '#9333ea',
      padding: { type: 'relative', pct: 0.1 },
      value: (r) => r.rsi_value,
    },
    {
      label: 'Cardio',
      unit: (data[0]?.picked_cardio === 'bike' ? 'W' : 'mL/kg/min'),
      color: '#0891b2',
      padding: { type: 'relative', pct: 0.1 },
      value: (r) =>
        r.picked_cardio === 'bike' ? r.bike_test_avg_watt : r.vo2_value,
    },
    {
      label: 'Push-ups',
      unit: 'reps',
      color: '#dc2626',
      padding: { type: 'relative', pct: 0.1 },
      value: (r) => r.push_ups_value,
    },
  ]

  return (
    <div
      className="rounded-xl border"
      style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
    >
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <p className="text-base font-bold" style={{ color: 'var(--text)' }}>
            Benchmark Breakdown
          </p>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{
              background: 'var(--bg3)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
          >
            {metrics.length} metrics
          </span>
        </div>
        <svg
          className="w-4 h-4 transition-transform"
          style={{
            color: 'var(--text-muted)',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 grid grid-cols-3 gap-4">
          {metrics.map((m) => (
            <SmallLineChart
              key={m.label}
              label={m.label}
              unit={m.unit}
              color={m.color}
              padding={m.padding}
              points={data.map((row) => ({
                date: formatDate(row.submission_date),
                value: m.value(row),
              }))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Body composition small multiples
// ────────────────────────────────────────────────────────────────────────────

interface BodyCompChartsProps {
  data: HealthMetrics[]
}

export function IndividualBodyCompCharts({ data }: BodyCompChartsProps) {
  const [collapsed, setCollapsed] = useState(false)

  const metrics: Array<{
    label: string
    unit: string
    color: string
    padding: YPadding
    value: (r: HealthMetrics) => number | null
    date: (r: HealthMetrics) => string | null
  }> = [
    {
      label: 'Weight',
      unit: 'kg',
      color: '#b8860b',
      padding: { type: 'relative', pct: 0.1 },
      value: (r) => r.weight,
      date: (r) => r.date_created,
    },
    {
      label: 'Body Fat %',
      unit: '%',
      color: '#dc2626',
      padding: { type: 'absolute', amount: 5 },
      value: (r) => r.bf,
      date: (r) => r.date_created,
    },
    {
      label: 'Muscle Mass',
      unit: 'kg',
      color: '#16a34a',
      padding: { type: 'absolute', amount: 2 },
      value: (r) => r.smm,
      date: (r) => r.date_created,
    },
    {
      label: 'InBody Score',
      unit: '',
      color: '#2563eb',
      padding: { type: 'absolute', amount: 10 },
      value: (r) => r.inbody_score,
      date: (r) => r.date_created,
    },
  ]

  return (
    <div
      className="rounded-xl border"
      style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
    >
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <p className="text-base font-bold" style={{ color: 'var(--text)' }}>
            Body Composition
          </p>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{
              background: 'var(--bg3)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
          >
            {metrics.length} metrics
          </span>
        </div>
        <svg
          className="w-4 h-4 transition-transform"
          style={{
            color: 'var(--text-muted)',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 grid grid-cols-4 gap-4">
          {metrics.map((m) => (
            <SmallLineChart
              key={m.label}
              label={m.label}
              unit={m.unit}
              color={m.color}
              padding={m.padding}
              points={data.map((row) => ({
                date: formatDate(m.date(row)),
                value: m.value(row),
              }))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
