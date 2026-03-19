import { useState } from 'react'
import type { ProgramExercise, CoachEdit, ExerciseLibraryItem, SetPrescription } from '../../types'
import { useEditorStore } from '../../stores/editorStore'
import { isExerciseEdited } from '../../lib/applyEdits'
import { cn } from '../../lib/utils'
import { SeriesLabelDropdown } from './SeriesLabelDropdown'
import { SetsRepsEditor } from './SetsRepsEditor'
import { NotesInput } from './NotesInput'
import { ExerciseSwapModal } from './ExerciseSwapModal'

function buildRepsString(sets: SetPrescription[]): string {
  if (sets.length === 0) return ''
  const allSame = sets.every((s) => s.reps === sets[0].reps)
  if (allSame) return sets[0].reps
  return sets.map((s) => s.reps).join(', ')
}

interface ExerciseRowProps {
  exercise: ProgramExercise
  sessionDay: number
  edits: CoachEdit[]
  programId: string
  memberId: string
  coachId: string | null
}

export function ExerciseRow({
  exercise,
  sessionDay,
  edits,
  programId: _programId,
  memberId: _memberId,
  coachId: _coachId,
}: ExerciseRowProps) {
  void _programId; void _memberId; void _coachId;
  const { addPendingEdit } = useEditorStore()
  const [showSwapModal, setShowSwapModal] = useState(false)
  const edited = isExerciseEdited(edits, sessionDay, exercise.series_label)

  const handleSeriesChange = (newLabel: string) => {
    addPendingEdit({
      session_day: sessionDay,
      series_label: exercise.series_label,
      exercise_id: exercise.exercise_id,
      edit_type: 'series_change',
      old_value: { series_label: exercise.series_label },
      new_value: { series_label: newLabel },
    })
  }

  const handleExerciseSwap = (newExercise: ExerciseLibraryItem) => {
    addPendingEdit({
      session_day: sessionDay,
      series_label: exercise.series_label,
      exercise_id: exercise.exercise_id,
      edit_type: 'exercise_swap',
      old_value: {
        exercise_id: exercise.exercise_id,
        exercise_name: exercise.exercise_name,
      },
      new_value: {
        exercise_id: newExercise.exercise_id,
        exercise_name: newExercise.exercise_name,
        tags: newExercise.tags,
      },
    })
    setShowSwapModal(false)
  }

  const handleSetsChange = (newSets: number) => {
    addPendingEdit({
      session_day: sessionDay,
      series_label: exercise.series_label,
      exercise_id: exercise.exercise_id,
      edit_type: 'sets_change',
      old_value: { sets: exercise.sets.length },
      new_value: { sets: newSets },
    })
  }

  const handleRepsChange = (newReps: string) => {
    addPendingEdit({
      session_day: sessionDay,
      series_label: exercise.series_label,
      exercise_id: exercise.exercise_id,
      edit_type: 'reps_change',
      old_value: { reps: exercise.sets[0]?.reps ?? '' },
      new_value: { reps: newReps },
    })
  }

  const handleNotesChange = (newNotes: string) => {
    addPendingEdit({
      session_day: sessionDay,
      series_label: exercise.series_label,
      exercise_id: exercise.exercise_id,
      edit_type: 'notes_change',
      old_value: { notes: exercise.notes ?? '' },
      new_value: { notes: newNotes },
    })
  }

  const handleDelete = () => {
    addPendingEdit({
      session_day: sessionDay,
      series_label: exercise.series_label,
      exercise_id: exercise.exercise_id,
      edit_type: 'exercise_delete',
      old_value: {
        exercise_id: exercise.exercise_id,
        exercise_name: exercise.exercise_name,
        series_label: exercise.series_label,
      },
      new_value: {},
    })
  }

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors group',
          'bg-zinc-800/30 hover:bg-zinc-800/60',
          edited && 'ring-1 ring-emerald-500/40 bg-emerald-500/5'
        )}
      >
        <SeriesLabelDropdown
          value={exercise.series_label}
          onChange={handleSeriesChange}
        />

        <button
          onClick={() => setShowSwapModal(true)}
          className="flex-1 text-left min-w-0 group/name"
          title="Click to swap exercise"
        >
          <span className="text-sm text-zinc-200 group-hover/name:text-emerald-400 transition-colors truncate block">
            {exercise.exercise_name}
          </span>
          {exercise.tags && (
            <span className="text-xs text-zinc-500 truncate block">
              {exercise.tags}
            </span>
          )}
        </button>

        <SetsRepsEditor
          sets={exercise.sets.length}
          reps={buildRepsString(exercise.sets)}
          onSetsChange={handleSetsChange}
          onRepsChange={handleRepsChange}
        />

        <NotesInput
          value={exercise.notes ?? ''}
          onChange={handleNotesChange}
        />

        {edited && (
          <div className="flex-shrink-0" title="Modified by coach">
            <svg className="h-4 w-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </div>
        )}

        <button
          onClick={handleDelete}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-400"
          title="Remove exercise"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {showSwapModal && (
        <ExerciseSwapModal
          currentExerciseName={exercise.exercise_name}
          onSelect={handleExerciseSwap}
          onClose={() => setShowSwapModal(false)}
        />
      )}
    </>
  )
}
