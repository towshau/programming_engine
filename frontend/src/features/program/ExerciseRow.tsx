import { useState } from 'react'
import type { ProgramExercise, CoachEdit, ExerciseLibraryItem, RepUnit } from '../../types'
import { useEditorStore } from '../../stores/editorStore'
import { isExerciseEdited } from '../../lib/applyEdits'
import { buildRepsDisplay, getUnit } from '../../lib/reps'
import { cn } from '../../lib/utils'
import { SeriesLabelDropdown } from './SeriesLabelDropdown'
import { SetsRepsEditor } from './SetsRepsEditor'
import { NotesInput } from './NotesInput'
import { ExerciseSwapModal } from './ExerciseSwapModal'

interface ExerciseRowProps {
  exercise: ProgramExercise
  sessionDay: number
  edits: CoachEdit[]
  programId: string
  memberId: string
  coachId: string | null
  readOnly?: boolean
  compact?: boolean
}

export function ExerciseRow({
  exercise,
  sessionDay,
  edits,
  programId: _programId,
  memberId: _memberId,
  coachId: _coachId,
  readOnly = false,
  compact = false,
}: ExerciseRowProps) {
  void _programId; void _memberId; void _coachId;
  const { addPendingEdit, hasRepsError, exerciseBests } = useEditorStore()
  const [showSwapModal, setShowSwapModal] = useState(false)
  const rowId = exercise.row_id
  const edited = isExerciseEdited(edits, sessionDay, exercise.series_label, rowId)
  const repsInvalid = !readOnly && hasRepsError(sessionDay, exercise.series_label)

  const bests = exerciseBests[exercise.exercise_name]
  const periodBest = bests?.period
  const allTimeBest = bests?.allTime

  const renderPB = (isCompact: boolean) => {
    if (!bests) return null
    const textClass = isCompact ? "text-[10px]" : "text-xs"
    if (!periodBest && !allTimeBest) {
      return <span className={`${textClass} block truncate`} style={{ color: 'var(--text-muted)' }}>No lifts recorded</span>
    }
    
    const formatPB = (pb: { result: number; reps: number; set_number: number }) => `${pb.result}kg x ${pb.reps} | Set ${pb.set_number}`
    
    if (periodBest && allTimeBest) {
      if (periodBest.result === allTimeBest.result && periodBest.reps === allTimeBest.reps) {
        return (
          <span className={`${textClass} block truncate`} style={{ color: 'var(--text-muted)' }}>
            PB: <span style={{ color: 'var(--color-gold)' }}>{formatPB(periodBest)}</span> (all-time)
          </span>
        )
      }
      return (
        <span className={`${textClass} block truncate`} style={{ color: 'var(--text-muted)' }}>
          Recent PB: <span style={{ color: 'var(--color-gold)' }}>{formatPB(periodBest)}</span>
          {' • '}All-time: {allTimeBest.result}kg
        </span>
      )
    }
    if (periodBest) {
      return (
        <span className={`${textClass} block truncate`} style={{ color: 'var(--text-muted)' }}>
          Recent PB: <span style={{ color: 'var(--color-gold)' }}>{formatPB(periodBest)}</span>
        </span>
      )
    }
    return (
      <span className={`${textClass} block truncate`} style={{ color: 'var(--text-muted)' }}>
        All-time PB: {allTimeBest?.result}kg
      </span>
    )
  }

  const handleSeriesChange = (newLabel: string) => {
    if (readOnly) return
    addPendingEdit({
      session_day: sessionDay,
      series_label: exercise.series_label,
      exercise_id: exercise.exercise_id,
      edit_type: 'series_change',
      old_value: { series_label: exercise.series_label },
      new_value: { series_label: newLabel },
      row_id: rowId,
    })
  }

  const handleExerciseSwap = (newExercise: ExerciseLibraryItem) => {
    if (readOnly) return
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
      row_id: rowId,
    })
    setShowSwapModal(false)
  }

  const handleSetsChange = (newSets: number) => {
    if (readOnly) return
    addPendingEdit({
      session_day: sessionDay,
      series_label: exercise.series_label,
      exercise_id: exercise.exercise_id,
      edit_type: 'sets_change',
      old_value: { sets: exercise.sets.length },
      new_value: { sets: newSets },
      row_id: rowId,
    })
  }

  const currentUnit = getUnit(exercise.sets)

  const handleRepsChange = (newReps: string) => {
    if (readOnly) return
    addPendingEdit({
      session_day: sessionDay,
      series_label: exercise.series_label,
      exercise_id: exercise.exercise_id,
      edit_type: 'reps_change',
      old_value: { reps: exercise.sets[0]?.reps ?? '', unit: currentUnit },
      new_value: { reps: newReps, unit: currentUnit },
      row_id: rowId,
    })
  }

  const handleUnitChange = (newUnit: RepUnit) => {
    if (readOnly) return
    addPendingEdit({
      session_day: sessionDay,
      series_label: exercise.series_label,
      exercise_id: exercise.exercise_id,
      edit_type: 'unit_change',
      old_value: { unit: currentUnit },
      new_value: { unit: newUnit },
      row_id: rowId,
    })
  }

  const handleNotesChange = (newNotes: string) => {
    if (readOnly) return
    addPendingEdit({
      session_day: sessionDay,
      series_label: exercise.series_label,
      exercise_id: exercise.exercise_id,
      edit_type: 'notes_change',
      old_value: { notes: exercise.notes ?? '' },
      new_value: { notes: newNotes },
      row_id: rowId,
    })
  }

  const handleDelete = () => {
    if (readOnly) return
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
      row_id: rowId,
    })
  }

  if (compact) {
    return (
      <>
        <div
          className={cn(
            'flex flex-col gap-0.5 rounded-lg px-2 py-1.5 transition-colors group border',
          )}
          style={{
            background: repsInvalid ? 'var(--red-bg)' : edited ? 'rgba(184,134,11,0.05)' : 'white',
            borderColor: repsInvalid ? 'var(--red-border)' : edited ? 'rgba(184,134,11,0.25)' : 'var(--border)',
          }}
        >
          {/* Row 1: label + name + delete */}
          <div className="flex items-center gap-2 min-w-0">
            <SeriesLabelDropdown
              value={exercise.series_label}
              onChange={handleSeriesChange}
              disabled={readOnly}
            />
            {readOnly ? (
              <div className="flex-1 min-w-0">
                <span className="text-xs leading-tight truncate block" style={{ color: 'var(--text)' }}>
                  {exercise.exercise_name}
                </span>
                {renderPB(true)}
              </div>
            ) : (
              <button
                onClick={() => setShowSwapModal(true)}
                className="flex-1 text-left min-w-0 group/name"
                title="Click to swap exercise"
              >
                <span className="text-xs leading-tight truncate block transition-colors group-hover/name:text-[var(--color-gold)]" style={{ color: 'var(--text)' }}>
                  {exercise.exercise_name}
                </span>
                {renderPB(true)}
              </button>
            )}
            {edited && (
              <div className="flex-shrink-0" title="Modified by coach">
                <svg className="h-3.5 w-3.5" style={{ color: 'var(--color-gold)' }} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </div>
            )}
            {!readOnly && (
              <button
                onClick={handleDelete}
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-muted)' }}
                title="Remove exercise"
                onMouseOver={e => e.currentTarget.style.color = 'var(--red)'}
                onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
          {/* Row 2: sets × reps */}
          <div className="pl-8">
            <SetsRepsEditor
              sets={exercise.sets.length}
              repsDisplay={buildRepsDisplay(exercise.sets)}
              unit={currentUnit}
              hasError={repsInvalid}
              onSetsChange={handleSetsChange}
              onRepsChange={handleRepsChange}
              onUnitChange={handleUnitChange}
              readOnly={readOnly}
            />
          </div>
        </div>

        {showSwapModal && !readOnly && (
          <ExerciseSwapModal
            currentExerciseName={exercise.exercise_name}
            onSelect={handleExerciseSwap}
            onClose={() => setShowSwapModal(false)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors group border',
        )}
        style={{
          background: repsInvalid ? 'var(--red-bg)' : edited ? 'rgba(184,134,11,0.05)' : 'white',
          borderColor: repsInvalid ? 'var(--red-border)' : edited ? 'rgba(184,134,11,0.25)' : 'var(--border)',
        }}
      >
        <SeriesLabelDropdown
          value={exercise.series_label}
          onChange={handleSeriesChange}
          disabled={readOnly}
        />

        {readOnly ? (
          <div className="flex-1 min-w-0">
            <span className="text-sm truncate block" style={{ color: 'var(--text)' }}>
              {exercise.exercise_name}
            </span>
            {renderPB(false)}
            {exercise.tags && (
              <span className="text-xs truncate block" style={{ color: 'var(--text-muted)' }}>
                {exercise.tags}
              </span>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowSwapModal(true)}
            className="flex-1 text-left min-w-0 group/name"
            title="Click to swap exercise"
          >
            <span className="text-sm truncate block transition-colors group-hover/name:text-[var(--color-gold)]" style={{ color: 'var(--text)' }}>
              {exercise.exercise_name}
            </span>
            {renderPB(false)}
            {exercise.tags && (
              <span className="text-xs truncate block" style={{ color: 'var(--text-muted)' }}>
                {exercise.tags}
              </span>
            )}
          </button>
        )}

        <SetsRepsEditor
          sets={exercise.sets.length}
          repsDisplay={buildRepsDisplay(exercise.sets)}
          unit={currentUnit}
          hasError={repsInvalid}
          onSetsChange={handleSetsChange}
          onRepsChange={handleRepsChange}
          onUnitChange={handleUnitChange}
          readOnly={readOnly}
        />

        {!readOnly && (
          <NotesInput
            value={exercise.notes ?? ''}
            onChange={handleNotesChange}
          />
        )}

        {edited && (
          <div className="flex-shrink-0" title="Modified by coach">
            <svg className="h-4 w-4" style={{ color: 'var(--color-gold)' }} fill="currentColor" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </div>
        )}

        {!readOnly && (
          <button
            onClick={handleDelete}
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
            title="Remove exercise"
            onMouseOver={e => e.currentTarget.style.color = 'var(--red)'}
            onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {showSwapModal && !readOnly && (
        <ExerciseSwapModal
          currentExerciseName={exercise.exercise_name}
          onSelect={handleExerciseSwap}
          onClose={() => setShowSwapModal(false)}
        />
      )}
    </>
  )
}
