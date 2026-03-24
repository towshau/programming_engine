import type { GeneratedProgram, PastProgramInfo } from '../../types'
import { useEditorStore } from '../../stores/editorStore'
import { Badge } from '../../components/ui/Badge'
import { ProgramConfigEditor } from './ProgramConfigEditor'
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
  const { activeView, setActiveView } = useEditorStore()

  const expiresDate = pastProgramInfo && previousProgram
    ? computeExpiresDate(previousProgram, program)
    : null

  const nextExpiresDate = (() => {
    if (program.next_due_date) {
      const d = new Date(program.next_due_date)
      d.setDate(d.getDate() - 1)
      return d
    }
    if (program.created_at && program.duration_weeks) {
      const d = new Date(program.created_at)
      d.setDate(d.getDate() + program.duration_weeks * 7)
      return d
    }
    return null
  })()

  const isLastActive = activeView === 'last'
  const isNextActive = activeView === 'next'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h2 className="text-xl font-semibold text-zinc-100">{memberName}</h2>
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

      {/* Last program — clickable tab */}
      {pastProgramInfo && (
        <button
          type="button"
          onClick={() => setActiveView('last')}
          className={cn(
            'w-full text-left rounded-lg p-3 space-y-2 transition-all cursor-pointer',
            isLastActive
              ? 'border border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/20'
              : 'border border-zinc-700/60 bg-zinc-800/40 hover:border-zinc-600/80',
          )}
        >
          <div className="flex items-center justify-between">
            <span className={cn(
              'text-[10px] font-semibold uppercase tracking-wider',
              isLastActive ? 'text-blue-400' : 'text-zinc-500',
            )}>
              Last Program
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-zinc-600">
                {pastProgramInfo.source === 'generated' ? 'Generated ' : ''}
                {formatDateAU(pastProgramInfo.created_at)}
              </span>
              {expiresDate && (
                <span className={cn(
                  'text-[10px]',
                  expiresDate < new Date() ? 'text-red-400/70' : 'text-zinc-500',
                )}>
                  Expires {expiresDate.toLocaleDateString('en-AU')}
                </span>
              )}
            </div>
          </div>
          <PastProgramBadges info={pastProgramInfo} />
        </button>
      )}

      {/* Next / current program — clickable tab */}
      <button
        type="button"
        onClick={() => setActiveView('next')}
        className={cn(
          'w-full text-left rounded-lg p-3 space-y-2 transition-all cursor-pointer',
          isNextActive
            ? 'border border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20'
            : 'border border-zinc-700/60 bg-zinc-800/40 hover:border-zinc-600/80',
        )}
      >
        <div className="flex items-center justify-between">
          <span className={cn(
            'text-[10px] font-semibold uppercase tracking-wider',
            isNextActive ? 'text-emerald-400' : 'text-zinc-500',
          )}>
            {pastProgramInfo ? 'Next Program' : 'Current Program'}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-500">
              Generated {formatDateAU(program.created_at)}
            </span>
            {nextExpiresDate && (
              <span className={cn(
                'text-[10px]',
                nextExpiresDate < new Date() ? 'text-red-400/70' : 'text-blue-400/70',
              )}>
                Expires {nextExpiresDate.toLocaleDateString('en-AU')}
              </span>
            )}
          </div>
        </div>
        {isNextActive && <ProgramConfigEditor />}
      </button>

      {program.changes_summary && (
        <div className="rounded-lg bg-zinc-800/50 border border-zinc-700 px-3 py-2 text-sm text-zinc-300">
          {program.changes_summary}
        </div>
      )}
    </div>
  )
}
