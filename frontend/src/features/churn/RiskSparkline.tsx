import { LineChart, Line, ResponsiveContainer } from 'recharts'
import type { HistoryPoint } from './types'
import { TIER_CONFIG } from './tierUtils'

interface RiskSparklineProps {
  history: HistoryPoint[]
}

export function RiskSparkline({ history }: RiskSparklineProps) {
  if (history.length < 2) {
    return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
  }

  const latest = history[history.length - 1]
  const color = TIER_CONFIG[latest.risk_tier]?.color ?? 'var(--text-muted)'

  return (
    <div style={{ width: 80, height: 24 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history}>
          <Line
            type="monotone"
            dataKey="risk_score"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
