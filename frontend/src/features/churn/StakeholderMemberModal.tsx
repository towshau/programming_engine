import { useEffect, useState } from 'react'
import type { ChurnRiskMember, RiskTier } from './types'
import { TIER_ORDER, TIER_CONFIG } from './tierUtils'
import { SubScoreBars } from './SubScoreBars'
import { cn } from '../../lib/utils'

interface StakeholderMemberModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  members: ChurnRiskMember[]
  /** Shown in dialog aria-label, e.g. "Coach" or "Gym" */
  contextLabel?: string
}

function groupByTier(members: ChurnRiskMember[]): Record<RiskTier, ChurnRiskMember[]> {
  const out: Record<RiskTier, ChurnRiskMember[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  }
  for (const m of members) out[m.risk_tier].push(m)
  for (const t of TIER_ORDER) {
    out[t].sort((a, b) => b.risk_score - a.risk_score)
  }
  return out
}

function formatDays(d: number | null): string {
  if (d === null) return '—'
  return `${d}d`
}

export function StakeholderMemberModal({
  open,
  onClose,
  title,
  subtitle,
  members,
  contextLabel = 'Stakeholder',
}: StakeholderMemberModalProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setExpandedId(null)
      return
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  const byTier = groupByTier(members)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stakeholder-modal-title"
        className="flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col rounded-xl border shadow-lg"
        style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="min-w-0">
            <p id="stakeholder-modal-title" className="text-base font-semibold truncate" style={{ color: 'var(--text)' }}>
              {title}
            </p>
            {subtitle && (
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                {subtitle} · {members.length} member{members.length !== 1 ? 's' : ''}
              </p>
            )}
            {!subtitle && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {contextLabel} · {members.length} member{members.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-[var(--bg3)]"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {members.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No members in this group.</p>
          ) : (
            <div className="space-y-5">
              {TIER_ORDER.map((tier) => {
                const list = byTier[tier]
                if (list.length === 0) return null
                const cfg = TIER_CONFIG[tier]
                return (
                  <section key={tier}>
                    <h3
                      className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-2"
                      style={{ color: cfg.color }}
                    >
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                      {cfg.label} ({list.length})
                    </h3>
                    <ul className="space-y-1">
                      {list.map((m) => {
                        const expanded = expandedId === m.id
                        return (
                          <li key={m.id} className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                            <button
                              type="button"
                              onClick={() => setExpandedId(expanded ? null : m.id)}
                              className={cn(
                                'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors',
                                expanded ? 'bg-[var(--bg3)]' : 'hover:bg-[var(--bg3)]',
                              )}
                              style={{ color: 'var(--text)' }}
                              aria-expanded={expanded}
                            >
                              <span className="font-medium truncate">{m.member_name}</span>
                              <span className="shrink-0 tabular-nums text-xs font-semibold" style={{ color: cfg.color }}>
                                {m.risk_score}
                              </span>
                            </button>
                            {expanded && (
                              <div className="border-t px-3 py-3 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--bg3)' }}>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                                  <span>
                                    <span className="font-medium" style={{ color: 'var(--text)' }}>Gym:</span> {m.gym}
                                  </span>
                                  <span>
                                    <span className="font-medium" style={{ color: 'var(--text)' }}>Days to end:</span>{' '}
                                    {formatDays(m.days_to_renewal)}
                                  </span>
                                  {m.pipeline_lost && (
                                    <span>
                                      <span className="font-medium" style={{ color: 'var(--text)' }}>Pipeline:</span>{' '}
                                      {m.pipeline_lost === 'bad_churn' ? 'Bad churn' : 'Good churn'}
                                    </span>
                                  )}
                                </div>
                                <SubScoreBars subScores={m.risk_factors.sub_scores} />
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
