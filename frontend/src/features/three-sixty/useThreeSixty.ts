import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import type { WcrRow, RenewalInCycleRow, RenewalMetaRow } from './types'

/** Supabase may return embedded FK as object or single-element array depending on client inference. */
function embedOne<T extends object>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

interface RawMembershipRow {
  id: string
  member_id: string
  start_date: string | null
  end_date: string | null
  status: string | null
  membership_stage: string | null
  journey_stage: string | null
  gym: string | null
  pipeline_lost: string | null
  member_database: { member_name: string | null } | null | { member_name: string | null }[]
  primary_coach: { coach_name: string | null } | null | { coach_name: string | null }[]
  handoff_coach: { coach_name: string | null } | null | { coach_name: string | null }[]
}

function flattenWcrRow(row: Record<string, unknown>): WcrRow {
  const coachEmbed = row.coach_staff as { coach_name?: string | null } | null | undefined
  const rest = { ...row }
  delete rest.coach_staff
  return {
    ...rest,
    coach_name: coachEmbed?.coach_name ?? (rest.coach_name as string | null | undefined) ?? null,
  } as WcrRow
}

function flattenRenewalMetaRow(row: Record<string, unknown>): RenewalMetaRow {
  const coachEmbed = row.coach_staff as { coach_name?: string | null } | null | undefined
  const rest = { ...row }
  delete rest.coach_staff
  return {
    ...rest,
    coach_name: coachEmbed?.coach_name ?? (rest.coach_name as string | null | undefined) ?? null,
  } as RenewalMetaRow
}

export function useThreeSixty(coachId: string | null, cycleStart: string, cycleEnd: string) {
  const [wcr, setWcr] = useState<WcrRow[]>([])
  const [renewals, setRenewals] = useState<RenewalInCycleRow[]>([])
  const [renewalMeta, setRenewalMeta] = useState<RenewalMetaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      let qWcr = supabase
        .from('coach_wcr_logging')
        .select('*, coach_staff:staff_database!coach_id(coach_name)')
        .order('submission_date', { ascending: false })
        .limit(2000)

      if (coachId) {
        qWcr = qWcr.eq('coach_id', coachId)
      }

      let qRenewals = supabase
        .from('member_memberships')
        .select(
          `id, member_id, start_date, end_date, status, membership_stage,
           journey_stage, gym, pipeline_lost,
           member_database(member_name),
           primary_coach:staff_database!coach_id(coach_name),
           handoff_coach:staff_database!handoff_coach_id(coach_name)`,
        )
        .gte('end_date', cycleStart)
        .lte('end_date', cycleEnd)
        .order('end_date', { ascending: true })
        .limit(2000)

      if (coachId) {
        qRenewals = qRenewals.or(`coach_id.eq.${coachId},handoff_coach_id.eq.${coachId}`)
      }

      let qMeta = supabase
        .from('member_renewal_meta')
        .select('*, coach_staff:staff_database!coach_id(coach_name)')
        .order('date_created', { ascending: false })
        .limit(2000)

      if (coachId) {
        qMeta = qMeta.eq('coach_id', coachId)
      }

      const [wcrRes, renewalsRes, metaRes] = await Promise.all([qWcr, qRenewals, qMeta])

      const errs = [wcrRes.error, renewalsRes.error, metaRes.error].filter(Boolean)
      if (errs.length > 0) {
        const msg = errs.map((e) => e?.message).filter(Boolean).join('; ') || 'Failed to load 360 data'
        setError(msg)
        setWcr([])
        setRenewals([])
        setRenewalMeta([])
        return
      }

      setWcr((wcrRes.data ?? []).map((r) => flattenWcrRow(r as Record<string, unknown>)))

      const rawRenewals = renewalsRes.data as unknown as RawMembershipRow[]
      setRenewals(
        rawRenewals.map((r) => {
          const md = embedOne(r.member_database)
          const pc = embedOne(r.primary_coach)
          const hc = embedOne(r.handoff_coach)
          return {
            id: r.id,
            member_id: r.member_id,
            start_date: r.start_date,
            end_date: r.end_date,
            status: r.status,
            membership_stage: r.membership_stage,
            journey_stage: r.journey_stage,
            gym: r.gym,
            pipeline_lost: r.pipeline_lost,
            member_name: md?.member_name ?? null,
            primary_coach: pc?.coach_name ?? null,
            handoff_coach: hc?.coach_name ?? null,
          }
        }),
      )

      setRenewalMeta((metaRes.data ?? []).map((r) => flattenRenewalMetaRow(r as Record<string, unknown>)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load 360 data')
      setWcr([])
      setRenewals([])
      setRenewalMeta([])
    } finally {
      setLoading(false)
    }
  }, [coachId, cycleStart, cycleEnd])

  useEffect(() => {
    void load()
  }, [load])

  return { wcr, renewals, renewalMeta, loading, error, reload: load }
}
