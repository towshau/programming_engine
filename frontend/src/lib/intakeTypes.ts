export interface MemberProfile {
  first_name: string
  last_name: string
  gym_string: string
  current_status: string
  injuries: string | null
  goals: string | null
  primary_membership: string | null
  secondary_memberships: string[]
  end_date: string | null
}

export interface MembershipRow {
  id: string
  end_date: string | null
  primary_membership_id: string | null
  newsale: { session_credits: number | null; membership_selected: string | null } | null
  renewal: { session_credits: number | null; membership_selected: string | null } | null
}
