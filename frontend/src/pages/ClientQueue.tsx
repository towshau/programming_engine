import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEditorStore } from '../stores/editorStore'
import { cn, getInitials } from '../lib/utils'
import type { MemberWithCoach, ProgramDraftStatus } from '../types/database'

type QueueTab = 'awaiting' | 'phasedue' | 'active' | 'holiday'

const AVATAR_COLORS = [
  '#0891b2', '#7c3aed', '#059669', '#be185d', '#0284c7',
  '#16a34a', '#9333ea', '#db2777', '#2563eb', '#d97706',
  '#b45309', '#0f766e', '#64748b',
]

function avatarColor(name: string) {
  let hash = 0
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const DRAFT_STATUS_CONFIG: Record<ProgramDraftStatus, { label: string; style: React.CSSProperties }> = {
  awaiting_draft: {
    label: 'Awaiting Draft',
    style: { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)' },
  },
  draft_ready: {
    label: 'Draft Ready',
    style: { background: 'var(--color-gold-50)', color: 'var(--color-gold)', border: '1px solid var(--color-gold-100)' },
  },
  approved: {
    label: 'Approved',
    style: { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' },
  },
  uploaded: {
    label: 'Uploaded',
    style: { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' },
  },
}

function DraftStatusBadge({ status }: { status: ProgramDraftStatus }) {
  const config = DRAFT_STATUS_CONFIG[status]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={config.style}
    >
      {config.label}
    </span>
  )
}

function PhaseBadge({ isOverdue }: { isOverdue: boolean }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={
        isOverdue
          ? { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)' }
          : { background: 'var(--color-gold-50)', color: 'var(--color-gold)', border: '1px solid var(--color-gold-100)' }
      }
    >
      {isOverdue ? 'Overdue' : 'New Phase Due'}
    </span>
  )
}

function ActiveBadge({ member }: { member: MemberWithCoach }) {
  const isUploaded = member.draft_status === 'uploaded'
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' }}
    >
      {isUploaded ? '✓ Uploaded' : '✓ Approved'}
    </span>
  )
}

function MemberRow({
  member,
  tab,
  onClick,
}: {
  member: MemberWithCoach
  tab: QueueTab
  onClick: () => void
}) {
  const initials = getInitials(member.first_name, member.last_name)
  const bgColor = avatarColor(member.member_id)
  const meta = [
    member.sessions_per_week ? `${member.sessions_per_week}×/week` : null,
    member.scheme_name,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-5 py-3.5 border-b text-left transition-colors hover:bg-[var(--bg3)] group"
      style={{ borderColor: 'var(--border)' }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ background: bgColor }}
      >
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
          {member.first_name} {member.last_name}
        </p>
        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {meta || '\u00A0'}
          {member.gym && (
            <span
              className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ background: 'var(--bg3)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              {member.gym}
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {tab === 'awaiting' && <DraftStatusBadge status={member.draft_status} />}
        {tab === 'phasedue' && <PhaseBadge isOverdue={false} />}
        {tab === 'active' && <ActiveBadge member={member} />}
        <svg
          className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}

const TAB_CONFIG: { key: QueueTab; label: string; emptyMessage: string }[] = [
  {
    key: 'awaiting',
    label: 'Awaiting First Program',
    emptyMessage: 'No new clients awaiting their first program.',
  },
  {
    key: 'phasedue',
    label: 'New Training Phase Due',
    emptyMessage: 'No clients are due for a new phase this week.',
  },
  {
    key: 'active',
    label: 'Active Programs',
    emptyMessage: 'No active programs found.',
  },
  {
    key: 'holiday',
    label: 'Holiday Programs',
    emptyMessage: 'No holiday programs set up yet.',
  },
]

export function ClientQueue() {
  const navigate = useNavigate()
  const { members, loading, selectedCoach } = useEditorStore()
  const [activeTab, setActiveTab] = React.useState<QueueTab>('awaiting')

  const tabMembers = useMemo(() => {
    const activeMembersWithProgram = members.filter(
      (m) => m.membership_status === 'active' && m.program_status !== 'needs_program'
    )
    return {
      awaiting: members.filter((m) => m.is_new),
      phasedue: members.filter(
        (m) => m.membership_status === 'active' && m.program_status === 'needs_program' && !m.is_new
      ),
      active: activeMembersWithProgram.filter((m) => m.program_status === 'has_program'),
      holiday: [] as MemberWithCoach[],
    }
  }, [members])

  const counts: Record<QueueTab, number> = useMemo(
    () => ({
      awaiting: tabMembers.awaiting.length,
      phasedue: tabMembers.phasedue.length,
      active: tabMembers.active.length,
      holiday: 0,
    }),
    [tabMembers]
  )

  const currentTab = TAB_CONFIG.find((t) => t.key === activeTab)!
  const currentMembers = tabMembers[activeTab]

  const tabBadgeStyle = (key: QueueTab) => {
    if (key === 'awaiting') return { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)' }
    if (key === 'phasedue') return { background: 'var(--color-gold-50)', color: 'var(--color-gold)', border: '1px solid var(--color-gold-100)' }
    if (key === 'holiday') return { background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid var(--blue-border)' }
    return { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' }
  }

  const isLoading = loading.members

  return (
    <div className="p-7">
      {/* Coach filter indicator */}
      {selectedCoach && (
        <div className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          Showing programs for <span className="font-semibold" style={{ color: 'var(--text)' }}>{selectedCoach.first_name} {selectedCoach.last_name}</span>
        </div>
      )}

      {/* Tab strip — 4 equal columns spanning full width */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {TAB_CONFIG.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex flex-col items-start gap-1 px-4 py-3 rounded-lg text-sm font-semibold border transition-all w-full',
                isActive
                  ? 'bg-[var(--text)] text-white border-[var(--text)]'
                  : 'bg-white text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--text-muted)]'
              )}
            >
              <span className="truncate w-full">{tab.label}</span>
              {counts[tab.key] > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                  style={isActive
                    ? { background: 'rgba(255,255,255,0.25)', color: 'white' }
                    : tabBadgeStyle(tab.key)
                  }
                >
                  {counts[tab.key]} {tab.key === 'active' ? 'approved' : 'remaining'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Info banner */}
      <InfoBanner tab={activeTab} count={counts[activeTab]} />

      {/* Member list */}
      <div
        className="bg-white rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--border)' }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--border)', borderTopColor: 'var(--color-gold)' }}
            />
          </div>
        ) : currentMembers.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {currentTab.emptyMessage}
            </p>
          </div>
        ) : (
          currentMembers.map((m) => (
            <MemberRow
              key={m.member_id}
              member={m}
              tab={activeTab}
              onClick={() => navigate(`/program/${m.member_id}`)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function InfoBanner({ tab, count }: { tab: QueueTab; count: number }) {
  if (tab === 'awaiting') {
    return (
      <div
        className="rounded-lg px-4 py-3 mb-5 border"
        style={{ background: '#fffbeb', borderColor: '#fde68a' }}
      >
        <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: 'var(--color-gold)' }}>
          Awaiting First Program — {count} remaining
        </p>
        <p className="text-xs" style={{ color: '#92680a' }}>
          New clients (newsale, joined within 28 days) who need their first program. Badge shows draft workflow status.
        </p>
      </div>
    )
  }
  if (tab === 'phasedue') {
    return (
      <div
        className="rounded-lg px-4 py-3 mb-5 border"
        style={{ background: 'var(--blue-bg)', borderColor: 'var(--blue-border)' }}
      >
        <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: 'var(--blue)' }}>
          New Training Phase Due — {count} remaining
        </p>
        <p className="text-xs" style={{ color: '#1d4ed8' }}>
          Active members with no program, or whose program expires within 8 days. Excludes new members (shown in Awaiting tab).
        </p>
      </div>
    )
  }
  if (tab === 'holiday') {
    return (
      <div
        className="rounded-lg px-4 py-3 mb-5 border"
        style={{ background: 'var(--blue-bg)', borderColor: 'var(--blue-border)' }}
      >
        <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: 'var(--blue)' }}>
          Holiday Programs
        </p>
        <p className="text-xs" style={{ color: '#1d4ed8' }}>
          Travel-friendly and hotel gym programs for members on holiday. These will appear here once configured.
        </p>
      </div>
    )
  }
  return (
    <div
      className="rounded-lg px-4 py-3 mb-5 border"
      style={{ background: 'var(--green-bg)', borderColor: 'var(--green-border)' }}
    >
      <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: 'var(--green)' }}>
        Active Programs — {count} approved
      </p>
      <p className="text-xs" style={{ color: '#15803d' }}>
        Active members with a current, non-expiring program. Approved and either uploaded or pending upload to TeamBuildr.
      </p>
    </div>
  )
}
