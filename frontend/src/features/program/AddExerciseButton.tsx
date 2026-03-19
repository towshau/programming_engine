import { useState, useEffect } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { ExerciseSwapModal } from './ExerciseSwapModal'
import type { ExerciseLibraryItem, ProgramExercise } from '../../types'
import { seriesGroup, seriesSortKey } from '../../lib/utils'
import { buildSetsFromInput } from '../../lib/reps'

interface AddExerciseButtonProps {
  sessionDay: number
  programId: string
  memberId: string
  coachId: string | null
  existingExercises: ProgramExercise[]
}

function nextSeriesLabel(existing: ProgramExercise[]): string {
  if (existing.length === 0) return 'A1'

  const labels = existing.map((e) => e.series_label)
  const groupCounts: Record<string, number> = {}
  for (const label of labels) {
    const grp = seriesGroup(label)
    const numStr = label.slice(grp.length)
    const num = parseInt(numStr, 10) || 0
    if (!groupCounts[grp] || num > groupCounts[grp]) {
      groupCounts[grp] = num
    }
  }

  const groups = Object.keys(groupCounts).sort(
    (a, b) => seriesSortKey(a) - seriesSortKey(b)
  )
  const lastGroup = groups[groups.length - 1] || 'A'
  const lastNum = groupCounts[lastGroup] || 0

  return `${lastGroup}${lastNum + 1}`
}

export function AddExerciseButton({
  sessionDay,
  programId: _programId,
  memberId: _memberId,
  coachId: _coachId,
  existingExercises,
}: AddExerciseButtonProps) {
  void _programId; void _memberId; void _coachId;
  const { addPendingEdit, fetchExerciseLibrary, exerciseLibrary } = useEditorStore()
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (showModal && exerciseLibrary.length === 0) {
      fetchExerciseLibrary()
    }
  }, [showModal, exerciseLibrary.length, fetchExerciseLibrary])

  const handleSelect = (exercise: ExerciseLibraryItem) => {
    const seriesLabel = nextSeriesLabel(existingExercises)
    const defaultSets = buildSetsFromInput('8-10', 'reps', 3)

    addPendingEdit({
      session_day: sessionDay,
      series_label: seriesLabel,
      exercise_id: exercise.exercise_id,
      edit_type: 'exercise_add',
      old_value: {},
      new_value: {
        exercise_id: exercise.exercise_id,
        exercise_name: exercise.exercise_name,
        series_label: seriesLabel,
        tags: exercise.tags ?? '',
        sets: defaultSets,
      },
    })
    setShowModal(false)
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 bg-zinc-800/20 px-4 py-3 text-sm text-zinc-500 hover:border-emerald-500/40 hover:text-emerald-400 hover:bg-emerald-500/5 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Exercise
      </button>

      {showModal && (
        <ExerciseSwapModal
          currentExerciseName="(new exercise)"
          onSelect={handleSelect}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
