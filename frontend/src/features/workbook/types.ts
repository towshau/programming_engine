export interface WorkbookCoach {
  id: string
  first_name: string
  last_name: string | null
  coach_name: string | null
  role: string | null
  staff_status: string | null
  home_gym: string | null
}

export interface WorkbookMembershipType {
  id: string
  name: string
  session_frequency_per_week: number | null
  category: string | null
}

export interface WorkbookMembership {
  id: string
  member_id: string
  membership_type_id: string
  start_date: string
  end_date: string
  status: string | null
  coach_id: string | null
  handoff_coach_id: string | null
  primary_membership_id: string | null
  gym: string | null
  journey_stage: string | null
  membership_types: WorkbookMembershipType | null
}

export interface Note {
  id: string
  member_id: string
  coach_id: string
  note_type: 'general notes' | 'team' | 'goal' | 'habits' | 'other'
  note_content: string
  created_at: string
  updated_at: string | null
  checkin_1: boolean | null
}

export interface SessionAttendance {
  member_id: string
  session_date: string
}

export type NoteType = 'general notes' | 'team' | 'goal' | 'habits'

export interface CollapseState {
  sessions: boolean
  memberships: boolean
  goalsHabits: boolean
}
