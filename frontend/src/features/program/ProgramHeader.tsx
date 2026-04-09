import type { GeneratedProgram, PastProgramInfo } from '../../types'
import { useEditorStore, type ProgramViewMode } from '../../stores/editorStore'
import { Badge } from '../../components/ui/Badge'
import { cn } from '../../lib/utils'

interface ProgramHeaderProps {
  program: GeneratedProgram
  previousProgram: GeneratedProgram | null
  pastProgramInfo: PastProgramInfo | null
  memberName: string
  editCount: number
  programViewMode: ProgramViewMode
  onViewModeChange: (mode: ProgramViewMode) => void
}

function formatDateAU(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU')
}

function computeExpiresDate(
  previousProgram: GeneratedProgram | null,
  currentProgram: GeneratedProgram,
): Date | null {
  if (previousProgram?.end_date) {
    return new Date(previousProgram.end_date)
  }
  // Fallback if no end_date
  const ref = previousProgram?.next_due_date ?? currentProgram.created_at
  if (!ref) return null
  const d = new Date(ref)
  d.setDate(d.getDate() - 1)
  return d
}

function PastProgramBadges({ info }: { info: PastProgramInfo }) {
  if (info.source === 'generated') {
    return (
      <div className="flex flex-wrap gap-2">
        {info.scheme_name && (
          <Badge variant="blue">{info.scheme_name}</Badge>
        )}
        {info.rep_range && (
          <Badge variant="teal">{info.rep_range} reps</Badge>
        )}
        {info.phase_number != null && (
          <Badge variant="default">Phase {info.phase_number}</Badge>
        )}
        {info.sessions_per_week != null && (
          <Badge variant="default">{info.sessions_per_week}x / week</Badge>
        )}
        {info.duration_weeks != null && (
          <Badge variant="default">{info.duration_weeks} weeks</Badge>
        )}
        {info.confidence && (
          <Badge
            variant={
              info.confidence === 'high'
                ? 'emerald'
                : info.confidence === 'medium'
                  ? 'amber'
                  : 'red'
            }
          >
            {info.confidence} confidence
          </Badge>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Historical (TeamBuildr)</Badge>
      {info.session_count != null && (
        <Badge variant="default">{info.session_count} sessions</Badge>
      )}
      {info.rep_range && (
        <Badge variant="teal">{info.rep_range} reps</Badge>
      )}
      {info.date_range && (
        <Badge variant="default">
          {formatDateAU(info.date_range.from)} — {formatDateAU(info.date_range.to)}
        </Badge>
      )}
    </div>
  )
}

export function ProgramHeader({
  program,
  previousProgram,
  pastProgramInfo,
  memberName,
  editCount,
  programViewMode,
  onViewModeChange,
}: ProgramHeaderProps) {
  const { lastProgramExpanded, toggleLastProgram, subsequentPrograms, editingFutureProgram } = useEditorStore()

  const expiresDate = pastProgramInfo && previousProgram
    ? computeExpiresDate(previousProgram, program)
    : null

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>{memberName}</h2>
          <div
            className="flex gap-0.5 p-0.5 rounded-lg"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}
          >
            {(['day', 'weekly', 'timeline'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onViewModeChange(mode)}
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm font-semibold transition-all',
                  programViewMode === mode
                    ? 'text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                )}
                style={programViewMode === mode
                  ? { background: 'var(--color-gold)', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }
                  : {}
                }
              >
                {mode === 'day' ? 'Day View' : mode === 'weekly' ? 'Weekly View' : 'Timeline'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {program.coach_edited && (
            <Badge variant="blue">Edited</Badge>
          )}
          {program.coach_approved && (
            <Badge variant="emerald">Finalized</Badge>
          )}
          {program.uploaded_to_teambuildr && (
            <Badge variant="default">Uploaded</Badge>
          )}
          {editingFutureProgram ? (
            // When editing a future program, show its date range
            program.start_date && (
              <Badge variant="purple">
                {new Date(program.start_date).toLocaleDateString('en-AU')}
                {program.end_date ? ` – ${new Date(program.end_date).toLocaleDateString('en-AU')}` : ''}
              </Badge>
            )
          ) : (() => {
            let nextDate: Date | null = null
            if (subsequentPrograms?.length > 0 && subsequentPrograms[0].start_date) {
              nextDate = new Date(subsequentPrograms[0].start_date)
            } else if (program.end_date) {
              const d = new Date(program.end_date)
              const dow = d.getDay()
              if (dow !== 1) {
                d.setDate(d.getDate() + (dow === 0 ? 1 : 8 - dow))
              }
              nextDate = d
            } else if (program.next_due_date) {
              nextDate = new Date(program.next_due_date)
            }
            if (!nextDate) return null
            return (
              <Badge variant="teal">
                Next: {nextDate.toLocaleDateString('en-AU')}
              </Badge>
            )
          })()}
          {editCount > 0 && (
            <Badge variant="amber">
              {editCount} edit{editCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Last program — collapsible card (day view only, hidden when editing future) */}
      {!editingFutureProgram && pastProgramInfo && programViewMode === 'day' && (
        <button
          type="button"
          onClick={toggleLastProgram}
          className="w-full text-left rounded-lg p-3 space-y-2 transition-all cursor-pointer border"
          style={lastProgramExpanded
            ? { borderColor: 'var(--blue-border)', background: 'rgba(219,234,254,0.3)' }
            : { borderColor: 'var(--border)', background: 'var(--bg3)' }
          }
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className={cn('h-3 w-3 transition-transform', lastProgramExpanded && 'rotate-90')}
                style={{ color: lastProgramExpanded ? 'var(--blue)' : 'var(--text-muted)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: lastProgramExpanded ? 'var(--blue)' : 'var(--text-muted)' }}
              >
                Last Program
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {pastProgramInfo.source === 'generated' ? 'Generated ' : ''}
                {formatDateAU(pastProgramInfo.created_at)}
              </span>
              {expiresDate && (
                <span
                  className="text-[10px]"
                  style={{ color: expiresDate < new Date() ? 'var(--red)' : 'var(--text-muted)' }}
                >
                  Expires {expiresDate.toLocaleDateString('en-AU')}
                </span>
              )}
            </div>
          </div>
          <PastProgramBadges info={pastProgramInfo} />
        </button>
      )}
    </div>
  )
}
