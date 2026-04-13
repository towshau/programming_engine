import type { SubScores } from './types'

interface SubScoreBarsProps {
  subScores: SubScores
}

const LABELS: { key: keyof SubScores; label: string }[] = [
  { key: 'attendance', label: 'Attendance' },
  { key: 'recency', label: 'Recency' },
  { key: 'lcns', label: 'LC / No-shows' },
  { key: 'holds', label: 'Holds' },
  { key: 'renewal_proximity', label: 'Renewal Prox.' },
  { key: 'tenure', label: 'Tenure' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'history', label: 'History' },
  { key: 'pipeline_flag', label: 'Pipeline Flag' },
]

function barColor(value: number): string {
  if (value >= 15) return 'var(--red)'
  if (value >= 8) return 'var(--orange)'
  if (value >= 3) return 'var(--blue)'
  return 'var(--green)'
}

export function SubScoreBars({ subScores }: SubScoreBarsProps) {
  const maxVal = 30

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Risk Sub-scores</p>
      {LABELS.map(({ key, label }) => {
        const val = subScores[key] ?? 0
        const widthPct = Math.min((val / maxVal) * 100, 100)
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs w-24 shrink-0 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {label}
            </span>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg3)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${widthPct}%`, background: barColor(val) }}
              />
            </div>
            <span className="text-xs w-8 tabular-nums font-medium" style={{ color: 'var(--text)' }}>
              {val.toFixed(1)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
