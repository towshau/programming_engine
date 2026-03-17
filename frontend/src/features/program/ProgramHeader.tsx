import type { GeneratedProgram, PastProgramInfo } from '../../types'
import { Badge } from '../../components/ui/Badge'
import { ProgramConfigEditor } from './ProgramConfigEditor'

interface ProgramHeaderProps {
  program: GeneratedProgram
  pastProgramInfo: PastProgramInfo | null
  memberName: string
  editCount: number
}

function formatDateAU(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU')
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
  pastProgramInfo,
  memberName,
  editCount,
}: ProgramHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h2 className="text-xl font-semibold text-zinc-100">{memberName}</h2>
        {editCount > 0 && (
          <Badge variant="amber">
            {editCount} edit{editCount !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Last program (read-only) */}
      {pastProgramInfo && (
        <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Last Program
            </span>
            <span className="text-[10px] text-zinc-600">
              {pastProgramInfo.source === 'generated' ? 'Generated ' : ''}
              {formatDateAU(pastProgramInfo.created_at)}
            </span>
          </div>
          <PastProgramBadges info={pastProgramInfo} />
        </div>
      )}

      {/* Next / current program (editable) */}
      <div className="rounded-lg border border-zinc-600/60 bg-zinc-800/60 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            {pastProgramInfo ? 'Next Program' : 'Current Program'}
          </span>
          <span className="text-[10px] text-zinc-500">
            Generated {formatDateAU(program.created_at)}
          </span>
        </div>
        <ProgramConfigEditor />
      </div>

      {program.changes_summary && (
        <div className="rounded-lg bg-zinc-800/50 border border-zinc-700 px-3 py-2 text-sm text-zinc-300">
          {program.changes_summary}
        </div>
      )}
    </div>
  )
}
