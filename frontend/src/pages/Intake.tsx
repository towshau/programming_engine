import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import { MemberSidebar } from '../components/layout/MemberSidebar'
import { useEditorStore } from '../stores/editorStore'
import {
  getMovementRag,
  getBenchmarkRag,
  MOVEMENT_LABELS,
} from '../lib/scoring'
import type { MemberPhysicals, HealthMetrics } from '../lib/scoring'
import { ProgressTab } from '../features/progress/ProgressTab'

// ────────────────────────────────────────────────────────────────────────────
// Local-only types that live in Intake
// ────────────────────────────────────────────────────────────────────────────

type IntakeTab = 'profile' | 'assessment' | 'progress'

interface MemberProfile {
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

interface MembershipRow {
  id: string
  end_date: string | null
  primary_membership_id: string | null
  newsale: { session_credits: number | null; membership_selected: string | null } | null
  renewal: { session_credits: number | null; membership_selected: string | null } | null
}

// ────────────────────────────────────────────────────────────────────────────
// RAG badge
// ────────────────────────────────────────────────────────────────────────────

function RagBadge({ rag, label }: { rag: 'green' | 'amber' | 'red' | null; label: string }) {
  if (!rag)
    return (
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        —
      </span>
    )

  const styles = {
    green: {
      background: 'var(--green-bg)',
      color: 'var(--green)',
      border: '1px solid var(--green-border)',
      icon: '✓',
    },
    amber: {
      background: 'var(--orange-bg)',
      color: 'var(--orange)',
      border: '1px solid var(--orange-border)',
      icon: '⚠',
    },
    red: {
      background: 'var(--red-bg)',
      color: 'var(--red)',
      border: '1px solid var(--red-border)',
      icon: '🔴',
    },
  }

  const s = styles[rag]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold"
      style={{ background: s.background, color: s.color, border: s.border }}
    >
      {s.icon} {label}
    </span>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Benchmark card
// ────────────────────────────────────────────────────────────────────────────

function BenchmarkCard({
  label,
  value,
  unit,
  field,
  sub,
}: {
  label: string
  value: number | null
  unit: string
  field: string
  sub?: string
}) {
  const rag = getBenchmarkRag(field, value)
  const ragLabel =
    rag === 'green'
      ? 'Good'
      : rag === 'amber'
      ? 'Below average'
      : rag === 'red'
      ? 'Needs work'
      : null

  return (
    <div
      className="bg-white rounded-xl border p-4"
      style={{ borderColor: 'var(--border)' }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-wide mb-2"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </p>
      <p className="text-2xl font-black mb-2" style={{ color: 'var(--text)' }}>
        {value != null ? `${value}` : '—'}
        {value != null && (
          <span
            className="text-sm font-normal ml-1"
            style={{ color: 'var(--text-muted)' }}
          >
            {unit}
          </span>
        )}
      </p>
      {ragLabel && <RagBadge rag={rag} label={ragLabel} />}
      {sub && (
        <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Form field
// ────────────────────────────────────────────────────────────────────────────

function FormField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="mb-3">
      <p
        className="text-[10px] font-semibold uppercase tracking-wide mb-1"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </p>
      <div
        className="px-3 py-2 rounded-lg border text-sm"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--bg3)',
          color: value ? 'var(--text)' : 'var(--text-muted)',
        }}
      >
        {value || '—'}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export function Intake() {
  const { memberId } = useParams<{ memberId: string }>()
  const navigate = useNavigate()
  const { members, selectedMember, selectMember, loading } = useEditorStore()
  const [activeTab, setActiveTab] = useState<IntakeTab>('profile')

  // Latest-row data (profile, movement screen, benchmarks)
  const [physicals, setPhysicals] = useState<MemberPhysicals | null>(null)
  const [physicalsFormDate, setPhysicalsFormDate] = useState<string | null>(null)
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [health, setHealth] = useState<HealthMetrics | null>(null)

  // Historical arrays for the Progress tab
  const [physicalsHistory, setPhysicalsHistory] = useState<MemberPhysicals[]>([])
  const [healthHistory, setHealthHistory] = useState<HealthMetrics[]>([])

  const [loadingData, setLoadingData] = useState(false)
  // Prevents a slow in-flight fetch from overwriting state set by a newer selection
  const loadingForRef = useRef<string | null>(null)

  useEffect(() => {
    if (!memberId || loading.members) return
    if (selectedMember?.member_id === memberId) return
    const match = members.find((m) => m.member_id === memberId)
    if (match) selectMember(match)
  }, [memberId, members, selectedMember, selectMember, loading.members])

  useEffect(() => {
    const id = memberId ?? selectedMember?.member_id
    if (!id) return
    void loadMemberData(id)
  }, [memberId, selectedMember?.member_id])

  async function loadMemberData(id: string) {
    loadingForRef.current = id
    setPhysicals(null)
    setPhysicalsFormDate(null)
    setProfile(null)
    setHealth(null)
    setPhysicalsHistory([])
    setHealthHistory([])
    setLoadingData(true)

    try {
      const today = new Date().toISOString().split('T')[0]

      const [
        physResult,
        profileResult,
        healthResult,
        membershipResult,
        formDateResult,
        physHistResult,
        healthHistResult,
      ] = await Promise.all([
        // Latest physicals row — movement screen, benchmarks, and focus/avoid
        supabase
          .from('member_physicals_raw')
          .select('*')
          .eq('member_id', id)
          .order('submission_date', { ascending: false })
          .limit(1)
          .maybeSingle(),

        // Member profile
        supabase
          .from('member_database')
          .select('first_name, last_name, gym_string, current_status, injuries, goals')
          .eq('id', id)
          .single(),

        // Latest InBody scan
        supabase
          .from('member_health_metrics')
          .select('weight, bf, smm, inbody_score, date_created')
          .eq('member_id', id)
          .order('date_created', { ascending: false })
          .limit(1)
          .maybeSingle(),

        // Active memberships with session credits
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

        // Latest physicals date where source = 'form'
        supabase
          .from('member_physicals_raw')
          .select('submission_date')
          .eq('member_id', id)
          .eq('source', 'form')
          .order('submission_date', { ascending: false })
          .limit(1)
          .maybeSingle(),

        // ALL physicals rows — for Progress tab trends (oldest first)
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

        // ALL health metrics rows — for Progress tab trends (oldest first)
        supabase
          .from('member_health_metrics')
          .select('weight, bf, smm, inbody_score, date_created')
          .eq('member_id', id)
          .order('date_created', { ascending: true }),
      ])

      if (loadingForRef.current !== id) return

      setPhysicals(physResult.data as MemberPhysicals | null)
      setPhysicalsFormDate(
        (formDateResult.data as { submission_date: string | null } | null)
          ?.submission_date ?? null,
      )
      setHealth(healthResult.data as HealthMetrics | null)
      setPhysicalsHistory((physHistResult.data ?? []) as unknown as MemberPhysicals[])
      setHealthHistory((healthHistResult.data ?? []) as unknown as HealthMetrics[])

      // Derive primary/secondary memberships
      const memberships = (membershipResult.data ?? []) as unknown as MembershipRow[]
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

      if (profileResult.data) {
        const pd = profileResult.data as {
          first_name: string
          last_name: string
          gym_string: string
          current_status: string
          injuries: string | null
          goals: string | null
        }
        setProfile({
          first_name: pd.first_name,
          last_name: pd.last_name,
          gym_string: pd.gym_string,
          current_status: pd.current_status,
          injuries: pd.injuries,
          goals: pd.goals,
          primary_membership: primaryMembership,
          secondary_memberships: secondaryMemberships,
          end_date: endDate,
        })
      }
    } finally {
      if (loadingForRef.current === id) setLoadingData(false)
    }
  }

  function handleSelectMember(member: Parameters<typeof selectMember>[0]) {
    selectMember(member)
    if (member) navigate(`/intake/${member.member_id}`, { replace: true })
    else navigate('/intake', { replace: true })
  }

  const currentMemberId = memberId ?? selectedMember?.member_id
  const memberName = selectedMember
    ? `${selectedMember.first_name} ${selectedMember.last_name}`
    : profile
    ? `${profile.first_name} ${profile.last_name}`
    : null

  const tabs: { key: IntakeTab; label: string }[] = [
    { key: 'profile', label: 'Client Profile' },
    { key: 'assessment', label: 'Movement & Benchmarks' },
    { key: 'progress', label: 'Progress' },
  ]

  return (
    <div className="flex h-full">
      <MemberSidebar onSelectMember={handleSelectMember} />
      <div className="flex-1 overflow-y-auto p-7">
        {!currentMemberId ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Select a member from the sidebar to view their intake data.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text)' }}>
                {memberName ?? 'Loading...'}
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Physicals data from Supabase · Auto-populated from assessment
              </p>
            </div>

            {/* Tabs */}
            <div
              className="flex gap-1 mb-6 border-b pb-px"
              style={{ borderColor: 'var(--border)' }}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'px-4 py-2 text-sm font-semibold rounded-t-md border-b-2 transition-colors -mb-px',
                    activeTab === tab.key
                      ? 'border-[var(--color-gold)] text-[var(--color-gold)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {loadingData ? (
              <div className="flex items-center justify-center py-16">
                <div
                  className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                  style={{
                    borderColor: 'var(--border)',
                    borderTopColor: 'var(--color-gold)',
                  }}
                />
              </div>
            ) : (
              <>
                {/* ── Client Profile ── */}
                {activeTab === 'profile' && (
                  <div className="grid grid-cols-2 gap-5">
                    <div
                      className="bg-white rounded-xl border p-5"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <p
                        className="text-[10px] font-bold uppercase tracking-wide mb-4"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Membership & Logistics
                      </p>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <FormField
                          label="Primary membership"
                          value={profile?.primary_membership}
                        />
                        <FormField
                          label="Secondary membership"
                          value={
                            profile?.secondary_memberships.length
                              ? profile.secondary_memberships.join(', ')
                              : null
                          }
                        />
                      </div>
                      <FormField label="Gym" value={profile?.gym_string} />
                      <FormField label="Status" value={profile?.current_status} />
                      <FormField
                        label="Next due date"
                        value={
                          profile?.end_date
                            ? new Date(profile.end_date).toLocaleDateString('en-AU')
                            : null
                        }
                      />
                    </div>

                    <div
                      className="bg-white rounded-xl border p-5"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <p
                        className="text-[10px] font-bold uppercase tracking-wide mb-4"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Health Screening
                      </p>
                      <FormField label="Previous injuries" value={profile?.injuries} />
                      <FormField label="Goals" value={profile?.goals} />
                      <FormField label="Focus program" value={physicals?.focus_program} />
                      <FormField
                        label="Exercises to avoid"
                        value={physicals?.exercise_avoid}
                      />
                    </div>

                    <div
                      className="bg-white rounded-xl border p-5"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <p
                        className="text-[10px] font-bold uppercase tracking-wide mb-4"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Body Composition (Latest Scan)
                      </p>
                      <FormField
                        label="Weight"
                        value={health?.weight ? `${health.weight} kg` : null}
                      />
                      <FormField
                        label="Body fat %"
                        value={health?.bf ? `${health.bf}%` : null}
                      />
                      <FormField
                        label="Muscle mass"
                        value={health?.smm ? `${health.smm} kg` : null}
                      />
                      <FormField
                        label="InBody score"
                        value={
                          health?.inbody_score ? `${health.inbody_score}` : null
                        }
                      />
                      <FormField
                        label="Scan date"
                        value={
                          health?.date_created
                            ? new Date(health.date_created).toLocaleDateString('en-AU')
                            : null
                        }
                      />
                    </div>

                    <div
                      className="bg-white rounded-xl border p-5"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <p
                        className="text-[10px] font-bold uppercase tracking-wide mb-4"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Assessment Date
                      </p>
                      <FormField
                        label="Physicals date"
                        value={
                          physicalsFormDate
                            ? new Date(physicalsFormDate).toLocaleDateString('en-AU')
                            : null
                        }
                      />
                      <FormField label="Cardio test" value={physicals?.picked_cardio} />
                    </div>
                  </div>
                )}

                {/* ── Movement Screen & Benchmarks ── */}
                {activeTab === 'assessment' && (
                  <div className="space-y-8">
                    {/* Movement Screen */}
                    <div>
                      <p
                        className="text-xs font-bold uppercase tracking-wide mb-3"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Movement Screen
                      </p>
                      {!physicals ? (
                        <div
                          className="bg-white rounded-xl border p-8 text-center"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            No physicals data on record for this member.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-5">
                          {(
                            [
                              'squat',
                              'hinge',
                              'shoulder_flexion',
                              'toe_touch',
                            ] as const
                          ).map((col) => {
                            const val = physicals[col]
                            const rag = getMovementRag(col, val)
                            return (
                              <div
                                key={col}
                                className="bg-white rounded-xl border p-5"
                                style={{ borderColor: 'var(--border)' }}
                              >
                                <p
                                  className="text-[10px] font-bold uppercase tracking-wide mb-3"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  {MOVEMENT_LABELS[col]}
                                </p>
                                <div className="flex items-center justify-between">
                                  <span
                                    className="text-sm font-medium"
                                    style={{ color: 'var(--text)' }}
                                  >
                                    {val ?? '—'}
                                  </span>
                                  <RagBadge
                                    rag={rag}
                                    label={
                                      rag === 'green'
                                        ? 'Good range'
                                        : rag === 'amber'
                                        ? 'Limited range'
                                        : rag === 'red'
                                        ? 'Restricted'
                                        : 'No data'
                                    }
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Benchmarks */}
                    <div>
                      <p
                        className="text-xs font-bold uppercase tracking-wide mb-3"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Benchmarks
                      </p>
                      <div className="grid grid-cols-3 gap-4">
                        <BenchmarkCard
                          label="Grip Strength"
                          value={physicals?.grip_strength_value ?? null}
                          unit="kg"
                          field="grip_strength"
                          sub={
                            physicals?.grip_strength_left != null
                              ? `L: ${physicals.grip_strength_left}kg · R: ${physicals.grip_strength_right}kg`
                              : undefined
                          }
                        />
                        <BenchmarkCard
                          label="Chin-over-bar Hold"
                          value={physicals?.chin_hold_value ?? null}
                          unit="sec"
                          field="chin_hold"
                          sub="Upper body pulling capacity"
                        />
                        <BenchmarkCard
                          label="Vertical Jump"
                          value={physicals?.vertical_jump_value ?? null}
                          unit="cm"
                          field="vertical_jump"
                          sub="Power benchmark"
                        />
                        <BenchmarkCard
                          label="RSI"
                          value={physicals?.rsi_value ?? null}
                          unit=""
                          field="rsi"
                          sub="Reactive strength index"
                        />
                        <BenchmarkCard
                          label={
                            physicals?.picked_cardio === 'bike'
                              ? 'Bike Test (avg watts)'
                              : 'VO₂ Max'
                          }
                          value={
                            physicals?.picked_cardio === 'bike'
                              ? (physicals.bike_test_avg_watt ?? null)
                              : (physicals?.vo2_value ?? null)
                          }
                          unit={
                            physicals?.picked_cardio === 'bike' ? 'W' : 'mL/kg/min'
                          }
                          field="vo2"
                          sub="Cardiorespiratory fitness"
                        />
                        <BenchmarkCard
                          label="Push-up Max"
                          value={physicals?.push_ups_value ?? null}
                          unit="reps"
                          field="push_ups"
                          sub="Upper body strength endurance"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Progress ── */}
                {activeTab === 'progress' && (
                  <ProgressTab
                    latestPhysicals={physicals}
                    physicalsHistory={physicalsHistory}
                    healthHistory={healthHistory}
                    memberName={memberName ?? 'Member'}
                  />
                )}
              </>
            )}

            {/* Navigate to program */}
            {currentMemberId && (
              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => navigate(`/program/${currentMemberId}`)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-colors"
                  style={{ background: 'var(--color-gold)' }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.background = 'var(--color-gold-light)')
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.background = 'var(--color-gold)')
                  }
                >
                  Open Programming Engine
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
