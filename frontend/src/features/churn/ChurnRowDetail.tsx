import type { ChurnRiskMember, HistoryPoint, AttendanceWeek } from './types'
import { SubScoreBars } from './SubScoreBars'
import { ScoreHistoryChart } from './ScoreHistoryChart'
import { AttendanceChart } from './AttendanceChart'

interface ChurnRowDetailProps {
  member: ChurnRiskMember
  history: HistoryPoint[]
  attendance: AttendanceWeek[] | undefined
}

export function ChurnRowDetail({ member, history, attendance }: ChurnRowDetailProps) {
  const rf = member.risk_factors

  return (
    <div className="px-4 py-5 space-y-4" style={{ background: 'var(--bg3)' }}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column: AI explanation + Score history */}
        <div className="space-y-4">
          <div
            className="rounded-lg border p-4"
            style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
          >
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>
              AI Churn Explanation
            </p>
            {member.churn_explanation ? (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
                {member.churn_explanation}
              </p>
            ) : (
              <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
                No AI explanation — only generated for scores 60+.
              </p>
            )}
          </div>

          <div
            className="rounded-lg border p-4"
            style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
          >
            <ScoreHistoryChart history={history} />
          </div>
        </div>

        {/* Right column: Sub-scores + key stats */}
        <div className="space-y-4">
          <div
            className="rounded-lg border p-4"
            style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
          >
            <SubScoreBars subScores={rf.sub_scores} />
          </div>

          <div
            className="rounded-lg border p-4"
            style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
          >
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>Key Signals</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat
                label="Days to / from end"
                value={member.days_to_renewal === null ? '—' : `${member.days_to_renewal}d (from end_date)`}
              />
              <Stat label="Days since last visit" value={rf.attendance?.days_since_last_visit ?? '—'} />
              <Stat label="Avg sessions / 4wk" value={rf.attendance?.avg_sessions_last_4_weeks?.toFixed(1) ?? '—'} />
              <Stat label="LC last 8wk" value={rf.late_cancel_no_show?.lc_count_last_8_weeks ?? '—'} />
              <Stat label="NS last 8wk" value={rf.late_cancel_no_show?.ns_count_last_8_weeks ?? '—'} />
              <Stat label="Tenure" value={rf.membership?.tenure_months ? `${rf.membership.tenure_months.toFixed(0)} mo` : '—'} />
              <Stat label="Membership" value={rf.membership?.membership_selected ?? '—'} />
              <Stat label="On hold" value={rf.holds?.currently_on_hold ? 'Yes' : 'No'} />
              <Stat label="Body scan" value={rf.engagement?.last_body_scan_days_ago != null ? `${rf.engagement.last_body_scan_days_ago}d ago` : '—'} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: Attendance chart + notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          className="rounded-lg border p-4"
          style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
        >
          {attendance ? (
            <AttendanceChart data={attendance} />
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading attendance...</span>
            </div>
          )}
        </div>

        <div
          className="rounded-lg border p-4"
          style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>Membership Notes</p>
          {member.membership_notes ? (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
              {member.membership_notes}
            </p>
          ) : (
            <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>No notes.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span style={{ color: 'var(--text-muted)' }}>{label}: </span>
      <span className="font-medium" style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  )
}
