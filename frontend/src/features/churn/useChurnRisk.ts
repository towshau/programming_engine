import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { ChurnRiskMember, HistoryPoint, RiskTier } from './types'
import { GYM_MANAGER_MAP, calendarDaysToEndDate } from './tierUtils'

interface RawChurnRow {
  id: string
  member_id: string
  membership_id: string
  risk_score: number
  risk_tier: string
  risk_factors: Record<string, unknown>
  pipeline_lost: string | null
  churn_explanation: string | null
  scored_at: string
  predicted_outcome: string | null
  actual_outcome: string | null
  member_database: { member_name: string; email: string; gym_string: string } | null
  member_memberships: {
    end_date: string
    gym: string
    membership_notes: string | null
    journey_stage: string
    coach_id: string | null
    handoff_coach_id: string | null
    renewal_assignee: string | null
  } | null
}

export function useChurnRisk() {
  const [members, setMembers] = useState<ChurnRiskMember[]>([])
  const [historyMap, setHistoryMap] = useState<Map<string, HistoryPoint[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [mainResult, historyResult, staffResult] = await Promise.all([
          supabase
            .from('member_churn_risk')
            .select(
              `id, member_id, membership_id, risk_score, risk_tier, risk_factors,
               pipeline_lost, churn_explanation, scored_at, predicted_outcome, actual_outcome,
               member_database(member_name, email, gym_string),
               member_memberships(end_date, gym, membership_notes, journey_stage, coach_id, handoff_coach_id, renewal_assignee)`,
            )
            .order('risk_score', { ascending: false }),

          supabase
            .from('member_churn_risk_history')
            .select('member_id, risk_score, risk_tier, scored_at')
            .order('scored_at', { ascending: true }),

          supabase.from('staff_database').select('id, coach_name'),
        ])

        if (mainResult.error) throw mainResult.error
        if (cancelled) return

        const staffMap = new Map<string, string>()
        if (staffResult.data) {
          for (const s of staffResult.data) staffMap.set(s.id, s.coach_name)
        }

        const raw = mainResult.data as unknown as RawChurnRow[]
        const mapped: ChurnRiskMember[] = raw
          .filter((r) => r.member_database && r.member_memberships)
          .map((r) => {
            const md = r.member_database!
            const mm = r.member_memberships!
            const coachName = mm.handoff_coach_id
              ? (staffMap.get(mm.handoff_coach_id) ?? 'Unassigned')
              : mm.coach_id
                ? (staffMap.get(mm.coach_id) ?? 'Unassigned')
                : 'Unassigned'
            const renewalLeadName = mm.renewal_assignee
              ? (staffMap.get(mm.renewal_assignee) ?? 'Unassigned')
              : 'Unassigned'

            const rf = r.risk_factors as unknown as ChurnRiskMember['risk_factors']
            const daysToRenewal = calendarDaysToEndDate(mm.end_date)

            return {
              id: r.id,
              member_id: r.member_id,
              membership_id: r.membership_id,
              risk_score: r.risk_score,
              risk_tier: r.risk_tier as RiskTier,
              risk_factors: rf,
              pipeline_lost: r.pipeline_lost as ChurnRiskMember['pipeline_lost'],
              churn_explanation: r.churn_explanation,
              scored_at: r.scored_at,
              predicted_outcome: r.predicted_outcome,
              actual_outcome: r.actual_outcome,
              member_name: md.member_name,
              email: md.email,
              gym: mm.gym,
              end_date: mm.end_date,
              membership_notes: mm.membership_notes,
              journey_stage: mm.journey_stage,
              coach_name: coachName,
              renewal_lead_name: renewalLeadName,
              gym_manager_name: GYM_MANAGER_MAP[mm.gym] ?? 'Unknown',
              days_to_renewal: daysToRenewal,
            }
          })

        if (!cancelled) setMembers(mapped)

        if (historyResult.data && !cancelled) {
          const hMap = new Map<string, HistoryPoint[]>()
          for (const h of historyResult.data) {
            const arr = hMap.get(h.member_id) ?? []
            arr.push({
              risk_score: h.risk_score,
              risk_tier: h.risk_tier as RiskTier,
              scored_at: h.scored_at,
            })
            hMap.set(h.member_id, arr)
          }
          setHistoryMap(hMap)
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load churn risk data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { members, historyMap, loading, error }
}
