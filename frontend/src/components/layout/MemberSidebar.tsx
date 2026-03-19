import { useState, useMemo } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { useDebounce } from '../../hooks/useDebounce'
import { SearchInput } from '../ui/SearchInput'
import { Badge } from '../ui/Badge'
import { cn, getInitials } from '../../lib/utils'
import type { ProgramStatus, MembershipStatus } from '../../types/database'

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

export function MemberSidebar() {
  const {
    selectedCoach,
    members,
    selectedMember,
    selectMember,
    loading,
  } = useEditorStore()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const debouncedQuery = useDebounce(query, 300)

  const filtered = useMemo(() => {
    let list = members

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
  }, [members, debouncedQuery, statusFilter])

  const counts = useMemo(() => {
    const active = members.filter((m) => m.membership_status === 'active')
    return {
      all: members.length,
      active: active.length,
      needs_program: active.filter((m) => m.program_status === 'needs_program').length,
      new_member: members.filter((m) => m.is_new).length,
      inactive: members.filter((m) => m.membership_status !== 'active').length,
    }
  }, [members])

  const filters: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'new_member', label: 'New', count: counts.new_member },
    { key: 'needs_program', label: 'Needs Program', count: counts.needs_program },
    { key: 'inactive', label: 'Inactive', count: counts.inactive },
  ]

  return (
    <aside className="w-72 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
      <div className="p-3 border-b border-zinc-800">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search members..."
        />
        <div className="mt-2 flex flex-wrap gap-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors',
                statusFilter === f.key
                  ? 'bg-zinc-600 text-zinc-100'
                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
              )}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">
          {filtered.length} {filtered.length === 1 ? 'member' : 'members'}
          {!selectedCoach && ' (all coaches)'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading.members ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-500" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">
            No members found
          </p>
        ) : (
          filtered.map((member) => {
            const isInactive = member.membership_status !== 'active'
            return (
              <button
                key={member.member_id}
                onClick={() => selectMember(member)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                  'hover:bg-zinc-800/50',
                  selectedMember?.member_id === member.member_id &&
                    'bg-zinc-800 border-l-2 border-emerald-500',
                  isInactive && 'opacity-40'
                )}
              >
                <div className="relative flex-shrink-0">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
                    isInactive ? 'bg-zinc-800 text-zinc-600' : 'bg-zinc-700 text-zinc-300'
                  )}>
                    {getInitials(member.first_name, member.last_name)}
                  </div>
                  <span
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900',
                      getStatusDotClass(member.membership_status, member.program_status)
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    'text-sm font-medium truncate',
                    isInactive ? 'text-zinc-600' : 'text-zinc-200'
                  )}>
                    {member.first_name} {member.last_name}
                  </p>
                  {member.gym && (
                    <Badge variant="default" className="mt-0.5">
                      {member.gym}
                    </Badge>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}
