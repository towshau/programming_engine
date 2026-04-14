import type { MemberProfile, MembershipRow } from './intakeTypes'

type ProfileRow = {
  first_name: string
  last_name: string
  gym_string: string
  current_status: string
  injuries: string | null
  goals: string | null
}

/** Derive primary/secondary membership labels from active membership rows (same logic as Intake). */
export function buildMemberProfile(
  profileData: ProfileRow | null,
  memberships: MembershipRow[],
): MemberProfile | null {
  if (!profileData) return null

  const latestPrimary =
    memberships.find((m) => !m.primary_membership_id) ?? null
  const currentSecondaries = latestPrimary
    ? memberships.filter((m) => m.primary_membership_id === latestPrimary.id)
    : []
  const currentMemberships = latestPrimary
    ? [latestPrimary, ...currentSecondaries]
    : memberships

  const endDate = latestPrimary?.end_date ?? null
  let primaryMembership: string | null = null
  const secondaryMemberships: string[] = []

  for (const m of currentMemberships) {
    const meta = m.newsale ?? m.renewal
    const selectedRaw = meta?.membership_selected ?? ''
    if (!m.primary_membership_id) {
      primaryMembership = selectedRaw || null
    } else {
      if (selectedRaw) secondaryMemberships.push(selectedRaw)
    }
  }

  return {
    first_name: profileData.first_name,
    last_name: profileData.last_name,
    gym_string: profileData.gym_string,
    current_status: profileData.current_status,
    injuries: profileData.injuries,
    goals: profileData.goals,
    primary_membership: primaryMembership,
    secondary_memberships: secondaryMemberships,
    end_date: endDate,
  }
}
