import type { Note, NoteType, CollapseState } from './types'
import type { MemberWithMemberships } from './hooks/useWorkbookMembers'
import { NoteCell } from './NoteCell'
import { CheckinBox } from './CheckinBox'

interface SessionStats {
  lastWeekActual: number
  monthActual: number
}

interface Props {
  member: MemberWithMemberships
  personalNote: Note | null
  teamNote: Note | null
  latestGoal: Note | null
  latestHabits: Note | null
  sessionStats: SessionStats | null
  monthFullWeeks: number
  collapse: CollapseState
  onUpdateNote: (noteId: string, content: string) => void
  onCreateNote: (memberId: string, coachId: string, noteType: NoteType, content: string) => void
  onCatalogNote: (memberId: string, coachId: string, noteType: NoteType, content: string) => void
  onToggleCheckin: (noteId: string, current: boolean) => void
  onCreateAndCheckin: (memberId: string, coachId: string) => void
  effectiveCoachId: string
  expandAllNotes: boolean
  isExpired: boolean
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function lastWeekPct(contracted: number, lastWeekActual: number): string {
  if (contracted <= 0) return '-'
  const pct = Math.round((lastWeekActual / contracted) * 100)
  return `${pct}%`
}

function monthAttendancePct(contracted: number, monthActual: number, fullWeeks: number): string {
  if (contracted <= 0 || fullWeeks <= 0) return '-'
  const expected = contracted * fullWeeks
  const pct = Math.round((monthActual / expected) * 100)
  return `${pct}%`
}

function pctColor(pctStr: string): string {
  if (pctStr === '-') return 'text-gray-400'
  const val = parseInt(pctStr, 10)
  if (val >= 100) return 'text-green-600'
  if (val >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

export function MemberRow({
  member,
  personalNote,
  teamNote,
  latestGoal,
  latestHabits,
  sessionStats,
  monthFullWeeks,
  collapse,
  onUpdateNote,
  onCreateNote,
  onCatalogNote,
  onToggleCheckin,
  onCreateAndCheckin,
  effectiveCoachId,
  expandAllNotes,
  isExpired,
}: Props) {
  const weekPctStr = lastWeekPct(member.contractedSessions, sessionStats?.lastWeekActual ?? 0)
  const monthPctStr = monthAttendancePct(
    member.contractedSessions,
    sessionStats?.monthActual ?? 0,
    monthFullWeeks
  )

  function handleNoteSave(
    note: Note | null,
    noteType: NoteType,
    content: string,
    catalog: boolean
  ) {
    if (catalog) {
      onCatalogNote(member.memberId, effectiveCoachId, noteType, content)
    } else if (note) {
      onUpdateNote(note.id, content)
    } else {
      onCreateNote(member.memberId, effectiveCoachId, noteType, content)
    }
  }

  const dimmed = isExpired ? 'opacity-40' : ''
  const rowBg = isExpired ? 'bg-gray-50' : ''
  const stickyBg = isExpired ? 'bg-gray-50' : 'bg-white'

  return (
    <tr className={`border-b border-gray-100 hover:bg-gray-50/50 ${rowBg}`}>
      {/* Member Name */}
      <td className={`sticky left-0 z-10 px-4 py-3 ${stickyBg}`}>
        <div className={`flex flex-col ${dimmed}`}>
          <span className="text-sm font-medium text-gray-800">{member.memberName}</span>
          {isExpired && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-red-400">
              expired
            </span>
          )}
        </div>
      </td>

      {/* Sessions/wk (contracted) */}
      <td className={`px-4 py-3 text-center text-sm text-gray-600 ${dimmed}`}>
        {member.contractedSessions || '-'}
      </td>

      {/* Last Week Actual (collapsible) */}
      {collapse.sessions && (
        <>
          <td className={`px-4 py-3 text-center text-sm text-gray-600 ${dimmed}`}>
            {sessionStats?.lastWeekActual ?? 0}
          </td>
          <td className={`px-4 py-3 text-center text-sm font-medium ${pctColor(weekPctStr)} ${dimmed}`}>
            {weekPctStr}
          </td>
          <td className={`px-4 py-3 text-center text-sm font-medium ${pctColor(monthPctStr)} ${dimmed}`}>
            {monthPctStr}
          </td>
        </>
      )}

      {/* Primary Membership (collapsible) */}
      {collapse.memberships && (
        <>
          <td className={`px-4 py-3 text-sm text-gray-600 ${dimmed}`}>
            {member.primaryMembership?.membership_types?.name ?? '-'}
          </td>
          <td className={`px-4 py-3 text-sm text-gray-500 ${dimmed}`}>
            {member.secondaryMemberships.length > 0
              ? member.secondaryMemberships
                  .map((s) => s.membership_types?.name ?? 'Unknown')
                  .join(', ')
              : '-'}
          </td>
        </>
      )}

      {/* Personal Notes */}
      <td className="min-w-[160px] px-4 py-3">
        <NoteCell
          content={personalNote?.note_content ?? ''}
          label="Personal Notes"
          expandAll={expandAllNotes}
          onSave={(c) => handleNoteSave(personalNote, 'general notes', c, false)}
        />
      </td>

      {/* Team Notes */}
      <td className="min-w-[160px] px-4 py-3">
        <NoteCell
          content={teamNote?.note_content ?? ''}
          label="Team Notes"
          expandAll={expandAllNotes}
          onSave={(c) => handleNoteSave(teamNote, 'team', c, false)}
        />
      </td>

      {/* Goals (collapsible) */}
      {collapse.goalsHabits && (
        <>
          <td className="min-w-[160px] px-4 py-3">
            <NoteCell
              content={latestGoal?.note_content ?? ''}
              label="Goals"
              expandAll={expandAllNotes}
              onSave={(c) => handleNoteSave(latestGoal, 'goal', c, true)}
            />
          </td>
          <td className="min-w-[160px] px-4 py-3">
            <NoteCell
              content={latestHabits?.note_content ?? ''}
              label="Habits"
              expandAll={expandAllNotes}
              onSave={(c) => handleNoteSave(latestHabits, 'habits', c, true)}
            />
          </td>
        </>
      )}

      {/* Membership Expiry */}
      <td className={`whitespace-nowrap px-4 py-3 text-sm text-gray-500 ${dimmed}`}>
        {formatDate(member.membershipExpiry)}
      </td>

      {/* Check-in */}
      <td className="px-4 py-3 text-center">
        {personalNote ? (
          <CheckinBox
            checked={personalNote.checkin_1 ?? false}
            onChange={() => onToggleCheckin(personalNote.id, personalNote.checkin_1 ?? false)}
          />
        ) : (
          <CheckinBox
            checked={false}
            onChange={() => onCreateAndCheckin(member.memberId, effectiveCoachId)}
          />
        )}
      </td>
    </tr>
  )
}
