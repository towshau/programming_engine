export type RepUnit = 'reps' | 'seconds'

export interface SetPrescription {
  set_number: number
  reps: string
  reps_min?: number | null
  reps_max?: number | null
  reps_display?: string
  unit?: RepUnit
}

export interface ProgramExercise {
  exercise_name: string
  exercise_id: string
  series_label: string
  tags?: string
  sets: SetPrescription[]
  notes?: string
  /** Persistent unique identifier for this exercise slot; survives edits, saves, and reloads. */
  row_id?: string
}

export interface ProgramSession {
  day: number
  exercises: ProgramExercise[]
}

export interface ProgramPayload {
  sessions: ProgramSession[]
  metadata?: {
    scheme?: string
    next_rep_range?: string
    confidence?: string
    sessions_per_week?: number
  }
}

export interface ProgressionScheme {
  id: string
  name: string
  from_rep_range: string
  to_rep_range: string
  exercise_behavior: string
  order: number
}

export interface RegenerationRequest {
  id: string
  member_id: string
  program_id: string | null
  requested_by: string | null
  scheme_name: string
  rep_range: string
  sessions_per_week: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  completed_at: string | null
}

export interface PastProgramInfo {
  source: 'generated' | 'normalized'
  created_at: string
  scheme_name?: string | null
  rep_range?: string | null
  phase_number?: number | null
  sessions_per_week?: number | null
  duration_weeks?: number | null
  confidence?: string | null
  session_count?: number
  date_range?: { from: string; to: string }
}

export interface GeneratedProgram {
  id: string
  run_id: string
  member_id: string
  assigned_to: string | null
  sessions_per_week: number
  duration_weeks: number
  phase_number: number | null
  scheme_name: string | null
  rep_range: string | null
  changes_summary: string | null
  rules_applied: string[] | null
  payload: ProgramPayload
  coach_edited: boolean
  coach_approved: boolean
  uploaded_to_teambuildr: boolean
  next_due_date: string | null
  created_at: string
  updated_at: string
}
