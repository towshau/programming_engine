import { useState, useMemo } from 'react'
import type { ChurnRiskMember, HistoryPoint, AttendanceWeek, SortColumn, SortState } from './types'
import { TIER_ORDER, TIER_CONFIG, toDisplayTier, type DisplayRiskTier } from './tierUtils'
import { SearchInput } from '../../components/ui/SearchInput'
import { ChurnRow } from './ChurnRow'

const PAGE_SIZE = 50

interface ChurnTableProps {
  members: ChurnRiskMember[]
  historyMap: Map<string, HistoryPoint[]>
  activeTiers: Set<DisplayRiskTier>
  attendanceMap: Map<string, AttendanceWeek[]>
  onExpandMember: (memberId: string) => void
}

const COLUMNS: { key: SortColumn; label: string; tooltip: string; className?: string }[] = [
  { key: 'risk_score', label: 'Risk', tooltip: 'AI-generated churn risk score (0-100) based on attendance, holds, tenure, and engagement.' },
  { key: 'member_name', label: 'Member', tooltip: 'Member full name.' },
  { key: 'gym', label: 'Gym', tooltip: 'Primary home gym location.' },
  { key: 'coach_name', label: 'Coach', tooltip: 'Active coach (handoff coach takes priority if assigned).' },
  { key: 'renewal_lead_name', label: 'Renewal Lead', tooltip: 'Staff member assigned to conduct the renewal conversation.' },
  { key: 'days_to_renewal', label: 'Days', tooltip: 'Signed calendar days until membership end_date on this row: positive = days left, negative = days overdue (e.g. -3d). From member_memberships linked via member_churn_risk.membership_id.' },
]

function sortMembers(members: ChurnRiskMember[], sort: SortState): ChurnRiskMember[] {
  const sorted = [...members]
  sorted.sort((a, b) => {
    if (sort.column === 'days_to_renewal') {
      const rank = (v: number | null) =>
        v === null ? (sort.direction === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY) : v
      const aR = rank(a.days_to_renewal)
      const bR = rank(b.days_to_renewal)
      return sort.direction === 'asc' ? aR - bR : bR - aR
    }
    const aVal = a[sort.column]
    const bVal = b[sort.column]
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sort.direction === 'asc' ? aVal - bVal : bVal - aVal
    }
    const aStr = String(aVal).toLowerCase()
    const bStr = String(bVal).toLowerCase()
    const cmp = aStr.localeCompare(bStr)
    return sort.direction === 'asc' ? cmp : -cmp
  })
  return sorted
}

export function ChurnTable({ members, historyMap, activeTiers, attendanceMap, onExpandMember }: ChurnTableProps) {
  const [sort, setSort] = useState<SortState>({ column: 'risk_score', direction: 'desc' })
  const [gymFilter, setGymFilter] = useState<string>('')
  const [coachFilter, setCoachFilter] = useState<string>('')
  const [renewalLeadFilter, setRenewalLeadFilter] = useState<string>('')
  const [pipelineFilter, setPipelineFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const uniqueGyms = useMemo(() => [...new Set(members.map((m) => m.gym))].sort(), [members])
  const uniqueCoaches = useMemo(() => [...new Set(members.map((m) => m.coach_name))].sort(), [members])
  const uniqueRLs = useMemo(() => [...new Set(members.map((m) => m.renewal_lead_name))].sort(), [members])

  const filtered = useMemo(() => {
    let list = members
    if (activeTiers.size > 0) list = list.filter((m) => activeTiers.has(toDisplayTier(m.risk_tier)))
    if (gymFilter) list = list.filter((m) => m.gym === gymFilter)
    if (coachFilter) list = list.filter((m) => m.coach_name === coachFilter)
    if (renewalLeadFilter) list = list.filter((m) => m.renewal_lead_name === renewalLeadFilter)
    if (pipelineFilter) {
      if (pipelineFilter === 'none') list = list.filter((m) => !m.pipeline_lost)
      else list = list.filter((m) => m.pipeline_lost === pipelineFilter)
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((m) => m.member_name.toLowerCase().includes(q))
    }
    return list
  }, [members, activeTiers, gymFilter, coachFilter, renewalLeadFilter, pipelineFilter, search])

  const badChurn = useMemo(() => {
    const list = filtered.filter((m) => m.pipeline_lost === 'bad_churn')
    return sortMembers(list, sort)
  }, [filtered, sort])

  const goodChurn = useMemo(() => {
    const list = filtered.filter((m) => m.pipeline_lost === 'good_churn')
    return sortMembers(list, sort)
  }, [filtered, sort])

  const regular = useMemo(() => {
    const list = filtered.filter((m) => !m.pipeline_lost)
    return sortMembers(list, sort)
  }, [filtered, sort])

  const visibleRegular = regular.slice(0, visibleCount)
  const hasMore = visibleCount < regular.length

  function handleSort(column: SortColumn) {
    setSort((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc',
    }))
  }

  function handleToggleExpand(memberId: string, memberDbId: string) {
    if (expandedId === memberId) {
      setExpandedId(null)
    } else {
      setExpandedId(memberId)
      onExpandMember(memberDbId)
    }
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
      {/* Filter bar */}
      <div className="p-3 flex flex-wrap items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <FilterSelect value={gymFilter} onChange={setGymFilter} options={uniqueGyms} placeholder="All Gyms" />
        {activeTiers.size > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: 'var(--bg3)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Tier:</span>
            {TIER_ORDER.filter((t) => activeTiers.has(t)).map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium"
                style={{ background: TIER_CONFIG[t].bg, color: TIER_CONFIG[t].color }}
              >
                {TIER_CONFIG[t].label}
              </span>
            ))}
          </div>
        )}
        <FilterSelect value={coachFilter} onChange={setCoachFilter} options={uniqueCoaches} placeholder="All Coaches" />
        <FilterSelect value={renewalLeadFilter} onChange={setRenewalLeadFilter} options={uniqueRLs} placeholder="All Renewal Leads" />
        <FilterSelect
          value={pipelineFilter}
          onChange={setPipelineFilter}
          options={['bad_churn', 'good_churn', 'none']}
          labels={['Bad Churn', 'Good Churn', 'No Flag']}
          placeholder="All Flags"
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search member..." className="w-48" />
        <span className="ml-auto text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} member{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  title={col.tooltip}
                  onClick={() => handleSort(col.key)}
                  className="px-3 py-2 text-xs font-semibold cursor-pointer select-none whitespace-nowrap"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg3)' }}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <SortIcon active={sort.column === col.key} direction={sort.direction} />
                  </span>
                </th>
              ))}
              <th title="Pipeline lost (member_churn_risk.pipeline_lost): manager flag — bad_churn (projected bad / saveable) vs good_churn (projected good / expected to leave). Empty if unset." className="px-3 py-2 text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--text-muted)', background: 'var(--bg3)' }}>
                Pipeline lost flag
              </th>
              <th title="How the member's risk score has changed over the last 8 weeks." className="px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)', background: 'var(--bg3)' }}>
                Trend
              </th>
              <th title="Plain-English explanation of why this member is at risk (only generated for scores 60+)." className="px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)', background: 'var(--bg3)' }}>
                AI Summary
              </th>
            </tr>
          </thead>

          <tbody>
            {badChurn.length > 0 && (
              <>
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-1.5 text-xs font-semibold"
                    style={{ background: 'var(--red-bg)', color: 'var(--red)', borderBottom: '1px solid var(--red-border)' }}
                  >
                    Projected Bad Churn ({badChurn.length})
                  </td>
                </tr>
                {badChurn.map((m) => (
                  <ChurnRow
                    key={m.id}
                    member={m}
                    history={historyMap.get(m.member_id) ?? []}
                    attendance={attendanceMap.get(m.member_id)}
                    expanded={expandedId === m.id}
                    onToggle={() => handleToggleExpand(m.id, m.member_id)}
                  />
                ))}
              </>
            )}

            {goodChurn.length > 0 && (
              <>
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-1.5 text-xs font-semibold"
                    style={{ background: 'var(--green-bg)', color: 'var(--green)', borderBottom: '1px solid var(--green-border)' }}
                  >
                    Projected Good Churn ({goodChurn.length})
                  </td>
                </tr>
                {goodChurn.map((m) => (
                  <ChurnRow
                    key={m.id}
                    member={m}
                    history={historyMap.get(m.member_id) ?? []}
                    attendance={attendanceMap.get(m.member_id)}
                    expanded={expandedId === m.id}
                    onToggle={() => handleToggleExpand(m.id, m.member_id)}
                  />
                ))}
              </>
            )}

            {regular.length > 0 && (badChurn.length > 0 || goodChurn.length > 0) && (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-1.5 text-xs font-semibold"
                  style={{ background: 'var(--bg3)', color: 'var(--text-muted)' }}
                >
                  All Members ({regular.length})
                </td>
              </tr>
            )}
            {visibleRegular.map((m) => (
              <ChurnRow
                key={m.id}
                member={m}
                history={historyMap.get(m.member_id) ?? []}
                attendance={attendanceMap.get(m.member_id)}
                expanded={expandedId === m.id}
                onToggle={() => handleToggleExpand(m.id, m.member_id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="p-3 text-center" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{
              background: 'var(--bg3)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
            }}
          >
            Load more
          </button>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Showing {Math.min(visibleCount, regular.length)} of {regular.length}
          </p>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No members match the current filters.
          </p>
        </div>
      )}
    </div>
  )
}

function FilterSelect({
  value,
  onChange,
  options,
  labels,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  labels?: string[]
  placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg py-1.5 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/40"
      style={{
        background: 'var(--bg3)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((opt, i) => (
        <option key={opt} value={opt}>
          {labels ? labels[i] : opt}
        </option>
      ))}
    </select>
  )
}

function SortIcon({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  if (!active) {
    return (
      <svg className="w-3 h-3 opacity-30" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 2l3 4H3zM6 10l-3-4h6z" />
      </svg>
    )
  }
  return (
    <svg className="w-3 h-3" viewBox="0 0 12 12" style={{ color: 'var(--color-gold)' }} fill="currentColor">
      {direction === 'asc' ? <path d="M6 2l3 4H3z" /> : <path d="M6 10l-3-4h6z" />}
    </svg>
  )
}
