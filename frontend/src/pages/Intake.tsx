import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { cn } from '../lib/utils'
import { MemberSidebar } from '../components/layout/MemberSidebar'
import { useEditorStore } from '../stores/editorStore'
import { ProgressTab } from '../features/progress/ProgressTab'
import { useIntakeData } from '../hooks/useIntakeData'
import { ClientProfileCards } from '../features/intake/ClientProfileCards'
import { MovementBenchmarksSection } from '../features/intake/MovementBenchmarksSection'

type IntakeTab = 'profile' | 'assessment' | 'progress'

export function Intake() {
  const { memberId } = useParams<{ memberId: string }>()
  const navigate = useNavigate()
  const { intakeMembers, selectedMember, selectMember, loading } = useEditorStore()
  const [activeTab, setActiveTab] = useState<IntakeTab>('profile')

  const currentMemberId = memberId ?? selectedMember?.member_id
  const {
    physicals,
    physicalsFormDate,
    profile,
    health,
    physicalsHistory,
    healthHistory,
    loading: loadingData,
  } = useIntakeData(currentMemberId ?? null, { includeHistory: true })

  useEffect(() => {
    if (!memberId || loading.members) return
    if (selectedMember?.member_id === memberId) return
    const match = intakeMembers.find((m) => m.member_id === memberId)
    if (match) selectMember(match)
  }, [memberId, intakeMembers, selectedMember, selectMember, loading.members])

  function handleSelectMember(member: Parameters<typeof selectMember>[0]) {
    selectMember(member)
    if (member) navigate(`/intake/${member.member_id}`, { replace: true })
    else navigate('/intake', { replace: true })
  }

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
      <MemberSidebar onSelectMember={handleSelectMember} source="intake" />
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
                  <ClientProfileCards
                    profile={profile}
                    physicals={physicals}
                    health={health}
                    physicalsFormDate={physicalsFormDate}
                  />
                )}

                {activeTab === 'assessment' && (
                  <MovementBenchmarksSection physicals={physicals} />
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
