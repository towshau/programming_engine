import type { CoachEdit, ProgramExercise, ProgramSession, RepUnit } from '../types'
import { buildSetsFromInput, enrichSet, getUnit } from './reps'

/**
 * Applies saved coach edits on top of the generated program sessions,
 * returning a new array with modifications applied. The original is not mutated.
 */
export function applyEdits(
  sessions: ProgramSession[],
  edits: CoachEdit[]
): ProgramSession[] {
  const result: ProgramSession[] = JSON.parse(JSON.stringify(sessions))

  for (const session of result) {
    for (let i = 0; i < session.exercises.length; i++) {
      session.exercises[i].sets = session.exercises[i].sets.map(enrichSet)
    }
  }

  if (!edits.length) return result

  for (const edit of edits) {
    const session = result.find((s) => s.day === edit.session_day)
    if (!session) continue

    const exerciseIdx = session.exercises.findIndex(
      (e) => e.series_label === edit.series_label
    )
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
        const newExercise: ProgramExercise = {
          exercise_id: edit.new_value.exercise_id as string,
          exercise_name: edit.new_value.exercise_name as string,
          series_label: edit.new_value.series_label as string,
          tags: (edit.new_value.tags as string) || undefined,
          sets: (edit.new_value.sets as ProgramExercise['sets']) ??
            buildSetsFromInput('8-10', 'reps', 3),
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
 */
export function isExerciseEdited(
  edits: CoachEdit[],
  sessionDay: number,
  seriesLabel: string
): boolean {
  return edits.some(
    (e) => e.session_day === sessionDay && e.series_label === seriesLabel
  )
}
