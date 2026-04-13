import type { ChurnRiskMember, RiskTier } from './types'
import { TIER_ORDER, TIER_CONFIG, tierCounts, pct } from './tierUtils'

interface StakeholderCardProps {
  title: string
  subtitle?: string
  members: ChurnRiskMember[]
  /** When set, the card is clickable (opens detail modal from parent). */
  onOpen?: () => void
}

function StackedBar({ counts, total }: { counts: Record<RiskTier, number>; total: number }) {
  if (total === 0) return <div className="h-2.5 rounded-full" style={{ background: 'var(--bg3)' }} />
  return (
    <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
      {TIER_ORDER.map((tier) => {
        const width = (counts[tier] / total) * 100
        if (width === 0) return null
        return (
          <div
            key={tier}
            className="transition-all"
            style={{ width: `${width}%`, background: TIER_CONFIG[tier].color, minWidth: width > 0 ? 2 : 0 }}
          />
        )
      })}
    </div>
  )
}

export function StakeholderCard({ title, subtitle, members, onOpen }: StakeholderCardProps) {
  const total = members.length
  const counts = tierCounts(members)

  const className =
    'rounded-lg border p-4 flex flex-col gap-3 min-w-[200px] w-full text-left'

  const style = { background: 'var(--bg2)' as const, borderColor: 'var(--border)' as const }

  const inner = (
    <>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</p>
        {subtitle && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
        )}
      </div>

      <StackedBar counts={counts} total={total} />

      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {TIER_ORDER.map((tier) => (
          <div key={tier} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: TIER_CONFIG[tier].color }}
              />
              <span style={{ color: 'var(--text-muted)' }}>{TIER_CONFIG[tier].label}</span>
            </span>
            <span className="font-medium tabular-nums" style={{ color: 'var(--text)' }}>
              {counts[tier]} <span style={{ color: 'var(--text-muted)' }}>({pct(counts[tier], total)}%)</span>
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        Total: {total}
      </p>
      {onOpen && (
        <p className="text-xs font-medium" style={{ color: 'var(--color-gold)' }}>
          View members
        </p>
      )}
    </>
  )

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`${className} cursor-pointer transition-colors hover:brightness-[0.98] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/40`}
        style={style}
        aria-label={`Open member list for ${title}`}
      >
        {inner}
      </button>
    )
  }

  return (
    <div className={className} style={style}>
      {inner}
    </div>
  )
}
