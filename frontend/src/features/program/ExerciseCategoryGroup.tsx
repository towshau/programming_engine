import type { ProgramExercise, CoachEdit } from '../../types'
import { ExerciseRow } from './ExerciseRow'
import { cn, seriesColor, seriesGroupLabel } from '../../lib/utils'

interface ExerciseCategoryGroupProps {
  seriesLetter: string
  exercises: ProgramExercise[]
  sessionDay: number
  edits: CoachEdit[]
  programId: string
  memberId: string
  coachId: string | null
  readOnly?: boolean
}

export function ExerciseCategoryGroup({
  seriesLetter,
  exercises,
  sessionDay,
  edits,
  programId,
  memberId,
  coachId,
  readOnly = false,
}: ExerciseCategoryGroupProps) {
  const colorClasses = seriesColor(seriesLetter)
  const label = seriesGroupLabel(seriesLetter)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded px-2 py-0.5 text-xs font-bold border',
            colorClasses
          )}
        >
          {seriesLetter}
        </span>
        <span className="text-sm font-medium text-zinc-400">{label}</span>
      </div>

      <div className="space-y-1">
        {exercises.map((exercise) => (
          <ExerciseRow
            key={exercise._idx ?? `${exercise.series_label}-${exercise.exercise_id}`}
            exercise={exercise}
            sessionDay={sessionDay}
            edits={edits}
            programId={programId}
            memberId={memberId}
            coachId={coachId}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  )
}
