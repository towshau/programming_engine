export type RiskTier = 'low' | 'medium' | 'high' | 'critical'

export type PipelineFlag = 'bad_churn' | 'good_churn' | null

export interface SubScores {
  attendance: number
  recency: number
  lcns: number
  holds: number
  renewal_proximity: number
  tenure: number
  engagement: number
  history: number
  pipeline_flag: number
}

export interface RiskFactors {
  attendance: {
    sessions_per_week_allocated: number
    avg_sessions_last_4_weeks: number
    attendance_ratio: number
    trend: string
    days_since_last_visit: number
    total_sessions_attended: number
  }
  late_cancel_no_show: {
    lc_count_last_8_weeks: number
    ns_count_last_8_weeks: number
    lc_ns_ratio: number
  }
  holds: {
    total_holds: number
    total_hold_weeks: number
    currently_on_hold: boolean
    hold_frequency_per_year: number
  }
  membership: {
    tenure_months: number
    days_to_renewal: number
    membership_stage: string
    is_first_membership: boolean
    membership_selected: string
    price_paid: number
    per_session_value: number
  }
  engagement: {
    last_body_scan_days_ago: number
  }
  historical: {
    previously_not_renewing: boolean
    good_bad_churn_history: string | null
  }
  pipeline: {
    pipeline_lost: string | null
    manager_flag_score: number
  }
  sub_scores: SubScores
}

export interface ChurnRiskMember {
  id: string
  member_id: string
  membership_id: string
  risk_score: number
  risk_tier: RiskTier
  risk_factors: RiskFactors
  pipeline_lost: PipelineFlag
  churn_explanation: string | null
  scored_at: string
  predicted_outcome: string | null
  actual_outcome: string | null
  member_name: string
  email: string
  gym: string
  end_date: string
  membership_notes: string | null
  journey_stage: string
  coach_name: string
  renewal_lead_name: string
  gym_manager_name: string
  /** Signed calendar days until `end_date` (from `member_memberships`); negative if expired. */
  days_to_renewal: number | null
}

export interface HistoryPoint {
  risk_score: number
  risk_tier: RiskTier
  scored_at: string
}

export interface AttendanceWeek {
  date: string
  sessions_attended: number
  late_cancel: number
  no_shows: number
}

export type SortColumn =
  | 'risk_score'
  | 'member_name'
  | 'gym'
  | 'coach_name'
  | 'renewal_lead_name'
  | 'days_to_renewal'

export interface SortState {
  column: SortColumn
  direction: 'asc' | 'desc'
}
