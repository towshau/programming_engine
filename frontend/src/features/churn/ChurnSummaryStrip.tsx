import { useState, type CSSProperties } from 'react'
import type { ChurnRiskMember } from './types'
import { TIER_ORDER, TIER_CONFIG, tierCounts, pct, formatScoredDate, type DisplayRiskTier, calculateRpi } from './tierUtils'
import { cn } from '../../lib/utils'
import {
  MODEL_SIGNALS_DISCLAIMER,
  NINE_SIGNALS,
  WEEKLY_CYCLE_STEPS,
  WEEKLY_CYCLE_INTRO,
  EXCLUSIONS_TEXT,
  SELF_IMPROVE_PARAGRAPHS,
} from './churnModelExplained'

const RISK_FACTOR_ITEMS: { title: string; items: string[] }[] = [
  {
    title: 'Attendance & recency',
    items: [
      'Average sessions over the last 4 weeks vs allocated sessions per week',
      'Days since last visit',
      'Attendance ratio and trend',
    ],
  },
  {
    title: 'Reliability',
    items: [
      'Late cancel and no-show counts over the last 8 weeks',
      'Late cancel / no-show ratio',
    ],
  },
  {
    title: 'Membership',
    items: [
      'Tenure (months)',
      'Days to renewal / expiry',
      'Holds (count, weeks on hold, frequency)',
    ],
  },
  {
    title: 'Engagement',
    items: ['Days since last body scan'],
  },
  {
    title: 'Staff input',
    items: [
      'Pipeline flags: projected bad churn vs projected good churn (manager-set)',
    ],
  },
  {
    title: 'History',
    items: ['Previously marked not renewing', 'Prior good/bad churn history where recorded'],
  },
]

const PANEL_CLASS =
  'w-full lg:w-1/2 lg:max-w-[50%] min-w-0 flex-1 rounded-lg border p-4 text-sm'

interface ChurnSummaryStripProps {
  members: ChurnRiskMember[]
  activeTiers: Set<DisplayRiskTier>
  onToggleTier: (tier: DisplayRiskTier | null) => void
  scoredAt: string | null
  sortRpi: 'none' | 'desc'
  onToggleSortRpi: () => void
}

export function ChurnSummaryStrip({ members, activeTiers, onToggleTier, scoredAt, sortRpi, onToggleSortRpi }: ChurnSummaryStripProps) {
  const total = members.length
  const counts = tierCounts(members)
  const renewalProbability = calculateRpi(members)
  const noTierActive = activeTiers.size === 0
  const [infoOpen, setInfoOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)

  const hasExplainer = infoOpen || modelOpen

  return (
    <div className="rounded-xl border p-4" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          <button
            type="button"
            onClick={() => onToggleTier(null)}
            className={cn(
              'flex flex-col items-center rounded-lg px-5 py-3 transition-all border min-w-[100px]',
              noTierActive ? 'ring-2 ring-[var(--color-gold)]/40' : 'opacity-70 hover:opacity-100',
            )}
            style={{
              background: noTierActive ? 'var(--bg3)' : 'var(--bg2)',
              borderColor: 'var(--border)',
            }}
          >
            <span className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{total}</span>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Total</span>
          </button>

          {TIER_ORDER.map((tier) => {
            const count = counts[tier]
            const config = TIER_CONFIG[tier]
            const isActive = activeTiers.has(tier)
            const highlighted = noTierActive || isActive

            return (
              <button
                type="button"
                key={tier}
                onClick={() => onToggleTier(tier)}
                className={cn(
                  'flex flex-col items-center rounded-lg px-5 py-3 transition-all border min-w-[100px]',
                  highlighted ? 'ring-2' : 'opacity-50 hover:opacity-80',
                )}
                style={{
                  background: highlighted ? config.bg : 'var(--bg2)',
                  borderColor: highlighted ? config.border : 'var(--border)',
                  ...(highlighted ? { '--tw-ring-color': config.color } as CSSProperties : {}),
                }}
              >
                <span className="text-2xl font-bold" style={{ color: config.color }}>{count}</span>
                <span className="text-xs font-medium" style={{ color: config.color }}>
                  {config.label} ({pct(count, total)}%)
                </span>
              </button>
            )
          })}

          <button
            type="button"
            onClick={onToggleSortRpi}
            className={cn(
              'flex flex-col items-center justify-center rounded-lg px-5 py-3 border min-w-[120px] transition-all',
              sortRpi === 'desc' 
                ? 'bg-[var(--bg3)] border-[var(--border)] ring-2 ring-[var(--color-gold)]/40 shadow-sm'
                : 'bg-[var(--bg3)] border-transparent hover:brightness-[0.98]'
            )}
            title="Sort Stakeholder cards below by highest RPI"
          >
            <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--green)' }}>
              {renewalProbability.toFixed(1)}%
            </span>
            <span className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              Renewal Probability
              {sortRpi === 'desc' && (
                <svg className="w-3 h-3 text-[var(--color-gold)]" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M6 10l-3-4h6z" />
                </svg>
              )}
            </span>
          </button>
        </div>

        <div className="flex flex-row flex-wrap gap-2 justify-end shrink-0">
          <button
            type="button"
            id="churn-toggle-risk-factors"
            onClick={() => setInfoOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors border"
            style={{
              background: infoOpen ? 'var(--bg3)' : 'var(--bg2)',
              borderColor: 'var(--border)',
              color: 'var(--text-muted)',
            }}
            aria-expanded={infoOpen}
            aria-controls="churn-risk-factors-panel"
            title="What goes into the risk score?"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
            </svg>
            How risk is evaluated
          </button>
          <button
            type="button"
            id="churn-toggle-model-explanation"
            onClick={() => setModelOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors border"
            style={{
              background: modelOpen ? 'var(--bg3)' : 'var(--bg2)',
              borderColor: 'var(--border)',
              color: 'var(--text-muted)',
            }}
            aria-expanded={modelOpen}
            aria-controls="churn-model-explanation-panel"
            title="Pipeline, weekly run, and how the model improves"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Model Explanation
          </button>
        </div>
      </div>

      {hasExplainer && (
        <div className="mt-3 flex flex-col lg:flex-row gap-3 items-stretch">
          {infoOpen && (
            <div
              id="churn-risk-factors-panel"
              role="region"
              aria-labelledby="churn-toggle-risk-factors"
              className={PANEL_CLASS}
              style={{ background: 'var(--bg3)', borderColor: 'var(--border)' }}
            >
              <p className="font-semibold mb-2" style={{ color: 'var(--text)' }}>
                Factors in the churn risk score (0–100)
              </p>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                The model combines weighted sub-scores from the signals below. Higher total score means higher predicted churn risk.
              </p>
              <ul className="space-y-3">
                {RISK_FACTOR_ITEMS.map((section) => (
                  <li key={section.title}>
                    <span className="font-medium" style={{ color: 'var(--text)' }}>{section.title}</span>
                    <ul className="mt-1 ml-4 list-disc space-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {section.items.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {modelOpen && (
            <div
              id="churn-model-explanation-panel"
              role="region"
              aria-labelledby="churn-toggle-model-explanation"
              className={`${PANEL_CLASS} max-h-[70vh] overflow-y-auto`}
              style={{ background: 'var(--bg3)', borderColor: 'var(--border)' }}
            >
              <p className="font-semibold mb-2" style={{ color: 'var(--text)' }}>
                Model Explanation
              </p>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                {WEEKLY_CYCLE_INTRO}
              </p>

              <div className="space-y-3 mb-4">
                {WEEKLY_CYCLE_STEPS.map((step) => (
                  <div key={step.label}>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{step.label}</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{step.body}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text)' }}>
                What the model looks at (nine signals)
              </p>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                {MODEL_SIGNALS_DISCLAIMER}
              </p>
              <ul className="space-y-2 mb-4">
                {NINE_SIGNALS.map((s) => (
                  <li key={s.name} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span className="font-medium" style={{ color: 'var(--text)' }}>{s.name}</span>
                    {' — '}{s.description}
                  </li>
                ))}
              </ul>

              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                {EXCLUSIONS_TEXT}
              </p>

              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>
                How the model self-improves
              </p>
              <div className="space-y-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                {SELF_IMPROVE_PARAGRAPHS.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {scoredAt && (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          Scored on {formatScoredDate(scoredAt)}
        </p>
      )}
    </div>
  )
}
