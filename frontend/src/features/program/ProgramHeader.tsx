import type { GeneratedProgram, PastProgramInfo } from '../../types'
import { useEditorStore } from '../../stores/editorStore'
import { Badge } from '../../components/ui/Badge'
import { cn } from '../../lib/utils'

interface ProgramHeaderProps {
  program: GeneratedProgram
  previousProgram: GeneratedProgram | null
  pastProgramInfo: PastProgramInfo | null
  memberName: string
  editCount: number
}

function formatDateAU(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU')
}

function computeExpiresDate(
  previousProgram: GeneratedProgram | null,
  currentProgram: GeneratedProgram,
): Date | null {
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
}: ProgramHeaderProps) {
  const { lastProgramExpanded, toggleLastProgram } = useEditorStore()

  const expiresDate = pastProgramInfo && previousProgram
    ? computeExpiresDate(previousProgram, program)
    : null

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>{memberName}</h2>
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
          {program.next_due_date && (
            <Badge variant="teal">
              Next: {new Date(program.next_due_date).toLocaleDateString('en-AU')}
            </Badge>
          )}
          {editCount > 0 && (
            <Badge variant="amber">
              {editCount} edit{editCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Last program — collapsible card */}
      {pastProgramInfo && (
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
