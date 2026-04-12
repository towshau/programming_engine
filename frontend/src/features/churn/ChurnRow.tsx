import type { ChurnRiskMember, HistoryPoint, AttendanceWeek } from './types'
import { TIER_CONFIG } from './tierUtils'
import { Badge } from '../../components/ui/Badge'
import { RiskSparkline } from './RiskSparkline'
import { ChurnRowDetail } from './ChurnRowDetail'

interface ChurnRowProps {
  member: ChurnRiskMember
  history: HistoryPoint[]
  attendance: AttendanceWeek[] | undefined
  expanded: boolean
  onToggle: () => void
}

export function ChurnRow({ member, history, attendance, expanded, onToggle }: ChurnRowProps) {
  const tier = TIER_CONFIG[member.risk_tier]
  const d = member.days_to_renewal
  const urgentSoon = d !== null && d >= 0 && d <= 14
  const overdue = d !== null && d < 0

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer transition-colors hover:brightness-[0.98]"
        style={{
          background: 'var(--bg2)',
          borderBottom: expanded ? 'none' : undefined,
        }}
      >
        {/* Risk score */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: tier.color }}
            />
            <span className="text-sm font-semibold tabular-nums" style={{ color: tier.color }}>
              {member.risk_score}
            </span>
          </div>
        </td>

        {/* Member name */}
        <td className="px-3 py-2.5">
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {member.member_name}
          </span>
        </td>

        {/* Gym */}
        <td className="px-3 py-2.5">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{member.gym}</span>
        </td>

        {/* Coach */}
        <td className="px-3 py-2.5">
          <span className="text-sm" style={{ color: 'var(--text)' }}>{member.coach_name}</span>
        </td>

        {/* Renewal Lead */}
        <td className="px-3 py-2.5">
          <span className="text-sm" style={{ color: 'var(--text)' }}>{member.renewal_lead_name}</span>
        </td>

        {/* Days to / from membership end (signed from end_date) */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <span
            className="text-sm tabular-nums font-medium"
            style={{ color: urgentSoon || overdue ? 'var(--red)' : 'var(--text)' }}
          >
            {d === null ? '—' : `${d}d`}
          </span>
        </td>

        {/* Pipeline flag */}
        <td className="px-3 py-2.5">
          {member.pipeline_lost === 'bad_churn' && <Badge variant="gold">Bad Churn</Badge>}
          {member.pipeline_lost === 'good_churn' && <Badge variant="gray">Good Churn</Badge>}
        </td>

        {/* Sparkline */}
        <td className="px-3 py-2.5">
          <RiskSparkline history={history} />
        </td>

        {/* AI summary */}
        <td className="px-3 py-2.5 max-w-[200px]">
          {member.churn_explanation ? (
            <span
              className="text-xs line-clamp-2"
              style={{ color: 'var(--text-muted)' }}
            >
              {member.churn_explanation}
            </span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
          )}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={9} className="p-0" style={{ borderTop: '1px solid var(--border)' }}>
            <ChurnRowDetail member={member} history={history} attendance={attendance} />
          </td>
        </tr>
      )}
    </>
  )
}
