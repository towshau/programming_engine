/** 6-month performance cycle (Nov–Apr or May–Oct). */
export interface ThreeSixtyCycle {
  /** Inclusive start YYYY-MM-DD */
  start: string
  /** Inclusive end YYYY-MM-DD */
  end: string
  /** Human label e.g. "Nov 2025 – Apr 2026" */
  label: string
}

/** Winning Client Results row (coach_wcr_logging + coach name). */
export type WcrRow = Record<string, unknown> & {
  id?: string
  coach_id?: string | null
  submission_date?: string | null
  coach_name?: string | null
}

/** Renewals in cycle (flattened from member_memberships joins). */
export interface RenewalInCycleRow {
  id: string
  member_id: string
  start_date: string | null
  end_date: string | null
  status: string | null
  membership_stage: string | null
  journey_stage: string | null
  gym: string | null
  pipeline_lost: string | null
  member_name: string | null
  primary_coach: string | null
  handoff_coach: string | null
}

/** member_renewal_meta row + coach name. */
export type RenewalMetaRow = Record<string, unknown> & {
  id?: string
  coach_id?: string | null
  date_created?: string | null
  coach_name?: string | null
}
