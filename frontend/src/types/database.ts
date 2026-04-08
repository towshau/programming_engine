export interface Coach {
  id: string
  first_name: string
  last_name: string
}

export interface Member {
  id: string
  first_name: string
  last_name: string
  member_name: string
  current_status: string
}

export type ProgramStatus = 'has_program' | 'needs_program' | 'new_member'
export type MembershipStatus = 'active' | 'pending' | 'indefinite_hold' | 'inactive'

export type ProgramDraftStatus = 'awaiting_draft' | 'draft_ready' | 'approved' | 'uploaded'

export interface MemberWithCoach {
  member_id: string
  member_name: string
  first_name: string
  last_name: string
  gym: string
  programming_coach_id: string
  program_status: ProgramStatus
  membership_status: MembershipStatus
  is_new: boolean
  sessions_per_week: number | null
  scheme_name: string | null
  draft_status: ProgramDraftStatus
}

export interface ExerciseLibraryItem {
  id: number
  exercise_id: string
  exercise_name: string
  tags: string
  series_assignment: string[] | null
}
