import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import { MemberSidebar } from '../components/layout/MemberSidebar'
import { useEditorStore } from '../stores/editorStore'

type IntakeTab = 'profile' | 'movement' | 'benchmarks'

interface MemberPhysicals {
  submission_date: string | null
  squat: string | null
  hinge: string | null
  shoulder_flexion: string | null
  toe_touch: string | null
  grip_strength_value: number | null
  grip_strength_left: number | null
  grip_strength_right: number | null
  chin_hold_value: number | null
  vertical_jump_value: number | null
  rsi_value: number | null
  vo2_value: number | null
  push_ups_value: number | null
  goals: string | null
  injuries: string | null
  picked_cardio: string | null
  bike_test_avg_watt: number | null
  run_test_meters: number | null
  grip_strength_score: number | null
  chin_hold_score: number | null
  vertical_jump_score: number | null
  vo2_score: number | null
  push_ups_score: number | null
}

interface MemberProfile {
  first_name: string
  last_name: string
  gym_string: string
  current_status: string
  sessions_per_week: number | null
  scheme_name: string | null
  due_date: string | null
}

interface HealthMetrics {
  weight: number | null
  bf: number | null
  smm: number | null
  inbody_score: number | null
  date_created: string | null
}

// Movement screen RAG mapping
// The form stores ranges like "0-60", "60-100", "100+" for degrees
// For hinge/shoulder/toe_touch similar categorical options exist
const MOVEMENT_LABELS: Record<string, string> = {
  squat: 'Squat (ROM at Hip)',
  hinge: 'Hinge (Bodyweight Romanian)',
  shoulder_flexion: 'Shoulder Flexion (Lying Supine)',
  toe_touch: 'Toe Touch / Forward Flexion',
}

function getMovementRag(column: string, value: string | null): 'green' | 'amber' | 'red' | null {
  if (!value) return null
  const v = value.trim().toLowerCase()

  if (column === 'squat') {
    if (v === '100+' || v.startsWith('100')) return 'green'
    if (v === '60-100' || v.startsWith('60')) return 'amber'
    return 'red'
  }
  // For hinge, shoulder_flexion, toe_touch: map similarly
  // Assume highest value option is green, middle is amber, lowest is red
  if (v === '100+' || v.startsWith('100') || v.includes('full') || v.includes('good')) return 'green'
  if (v === '60-100' || v.startsWith('60') || v.includes('moderate') || v.includes('limited')) return 'amber'
  return 'red'
}

function RagBadge({ rag, label }: { rag: 'green' | 'amber' | 'red' | null; label: string }) {
  if (!rag) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>

  const styles = {
    green: { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)', icon: '✓' },
    amber: { background: 'var(--orange-bg)', color: 'var(--orange)', border: '1px solid var(--orange-border)', icon: '⚠' },
    red: { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)', icon: '🔴' },
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

function getBenchmarkRag(field: string, value: number | null): 'green' | 'amber' | 'red' | null {
  if (value == null) return null
  // Simple thresholds — adjust per coaching standards
  switch (field) {
    case 'grip_strength': return value >= 45 ? 'green' : value >= 35 ? 'amber' : 'red'
    case 'chin_hold': return value >= 20 ? 'green' : value >= 10 ? 'amber' : 'red'
    case 'vertical_jump': return value >= 40 ? 'green' : value >= 28 ? 'amber' : 'red'
    case 'rsi': return value >= 1.8 ? 'green' : value >= 1.2 ? 'amber' : 'red'
    case 'vo2': return value >= 40 ? 'green' : value >= 32 ? 'amber' : 'red'
    case 'push_ups': return value >= 20 ? 'green' : value >= 10 ? 'amber' : 'red'
    default: return null
  }
}

function BenchmarkCard({
  label, value, unit, field, sub,
}: {
  label: string
  value: number | null
  unit: string
  field: string
  sub?: string
}) {
  const rag = getBenchmarkRag(field, value)
  const ragLabel = rag === 'green' ? 'Good' : rag === 'amber' ? 'Below average' : rag === 'red' ? 'Needs work' : null

  return (
    <div
      className="bg-white rounded-xl border p-4"
      style={{ borderColor: 'var(--border)' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="text-2xl font-black mb-2" style={{ color: 'var(--text)' }}>
        {value != null ? `${value}` : '—'}
        {value != null && <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-muted)' }}>{unit}</span>}
      </p>
      {ragLabel && <RagBadge rag={rag} label={ragLabel} />}
      {sub && <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}

function FormField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <div
        className="px-3 py-2 rounded-lg border text-sm"
        style={{
          borderColor: 'var(--border)',
          background: value ? 'var(--bg3)' : 'var(--bg3)',
          color: value ? 'var(--text)' : 'var(--text-muted)',
        }}
      >
        {value || '—'}
      </div>
    </div>
  )
}

export function Intake() {
  const { memberId } = useParams<{ memberId: string }>()
  const navigate = useNavigate()
  const { members, selectedMember, selectMember, loading } = useEditorStore()
  const [activeTab, setActiveTab] = useState<IntakeTab>('profile')
  const [physicals, setPhysicals] = useState<MemberPhysicals | null>(null)
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [health, setHealth] = useState<HealthMetrics | null>(null)
  const [loadingData, setLoadingData] = useState(false)

  // Auto-select member from URL
  useEffect(() => {
    if (!memberId || loading.members) return
    if (selectedMember?.member_id === memberId) return
    const match = members.find((m) => m.member_id === memberId)
    if (match) selectMember(match)
  }, [memberId, members, selectedMember, selectMember, loading.members])

  // Load data when member changes
  useEffect(() => {
    const id = memberId ?? selectedMember?.member_id
    if (!id) return
    void loadMemberData(id)
  }, [memberId, selectedMember?.member_id])

  async function loadMemberData(id: string) {
    setLoadingData(true)
    try {
      const [physResult, profileResult, healthResult] = await Promise.all([
        supabase
          .from('member_physicals_raw')
          .select('*')
          .eq('member_id', id)
          .order('submission_date', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('member_database')
          .select(`
            first_name, last_name, gym_string, current_status
          `)
          .eq('id', id)
          .single(),
        supabase
          .from('member_health_metrics')
          .select('weight, bf, smm, inbody_score, date_created')
          .eq('member_id', id)
          .order('date_created', { ascending: false })
          .limit(1)
          .single(),
      ])

      // Get program info
      const { data: programData } = await supabase
        .from('member_programs')
        .select('sessions_per_week, scheme_name, due_date')
        .eq('member_id', id)
        .single()

      setPhysicals(physResult.data as MemberPhysicals | null)
      if (profileResult.data) {
        const pd = profileResult.data as { first_name: string; last_name: string; gym_string: string; current_status: string }
        setProfile({
          first_name: pd.first_name,
          last_name: pd.last_name,
          gym_string: pd.gym_string,
          current_status: pd.current_status,
          sessions_per_week: programData?.sessions_per_week ?? null,
          scheme_name: programData?.scheme_name ?? null,
          due_date: programData?.due_date ?? null,
        })
      }
      setHealth(healthResult.data as HealthMetrics | null)
    } finally {
      setLoadingData(false)
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
    { key: 'movement', label: 'Movement Screen' },
    { key: 'benchmarks', label: 'Benchmarks' },
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
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
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
                  style={{ borderColor: 'var(--border)', borderTopColor: 'var(--color-gold)' }}
                />
              </div>
            ) : (
              <>
                {/* Client Profile Tab */}
                {activeTab === 'profile' && (
                  <div className="grid grid-cols-2 gap-5">
                    <div className="bg-white rounded-xl border p-5" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide mb-4" style={{ color: 'var(--text-muted)' }}>
                        Membership & Logistics
                      </p>
                      <FormField label="Sessions per week" value={profile?.sessions_per_week ? `${profile.sessions_per_week}×/week` : null} />
                      <FormField label="Program scheme" value={profile?.scheme_name} />
                      <FormField label="Gym" value={profile?.gym_string} />
                      <FormField label="Status" value={profile?.current_status} />
                      <FormField label="Next due date" value={profile?.due_date ? new Date(profile.due_date).toLocaleDateString('en-AU') : null} />
                    </div>

                    <div className="bg-white rounded-xl border p-5" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide mb-4" style={{ color: 'var(--text-muted)' }}>
                        Health Screening
                      </p>
                      <FormField label="Previous injuries" value={physicals?.injuries} />
                      <FormField label="Goals" value={physicals?.goals} />
                    </div>

                    <div className="bg-white rounded-xl border p-5" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide mb-4" style={{ color: 'var(--text-muted)' }}>
                        Body Composition (Latest Scan)
                      </p>
                      <FormField label="Weight" value={health?.weight ? `${health.weight} kg` : null} />
                      <FormField label="Body fat %" value={health?.bf ? `${health.bf}%` : null} />
                      <FormField label="Muscle mass" value={health?.smm ? `${health.smm} kg` : null} />
                      <FormField label="InBody score" value={health?.inbody_score ? `${health.inbody_score}` : null} />
                      <FormField label="Scan date" value={health?.date_created ? new Date(health.date_created).toLocaleDateString('en-AU') : null} />
                    </div>

                    <div className="bg-white rounded-xl border p-5" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide mb-4" style={{ color: 'var(--text-muted)' }}>
                        Assessment Date
                      </p>
                      <FormField label="Physicals date" value={physicals?.submission_date ? new Date(physicals.submission_date).toLocaleDateString('en-AU') : null} />
                      <FormField label="Cardio test" value={physicals?.picked_cardio} />
                    </div>
                  </div>
                )}

                {/* Movement Screen Tab */}
                {activeTab === 'movement' && (
                  <div>
                    {!physicals ? (
                      <div className="bg-white rounded-xl border p-8 text-center" style={{ borderColor: 'var(--border)' }}>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          No physicals data on record for this member.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-5">
                        {(['squat', 'hinge', 'shoulder_flexion', 'toe_touch'] as const).map((col) => {
                          const val = physicals[col]
                          const rag = getMovementRag(col, val)
                          return (
                            <div
                              key={col}
                              className="bg-white rounded-xl border p-5"
                              style={{ borderColor: 'var(--border)' }}
                            >
                              <p className="text-[10px] font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
                                {MOVEMENT_LABELS[col]}
                              </p>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                                  {val ?? '—'}
                                </span>
                                <RagBadge
                                  rag={rag}
                                  label={
                                    rag === 'green' ? 'Good range'
                                    : rag === 'amber' ? 'Limited range'
                                    : rag === 'red' ? 'Restricted'
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
                )}

                {/* Benchmarks Tab */}
                {activeTab === 'benchmarks' && (
                  <div className="grid grid-cols-3 gap-4">
                    <BenchmarkCard
                      label="Grip Strength"
                      value={physicals?.grip_strength_value ?? null}
                      unit="kg"
                      field="grip_strength"
                      sub={physicals?.grip_strength_left != null ? `L: ${physicals.grip_strength_left}kg · R: ${physicals.grip_strength_right}kg` : undefined}
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
                      label={physicals?.picked_cardio === 'bike' ? 'Bike Test (avg watts)' : 'VO₂ Max'}
                      value={physicals?.picked_cardio === 'bike' ? (physicals.bike_test_avg_watt ?? null) : (physicals?.vo2_value ?? null)}
                      unit={physicals?.picked_cardio === 'bike' ? 'W' : 'mL/kg/min'}
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
                  onMouseOver={e => (e.currentTarget.style.background = 'var(--color-gold-light)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'var(--color-gold)')}
                >
                  Open Programming Engine
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
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
