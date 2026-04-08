import { useState, useMemo, type ReactNode } from 'react'
import type { CollapseState, NoteType } from './types'
import type { MemberWithMemberships } from './hooks/useWorkbookMembers'
import {
  sortMembersList,
  type SortColumn,
  type SortDirection,
} from './lib/memberSort'
import { CollapseToggle } from './CollapseToggle'
import { ExpandNotesToggle } from './ExpandNotesToggle'
import { MemberRow } from './MemberRow'
import { useNotes } from './hooks/useNotes'
import { useSessions } from './hooks/useSessions'

interface Props {
  members: MemberWithMemberships[]
  selectedCoachIds: string[]
  activeOnly: boolean
  collapse: CollapseState
  onToggleCollapse: (key: keyof CollapseState) => void
  expandAllNotes: boolean
  onToggleExpandAllNotes: () => void
  loading: boolean
}

export function MemberTable({
  members,
  selectedCoachIds,
  activeOnly,
  collapse,
  onToggleCollapse,
  expandAllNotes,
  onToggleExpandAllNotes,
  loading,
}: Props) {
  const memberIds = useMemo(() => members.map((m) => m.memberId), [members])

  const {
    notesMap,
    updateNote,
    createNote,
    catalogAndCreate,
    createAndCheckin,
    toggleCheckin,
    clearAllCheckins,
  } = useNotes(memberIds, selectedCoachIds)

  const { statsMap, monthFullWeeks } = useSessions(memberIds)

  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDir, setSortDir] = useState<SortDirection>('asc')

  const sortedMembers = useMemo(() => {
    const sorted = sortMembersList(members, sortColumn, sortDir, statsMap, notesMap, monthFullWeeks)
    return activeOnly ? sorted.filter((m) => !m.isExpired) : sorted
  }, [members, sortColumn, sortDir, statsMap, notesMap, monthFullWeeks, activeOnly])

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDir('asc')
    }
  }

  const personalNoteIds = useMemo(() => {
    const ids: string[] = []
    for (const m of members) {
      const memberNotes = notesMap.get(m.memberId)
      const pn = memberNotes?.get('general notes' as NoteType)
      if (pn) ids.push(pn.id)
    }
    return ids
  }, [members, notesMap])

  function handleClearAll() {
    void clearAllCheckins(personalNoteIds)
  }

  if (selectedCoachIds.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        Select one or more coaches to view their clients
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        Loading members...
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        No members found for the selected filters
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Collapse toggles and clear button */}
      <div className="flex flex-wrap items-center gap-2">
        <CollapseToggle
          label="Sessions"
          expanded={collapse.sessions}
          onToggle={() => onToggleCollapse('sessions')}
        />
        <CollapseToggle
          label="Memberships"
          expanded={collapse.memberships}
          onToggle={() => onToggleCollapse('memberships')}
        />
        <CollapseToggle
          label="Goals & Habits"
          expanded={collapse.goalsHabits}
          onToggle={() => onToggleCollapse('goalsHabits')}
        />
        <div className="ml-auto flex items-center gap-2">
          <ExpandNotesToggle expanded={expandAllNotes} onToggle={onToggleExpandAllNotes} />
          <ClearAllButton onClear={handleClearAll} count={personalNoteIds.length} />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-left">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs">
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3">
                <SortableTh
                  column="name"
                  sortColumn={sortColumn}
                  sortDir={sortDir}
                  onSort={handleSort}
                  align="left"
                >
                  Name
                </SortableTh>
              </th>
              <th className="px-4 py-3 text-center">
                <SortableTh
                  column="sessWk"
                  sortColumn={sortColumn}
                  sortDir={sortDir}
                  onSort={handleSort}
                  align="center"
                >
                  Sess/wk
                </SortableTh>
              </th>
              {collapse.sessions && (
                <>
                  <th className="px-4 py-3 text-center">
                    <SortableTh
                      column="lastWk"
                      sortColumn={sortColumn}
                      sortDir={sortDir}
                      onSort={handleSort}
                      align="center"
                    >
                      Last wk
                    </SortableTh>
                  </th>
                  <th className="px-4 py-3 text-center">
                    <SortableTh
                      column="pctLastWk"
                      sortColumn={sortColumn}
                      sortDir={sortDir}
                      onSort={handleSort}
                      align="center"
                    >
                      % Last wk
                    </SortableTh>
                  </th>
                  <th className="px-4 py-3 text-center">
                    <SortableTh
                      column="monthPct"
                      sortColumn={sortColumn}
                      sortDir={sortDir}
                      onSort={handleSort}
                      align="center"
                    >
                      Month %
                    </SortableTh>
                  </th>
                </>
              )}
              {collapse.memberships && (
                <>
                  <th className="px-4 py-3 text-left text-gray-500 font-semibold">Primary</th>
                  <th className="px-4 py-3 text-left text-gray-500 font-semibold">Secondary</th>
                </>
              )}
              <th className="px-4 py-3 text-left text-gray-500 font-semibold">Personal Notes</th>
              <th className="px-4 py-3 text-left text-gray-500 font-semibold">Team Notes</th>
              {collapse.goalsHabits && (
                <>
                  <th className="px-4 py-3 text-left text-gray-500 font-semibold">Goals</th>
                  <th className="px-4 py-3 text-left text-gray-500 font-semibold">Habits</th>
                </>
              )}
              <th className="px-4 py-3">
                <SortableTh
                  column="expiry"
                  sortColumn={sortColumn}
                  sortDir={sortDir}
                  onSort={handleSort}
                  align="left"
                >
                  Expiry
                </SortableTh>
              </th>
              <th className="px-4 py-3 text-center">
                <SortableTh
                  column="checkin"
                  sortColumn={sortColumn}
                  sortDir={sortDir}
                  onSort={handleSort}
                  align="center"
                >
                  Check-in
                </SortableTh>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedMembers.map((m) => {
              const memberNotes = notesMap.get(m.memberId)
              const effectiveCoachId =
                m.primaryMembership?.handoff_coach_id ??
                m.primaryMembership?.coach_id ??
                selectedCoachIds[0]

              return (
                <MemberRow
                  key={m.memberId}
                  member={m}
                  personalNote={memberNotes?.get('general notes' as NoteType) ?? null}
                  teamNote={memberNotes?.get('team' as NoteType) ?? null}
                  latestGoal={memberNotes?.get('goal' as NoteType) ?? null}
                  latestHabits={memberNotes?.get('habits' as NoteType) ?? null}
                  sessionStats={statsMap.get(m.memberId) ?? null}
                  monthFullWeeks={monthFullWeeks}
                  collapse={collapse}
                  onUpdateNote={(id, c) => void updateNote(id, c)}
                  onCreateNote={(mId, cId, type, c) => void createNote(mId, cId, type, c)}
                  onCatalogNote={(mId, cId, type, c) => void catalogAndCreate(mId, cId, type, c)}
                  onToggleCheckin={(id, cur) => void toggleCheckin(id, cur)}
                  onCreateAndCheckin={(mId, cId) => void createAndCheckin(mId, cId)}
                  effectiveCoachId={effectiveCoachId ?? selectedCoachIds[0]}
                  expandAllNotes={expandAllNotes}
                  isExpired={m.isExpired}
                />
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span>
          {sortedMembers.length} member{sortedMembers.length !== 1 ? 's' : ''}
        </span>
        {!activeOnly && members.filter((m) => m.isExpired).length > 0 && (
          <span className="text-gray-300">
            (including {members.filter((m) => m.isExpired).length} inactive)
          </span>
        )}
      </div>
    </div>
  )
}

function SortableTh({
  column,
  sortColumn,
  sortDir,
  onSort,
  align,
  children,
}: {
  column: SortColumn
  sortColumn: SortColumn | null
  sortDir: SortDirection
  onSort: (c: SortColumn) => void
  align: 'left' | 'center'
  children: ReactNode
}) {
  const active = sortColumn === column
  const justify = align === 'center' ? 'justify-center' : 'justify-start'
  return (
    <th className="px-0 py-0">
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`group inline-flex w-full items-center gap-1 font-semibold transition-colors hover:text-gray-800 ${justify} ${
          active ? 'text-blue-700' : 'text-gray-500'
        }`}
      >
        {children}
        <span className="text-[10px] opacity-60">
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  )
}

function ClearAllButton({ onClear, count }: { onClear: () => void; count: number }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <>
      {confirming ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onClear()
              setConfirming(false)
            }}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700"
          >
            Confirm clear ({count})
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Clear all check-ins
        </button>
      )}
    </>
  )
}
