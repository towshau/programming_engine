import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildMemberProfile } from '../lib/intakeProfile'
import type { MemberProfile, MembershipRow } from '../lib/intakeTypes'
import type { MemberPhysicals, HealthMetrics } from '../lib/scoring'

export interface UseIntakeDataOptions {
  /** When true, also loads full physicals + health history for Progress tab. */
  includeHistory?: boolean
}

export interface UseIntakeDataResult {
  physicals: MemberPhysicals | null
  physicalsFormDate: string | null
  profile: MemberProfile | null
  health: HealthMetrics | null
  physicalsHistory: MemberPhysicals[]
  healthHistory: HealthMetrics[]
  loading: boolean
}

/**
 * Loads intake profile, latest physicals/health, and optional history for Progress.
 */
export function useIntakeData(
  memberId: string | null | undefined,
  options: UseIntakeDataOptions = {},
): UseIntakeDataResult {
  const { includeHistory = false } = options
  const [physicals, setPhysicals] = useState<MemberPhysicals | null>(null)
  const [physicalsFormDate, setPhysicalsFormDate] = useState<string | null>(null)
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [health, setHealth] = useState<HealthMetrics | null>(null)
  const [physicalsHistory, setPhysicalsHistory] = useState<MemberPhysicals[]>([])
  const [healthHistory, setHealthHistory] = useState<HealthMetrics[]>([])
  const [loading, setLoading] = useState(false)
  const loadingForRef = useRef<string | null>(null)

  useEffect(() => {
    if (!memberId) {
      setPhysicals(null)
      setPhysicalsFormDate(null)
      setProfile(null)
      setHealth(null)
      setPhysicalsHistory([])
      setHealthHistory([])
      setLoading(false)
      return
    }

    const id = memberId
    loadingForRef.current = id
    setPhysicals(null)
    setPhysicalsFormDate(null)
    setProfile(null)
    setHealth(null)
    setPhysicalsHistory([])
    setHealthHistory([])
    setLoading(true)

    void (async () => {
      try {
        const today = new Date().toISOString().split('T')[0]

        const coreQueries = [
          supabase
            .from('member_physicals_raw')
            .select('*')
            .eq('member_id', id)
            .order('submission_date', { ascending: false })
            .limit(1)
            .maybeSingle(),

          supabase
            .from('member_database')
            .select('first_name, last_name, gym_string, current_status, injuries, goals')
            .eq('id', id)
            .single(),

          supabase
            .from('member_health_metrics')
            .select('weight, bf, smm, inbody_score, date_created')
            .eq('member_id', id)
            .order('date_created', { ascending: false })
            .limit(1)
            .maybeSingle(),

          supabase
            .from('member_memberships')
            .select(`
            id, end_date, primary_membership_id,
            newsale:member_newsale_metadata!newsale_metadata(session_credits, membership_selected),
            renewal:member_renewal_meta!renewal_metadata(session_credits, membership_selected)
          `)
            .eq('member_id', id)
            .gte('end_date', today)
            .neq('journey_stage', 'no_sale')
            .order('end_date', { ascending: false }),

          supabase
            .from('member_physicals_raw')
            .select('submission_date')
            .eq('member_id', id)
            .eq('source', 'form')
            .order('submission_date', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ] as const

        const historyQueries = includeHistory
          ? ([
              supabase
                .from('member_physicals_raw')
                .select(
                  'submission_date, source, squat, hinge, shoulder_flexion, toe_touch, ' +
                    'grip_strength_value, grip_strength_left, grip_strength_right, grip_strength_score, ' +
                    'chin_hold_value, chin_hold_score, vertical_jump_value, vertical_jump_score, ' +
                    'rsi_value, vo2_value, vo2_score, push_ups_value, push_ups_score, ' +
                    'focus_program, exercise_avoid, picked_cardio, bike_test_avg_watt, run_test_meters',
                )
                .eq('member_id', id)
                .order('submission_date', { ascending: true }),

              supabase
                .from('member_health_metrics')
                .select('weight, bf, smm, inbody_score, date_created')
                .eq('member_id', id)
                .order('date_created', { ascending: true }),
            ] as const)
          : null

        const results = await Promise.all([
          ...coreQueries,
          ...(historyQueries ?? []),
        ])

        if (loadingForRef.current !== id) return

        const physResult = results[0]
        const profileResult = results[1]
        const healthResult = results[2]
        const membershipResult = results[3]
        const formDateResult = results[4]

        setPhysicals(physResult.data as MemberPhysicals | null)
        setPhysicalsFormDate(
          (formDateResult.data as { submission_date: string | null } | null)
            ?.submission_date ?? null,
        )
        setHealth(healthResult.data as HealthMetrics | null)

        if (includeHistory && historyQueries && results.length >= 7) {
          const physHistResult = results[5]!
          const healthHistResult = results[6]!
          setPhysicalsHistory((physHistResult.data ?? []) as unknown as MemberPhysicals[])
          setHealthHistory((healthHistResult.data ?? []) as unknown as HealthMetrics[])
        }

        const memberships = (membershipResult.data ?? []) as unknown as MembershipRow[]
        const profileRow = profileResult.data as {
          first_name: string
          last_name: string
          gym_string: string
          current_status: string
          injuries: string | null
          goals: string | null
        } | null

        setProfile(buildMemberProfile(profileRow, memberships))
      } finally {
        if (loadingForRef.current === id) setLoading(false)
      }
    })()
  }, [memberId, includeHistory])

  return {
    physicals,
    physicalsFormDate,
    profile,
    health,
    physicalsHistory,
    healthHistory,
    loading,
  }
}
