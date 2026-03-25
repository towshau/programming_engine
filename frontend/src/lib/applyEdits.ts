import type { CoachEdit, ProgramExercise, ProgramSession, RepUnit } from '../types'
import { buildSetsFromInput, enrichSet, getUnit } from './reps'

/**
 * Find the target exercise index by row_id (preferred) with fallback to
 * series_label for legacy edits that pre-date row_id adoption.
 */
function findExercise(
  exercises: ProgramExercise[],
  edit: CoachEdit
): number {
  if (edit.row_id) {
    const idx = exercises.findIndex((e) => e.row_id === edit.row_id)
    if (idx !== -1) return idx
  }
  if (edit.exercise_id) {
    const idx = exercises.findIndex(
      (e) => e.exercise_id === edit.exercise_id && e.series_label === edit.series_label
    )
    if (idx !== -1) return idx
  }
  return exercises.findIndex((e) => e.series_label === edit.series_label)
}

/**
 * Applies saved coach edits on top of the generated program sessions,
 * returning a new array with modifications applied. The original is not mutated.
 *
 * Each exercise is guaranteed to have a `row_id`. If one is missing from the
 * stored payload (legacy data), a deterministic fallback is generated from
 * session day + position so it remains stable across renders.
 */
export function applyEdits(
  sessions: ProgramSession[],
  edits: CoachEdit[]
): ProgramSession[] {
  const result: ProgramSession[] = JSON.parse(JSON.stringify(sessions))

  for (const session of result) {
    for (let i = 0; i < session.exercises.length; i++) {
      const ex = session.exercises[i]
      if (!ex.row_id) {
        ex.row_id = `legacy-${session.day}-${i}`
      }
      ex.sets = ex.sets.map(enrichSet)
    }
  }

  if (!edits.length) return result

  for (const edit of edits) {
    const session = result.find((s) => s.day === edit.session_day)
    if (!session) continue

    const exerciseIdx = findExercise(session.exercises, edit)
    if (exerciseIdx === -1 && edit.edit_type !== 'series_change' && edit.edit_type !== 'exercise_add' && edit.edit_type !== 'exercise_delete') continue

    const exercise: ProgramExercise | undefined = session.exercises[exerciseIdx]

    switch (edit.edit_type) {
      case 'exercise_swap': {
        if (!exercise) break
        exercise.exercise_id = edit.new_value.exercise_id as string
        exercise.exercise_name = edit.new_value.exercise_name as string
        if (edit.new_value.tags) exercise.tags = edit.new_value.tags as string
        break
      }
      case 'series_change': {
        if (!exercise) break
        exercise.series_label = edit.new_value.series_label as string
        break
      }
      case 'sets_change': {
        if (!exercise) break
        const newSetCount = edit.new_value.sets as number
        const currentUnit = getUnit(exercise.sets)
        const currentReps = exercise.sets[0]?.reps_display ?? exercise.sets[0]?.reps ?? '8-10'
        exercise.sets = buildSetsFromInput(currentReps, currentUnit, newSetCount)
        break
      }
      case 'reps_change': {
        if (!exercise) break
        const newReps = edit.new_value.reps as string
        const unit = (edit.new_value.unit as RepUnit) ?? getUnit(exercise.sets)
        exercise.sets = buildSetsFromInput(newReps, unit, exercise.sets.length)
        break
      }
      case 'unit_change': {
        if (!exercise) break
        const newUnit = edit.new_value.unit as RepUnit
        const display = exercise.sets[0]?.reps_display ?? exercise.sets[0]?.reps ?? '8-10'
        let cleaned: string
        if (newUnit === 'seconds') {
          const firstNum = display.match(/\d+/)
          cleaned = firstNum ? firstNum[0] : '30'
        } else {
          cleaned = display.replace(/[^\d,\-\s]/g, '').trim() || display
        }
        exercise.sets = buildSetsFromInput(cleaned, newUnit, exercise.sets.length)
        break
      }
      case 'notes_change': {
        if (!exercise) break
        exercise.notes = edit.new_value.notes as string
        break
      }
      case 'exercise_delete': {
        if (exerciseIdx !== -1) {
          session.exercises.splice(exerciseIdx, 1)
        }
        break
      }
      case 'exercise_add': {
        const rowId = (edit.new_value.row_id as string) || (edit.row_id ?? crypto.randomUUID())
        const newExercise: ProgramExercise = {
          exercise_id: edit.new_value.exercise_id as string,
          exercise_name: edit.new_value.exercise_name as string,
          series_label: edit.new_value.series_label as string,
          tags: (edit.new_value.tags as string) || undefined,
          sets: (edit.new_value.sets as ProgramExercise['sets']) ??
            buildSetsFromInput('8-10', 'reps', 3),
          row_id: rowId,
        }
        session.exercises.push(newExercise)
        break
      }
    }
  }

  return result
}

/**
 * Checks whether a specific exercise in a session has been edited.
 * When row_id is provided, matches on row_id for precision;
 * otherwise falls back to series_label matching.
 */
export function isExerciseEdited(
  edits: CoachEdit[],
  sessionDay: number,
  seriesLabel: string,
  rowId?: string
): boolean {
  return edits.some((e) => {
    if (e.session_day !== sessionDay) return false
    if (rowId && e.row_id) {
      return e.row_id === rowId
    }
    return e.series_label === seriesLabel
  })
}
