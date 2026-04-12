import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { HistoryPoint } from './types'

interface ScoreHistoryChartProps {
  history: HistoryPoint[]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export function ScoreHistoryChart({ history }: ScoreHistoryChartProps) {
  if (history.length < 2) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Not enough history for a trend chart.
      </p>
    )
  }

  const chartData = history.map((h) => ({
    date: formatDate(h.scored_at),
    score: h.risk_score,
  }))

  return (
    <div>
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>
        Score History
      </p>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => [`${value}`, 'Risk Score']}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--red)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--red)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
