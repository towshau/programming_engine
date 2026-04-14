import { useState, useMemo } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { useDebounce } from '../../hooks/useDebounce'
import { SearchInput } from '../ui/SearchInput'
import { Badge } from '../ui/Badge'
import { cn, getInitials } from '../../lib/utils'
import type { MemberWithCoach, ProgramStatus, MembershipStatus } from '../../types/database'

type StatusFilter = 'all' | 'active' | 'needs_program' | 'new_member' | 'inactive'

const STATUS_DOT_CLASS: Record<ProgramStatus, string> = {
  has_program: 'bg-emerald-500',
  needs_program: 'bg-amber-500',
  new_member: 'bg-red-500',
}

function getStatusDotClass(membership: MembershipStatus, program: ProgramStatus) {
  if (membership !== 'active') return 'bg-zinc-600'
  return STATUS_DOT_CLASS[program]
}

interface MemberSidebarProps {
  onSelectMember?: (member: MemberWithCoach | null) => void
  /** 'intake' uses members filtered by membership coach_id; default 'programming' uses programming_coach_id */
  source?: 'programming' | 'intake'
}

function ChevronLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

export function MemberSidebar({ onSelectMember, source = 'programming' }: MemberSidebarProps = {}) {
  const {
    selectedCoach,
    coaches,
    members,
    intakeMembers,
    selectedMember,
    selectMember,
    loading,
  } = useEditorStore()

  const memberList = source === 'intake' ? intakeMembers : members

  const [collapsed, setCollapsed] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  /** Programming coach filter (Program Editor sidebar only). */
  const [pcFilter, setPcFilter] = useState<string>('all')
  const debouncedQuery = useDebounce(query, 300)

  function handleSelect(member: MemberWithCoach) {
    if (onSelectMember) {
      onSelectMember(member)
    } else {
      selectMember(member)
    }
  }

  const filtered = useMemo(() => {
    let list = memberList

    if (source === 'programming' && pcFilter !== 'all') {
      list = list.filter((m) => m.programming_coach_id === pcFilter)
    }

    if (statusFilter !== 'all') {
      list = list.filter((m) => {
        switch (statusFilter) {
          case 'active':
            return m.membership_status === 'active'
          case 'needs_program':
            return m.membership_status === 'active' && m.program_status === 'needs_program'
          case 'new_member':
            return m.is_new
          case 'inactive':
            return m.membership_status !== 'active'
          default:
            return true
        }
      })
    }

    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase()
      list = list.filter(
        (m) =>
          m.member_name.toLowerCase().includes(q) ||
          m.first_name.toLowerCase().includes(q) ||
          m.last_name.toLowerCase().includes(q)
      )
    }

    return list
  }, [memberList, debouncedQuery, statusFilter, source, pcFilter])

  const counts = useMemo(() => {
    const active = memberList.filter((m) => m.membership_status === 'active')
    return {
      all: memberList.length,
      active: active.length,
      needs_program: active.filter((m) => m.program_status === 'needs_program').length,
      new_member: memberList.filter((m) => m.is_new).length,
      inactive: memberList.filter((m) => m.membership_status !== 'active').length,
    }
  }, [memberList])

  const filters: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'new_member', label: 'New', count: counts.new_member },
    { key: 'needs_program', label: 'Needs Program', count: counts.needs_program },
    { key: 'inactive', label: 'Inactive', count: counts.inactive },
  ]

  return (
    <div className="relative flex h-full flex-shrink-0">
      {/* Collapsed state: slim rail with expand button */}
      {collapsed && (
        <div
          className="flex flex-col items-center w-10 border-r bg-white flex-shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            onClick={() => setCollapsed(false)}
            className="mt-3 p-1.5 rounded-md transition-colors hover:bg-[var(--bg3)]"
            style={{ color: 'var(--text-muted)' }}
            title="Expand member list"
          >
            <ChevronRightIcon />
          </button>
          {/* Show selected member initial as indicator */}
          {selectedMember && (
            <div
              className="mt-3 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
              style={{ background: 'rgba(184,134,11,0.15)', color: 'var(--color-gold)', border: '1px solid rgba(184,134,11,0.25)' }}
              title={`${selectedMember.first_name} ${selectedMember.last_name}`}
            >
              {getInitials(selectedMember.first_name, selectedMember.last_name)}
            </div>
          )}
        </div>
      )}

      {/* Expanded panel */}
      <aside
        className={cn(
          'flex flex-col bg-white border-r overflow-hidden transition-all duration-200',
          collapsed ? 'w-0 min-w-0 opacity-0 pointer-events-none' : 'w-72 min-w-72 opacity-100'
        )}
        style={{ borderColor: 'var(--border)' }}
      >
        {/* Header with search, filters, and collapse button */}
        <div className="p-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search members..."
              />
            </div>
            <button
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-md flex-shrink-0 transition-colors hover:bg-[var(--bg3)]"
              style={{ color: 'var(--text-muted)' }}
              title="Collapse member list"
            >
              <ChevronLeftIcon />
            </button>
          </div>
          {source === 'programming' && (
            <div className="mt-2">
              <label className="sr-only" htmlFor="member-sidebar-pc-filter">
                Filter by programming coach
              </label>
              <select
                id="member-sidebar-pc-filter"
                value={pcFilter}
                onChange={(e) => setPcFilter(e.target.value)}
                className="w-full rounded-md border px-2 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-[var(--color-gold)]"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--bg2)',
                  color: 'var(--text)',
                }}
              >
                <option value="all">All programming coaches</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors border',
                  statusFilter === f.key
                    ? 'text-white border-transparent'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] bg-[var(--bg3)]'
                )}
                style={statusFilter === f.key ? { background: 'var(--text)', borderColor: 'var(--text)' } : {}}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            {filtered.length} {filtered.length === 1 ? 'member' : 'members'}
            {!selectedCoach && ' (all coaches)'}
          </p>
        </div>

        {/* Member list */}
        <div className="flex-1 overflow-y-auto">
          {loading.members ? (
            <div className="flex items-center justify-center py-8">
              <div
                className="h-5 w-5 animate-spin rounded-full border-2"
                style={{ borderColor: 'var(--border)', borderTopColor: 'var(--color-gold)' }}
              />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
              No members found
            </p>
          ) : (
            filtered.map((member) => {
              const isInactive = member.membership_status !== 'active'
              const isSelected = selectedMember?.member_id === member.member_id
              const pcCoach =
                source === 'programming'
                  ? coaches.find((c) => c.id === member.programming_coach_id)
                  : undefined
              return (
                <button
                  key={member.member_id}
                  onClick={() => handleSelect(member)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-l-2',
                    isInactive && 'opacity-40',
                  )}
                  style={{
                    background: isSelected ? 'rgba(184,134,11,0.06)' : undefined,
                    borderLeftColor: isSelected ? 'var(--color-gold)' : 'transparent',
                  }}
                  onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg3)' }}
                  onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = '' }}
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                      style={{
                        background: isSelected ? 'rgba(184,134,11,0.15)' : 'var(--bg3)',
                        color: isSelected ? 'var(--color-gold)' : 'var(--text-muted)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {getInitials(member.first_name, member.last_name)}
                    </div>
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white',
                        getStatusDotClass(member.membership_status, member.program_status)
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: isSelected ? 'var(--color-gold)' : 'var(--text)' }}
                    >
                      {member.first_name} {member.last_name}
                    </p>
                    {member.gym && (
                      <Badge variant="default" className="mt-0.5">
                        {member.gym}
                      </Badge>
                    )}
                    {source === 'programming' && (
                      <span
                        className="mt-0.5 block truncate text-[10px] leading-snug"
                        style={{ color: 'var(--text-muted)' }}
                        title={
                          pcCoach
                            ? `Programming coach: ${pcCoach.first_name} ${pcCoach.last_name}`
                            : 'No programming coach assigned'
                        }
                      >
                        PC:{' '}
                        {pcCoach
                          ? `${pcCoach.first_name} ${pcCoach.last_name}`
                          : member.programming_coach_id
                            ? 'Unknown coach'
                            : 'Unassigned'}
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </aside>
    </div>
  )
}
