export type EditType =
  | 'exercise_swap'
  | 'series_change'
  | 'sets_change'
  | 'reps_change'
  | 'notes_change'
  | 'exercise_add'
  | 'exercise_delete'

export interface CoachEdit {
  id: string
  program_id: string
  member_id: string
  coach_id: string | null
  session_day: number
  series_label: string
  exercise_id: string | null
  edit_type: EditType
  old_value: Record<string, unknown>
  new_value: Record<string, unknown>
  created_at: string
}

export interface PendingEdit {
  session_day: number
  series_label: string
  exercise_id: string | null
  edit_type: EditType
  old_value: Record<string, unknown>
  new_value: Record<string, unknown>
}
