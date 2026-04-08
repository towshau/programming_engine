import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { WorkbookMembership } from '../types'

/** Lowercase key for sorting: `first_name` when set, else first word of `member_name`. */
export function firstNameSortKey(
  firstName: string | null | undefined,
  memberName: string
): string {
  const f = firstName?.trim()
  if (f) return f.toLocaleLowerCase()
  const token = memberName.trim().split(/\s+/)[0] ?? ''
  return token.toLocaleLowerCase()
}

export interface MemberWithMemberships {
  memberId: string
  memberName: string
  /** For default / Name-column sort (first name, case-insensitive). */
  firstNameSortKey: string
  primaryMembership: WorkbookMembership | null
  secondaryMemberships: WorkbookMembership[]
  contractedSessions: number
  membershipExpiry: string | null
  gym: string | null
  /** True when the primary membership end_date is in the past. */
  isExpired: boolean
}

const SELECT_COLS = `
  id,
  member_id,
  membership_type_id,
  start_date,
  end_date,
  status,
  coach_id,
  handoff_coach_id,
  primary_membership_id,
  gym,
  journey_stage,
  membership_types (
    id,
    name,
    session_frequency_per_week,
    category
  )
`

export function useWorkbookMembers(selectedCoachIds: string[], gymFilter: string | null) {
  const [members, setMembers] = useState<MemberWithMemberships[]>([])
  const [loading, setLoading] = useState(false)

  const coachKey = selectedCoachIds.join(',')

  useEffect(() => {
    const coachIds = coachKey ? coachKey.split(',') : []

    async function load() {
      if (coachIds.length === 0) {
        setMembers([])
        return
      }
      setLoading(true)

      const today = new Date().toISOString().split('T')[0]

      let primaryQuery = supabase
        .from('member_memberships')
        .select(SELECT_COLS)
        .is('primary_membership_id', null)
        .or(`coach_id.in.(${coachKey}),handoff_coach_id.in.(${coachKey})`)

      if (gymFilter) {
        primaryQuery = primaryQuery.eq('gym', gymFilter)
      }

      const { data: primaryData, error: primaryError } = await primaryQuery

      if (primaryError) {
        console.error('Error fetching primary memberships:', primaryError)
        setLoading(false)
        return
      }

      const primaryRows = (primaryData ?? []) as unknown as WorkbookMembership[]

      const primaryByMember = new Map<string, WorkbookMembership>()
      for (const row of primaryRows) {
        if (!row.member_id) continue
        if (row.journey_stage === 'no_sale') continue
        const effectiveCoach = row.handoff_coach_id ?? row.coach_id
        if (!effectiveCoach || !coachIds.includes(effectiveCoach)) continue
        const existing = primaryByMember.get(row.member_id)
        if (existing && (existing.end_date ?? '') >= (row.end_date ?? '')) continue
        primaryByMember.set(row.member_id, row)
      }

      const qualifiedMemberIds = Array.from(primaryByMember.keys())
      if (qualifiedMemberIds.length === 0) {
        setMembers([])
        setLoading(false)
        return
      }

      const [secondaryResult, nameResult] = await Promise.all([
        supabase
          .from('member_memberships')
          .select(SELECT_COLS)
          .in('member_id', qualifiedMemberIds)
          .not('primary_membership_id', 'is', null),
        supabase
          .from('member_database')
          .select('id, member_name, first_name')
          .in('id', qualifiedMemberIds),
      ])

      if (secondaryResult.error) {
        console.error('Error fetching secondary memberships:', secondaryResult.error)
      }

      const secondaryByMember = new Map<string, WorkbookMembership[]>()
      for (const row of (secondaryResult.data ?? []) as unknown as WorkbookMembership[]) {
        if (!row.member_id) continue
        const existing = secondaryByMember.get(row.member_id) ?? []
        existing.push(row)
        secondaryByMember.set(row.member_id, existing)
      }

      const nameMap = new Map<string, { memberName: string; firstName: string | null }>()
      for (const m of nameResult.data ?? []) {
        nameMap.set(m.id, {
          memberName: (m.member_name as string | null) ?? 'Unknown',
          firstName: m.first_name as string | null,
        })
      }

      const result: MemberWithMemberships[] = []

      for (const [memberId, primary] of primaryByMember) {
        const secondaries = secondaryByMember.get(memberId) ?? []
        const allMemberships = [primary, ...secondaries]

        const contractedSessions = allMemberships.reduce((sum, m) => {
          const freq = m.membership_types?.session_frequency_per_week ?? 0
          return sum + freq
        }, 0)

        const info = nameMap.get(memberId)
        const memberName = info?.memberName ?? 'Unknown'
        const isExpired = primary.end_date ? primary.end_date <= today : false

        result.push({
          memberId,
          memberName,
          firstNameSortKey: firstNameSortKey(info?.firstName, memberName),
          primaryMembership: primary,
          secondaryMemberships: secondaries,
          contractedSessions,
          membershipExpiry: primary.end_date,
          gym: primary.gym,
          isExpired,
        })
      }

      setMembers(result)
      setLoading(false)
    }

    void load()
  }, [coachKey, gymFilter])

  return { members, loading }
}
