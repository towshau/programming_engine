import { useState, useMemo } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { useDebounce } from '../../hooks/useDebounce'
import { SearchInput } from '../ui/SearchInput'
import { Badge } from '../ui/Badge'
import { cn, getInitials } from '../../lib/utils'

export function MemberSidebar() {
  const {
    selectedCoach,
    members,
    selectedMember,
    selectMember,
    loading,
  } = useEditorStore()
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  const filtered = useMemo(() => {
    if (!debouncedQuery) return members
    const q = debouncedQuery.toLowerCase()
    return members.filter(
      (m) =>
        m.member_name.toLowerCase().includes(q) ||
        m.first_name.toLowerCase().includes(q) ||
        m.last_name.toLowerCase().includes(q)
    )
  }, [members, debouncedQuery])

  if (!selectedCoach) {
    return (
      <aside className="w-72 border-r border-zinc-800 bg-zinc-900/50 flex flex-col items-center justify-center p-6">
        <p className="text-sm text-zinc-500 text-center">
          Select a coach to view their clients
        </p>
      </aside>
    )
  }

  return (
    <aside className="w-72 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
      <div className="p-3 border-b border-zinc-800">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search members..."
        />
        <p className="mt-2 text-xs text-zinc-500">
          {members.length} {members.length === 1 ? 'member' : 'members'}
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
          filtered.map((member) => (
            <button
              key={member.member_id}
              onClick={() => selectMember(member)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                'hover:bg-zinc-800/50',
                selectedMember?.member_id === member.member_id &&
                  'bg-zinc-800 border-l-2 border-emerald-500'
              )}
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-300">
                {getInitials(member.first_name, member.last_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-200 truncate">
                  {member.first_name} {member.last_name}
                </p>
                {member.gym && (
                  <Badge variant="default" className="mt-0.5">
                    {member.gym}
                  </Badge>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  )
}
