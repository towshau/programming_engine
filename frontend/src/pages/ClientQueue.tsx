import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEditorStore } from '../stores/editorStore'
import { cn, getInitials } from '../lib/utils'
import type { MemberWithCoach, ProgramDraftStatus, MemberHold, GeneratedProgram } from '../types'
import { MemberDetailModal } from '../features/queue/MemberDetailModal'

function NotesQueueBadge({ count }: { count: number }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)' }}
    >
      {count} note{count !== 1 ? 's' : ''}
    </span>
  )
}

type QueueTab = 'awaiting' | 'phasedue' | 'active' | 'updates' | 'holiday'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

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

const DRAFT_STATUS_ORDER: Record<ProgramDraftStatus, number> = {
  awaiting_draft: 0,
  draft_ready: 1,
  approved: 2,
  uploaded: 3,
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
  const latestNote = member.programming_notes?.[0]
  const meta =
    tab === 'updates' && latestNote
      ? [latestNote.modification as string, latestNote.submission_date ? formatDate(latestNote.submission_date) : null]
          .filter(Boolean)
          .join(' · ')
      : [
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
        {tab === 'updates' && (member.programming_notes?.length ?? 0) > 0 && (
          <NotesQueueBadge count={member.programming_notes!.length} />
        )}
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

function HoldEntry({ hold }: { hold: MemberHold }) {
  return (
    <div
      className="rounded-lg border px-3 py-2.5 space-y-1"
      style={{ borderColor: 'var(--blue-border)', background: 'var(--blue-bg)' }}
    >
      <div className="flex items-center gap-1.5">
        <svg className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--blue)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
        </svg>
        <span className="text-xs font-semibold" style={{ color: 'var(--blue)' }}>
          {formatDate(hold.hold_start)} – {formatDate(hold.hold_end)}
        </span>
      </div>
      {hold.travel_programming_notes && (
        <p className="text-xs leading-snug" style={{ color: '#1d4ed8' }}>
          <span className="font-medium">Travel notes:</span> {hold.travel_programming_notes}
        </p>
      )}
      {hold.hold_notes && (
        <p className="text-xs leading-snug" style={{ color: '#1d4ed8' }}>
          <span className="font-medium">Hold notes:</span> {hold.hold_notes}
        </p>
      )}
    </div>
  )
}

function HolidayProgramEntry({ prog }: { prog: GeneratedProgram }) {
  return (
    <div
      className="rounded-lg border px-3 py-2.5 space-y-1"
      style={{ borderColor: 'var(--color-gold-100)', background: 'var(--color-gold-50)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--color-gold)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
          </svg>
          <span className="text-xs font-semibold" style={{ color: 'var(--color-gold)' }}>
            {prog.holiday_start_date && prog.holiday_end_date
              ? `${formatDate(prog.holiday_start_date)} – ${formatDate(prog.holiday_end_date)}`
              : 'No dates set'}
          </span>
        </div>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={
            prog.coach_approved
              ? { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' }
              : { background: 'rgba(184,134,11,0.15)', color: 'var(--color-gold)', border: '1px solid var(--color-gold-100)' }
          }
        >
          {prog.coach_approved ? 'Approved' : 'Draft'}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[11px]" style={{ color: '#92680a' }}>
        {prog.sessions_per_week && <span>{prog.sessions_per_week}×/week</span>}
        {prog.scheme_name && <span>· {prog.scheme_name}</span>}
        {prog.rep_range && <span>· {prog.rep_range}</span>}
        {prog.duration_weeks && <span>· {prog.duration_weeks}wk</span>}
      </div>
    </div>
  )
}

function HolidayHoldRow({
  member,
  onClick,
}: {
  member: MemberWithCoach
  onClick: () => void
}) {
  const initials = getInitials(member.first_name, member.last_name)
  const bgColor = avatarColor(member.member_id)
  const holds = member.holds ?? []
  const holidayProgs = member.holiday_programs ?? []

  return (
    <div
      className="border-b transition-colors"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Member name header row */}
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[var(--bg3)] group"
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: bgColor }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {member.first_name} {member.last_name}
          </p>
          {member.gym && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: 'var(--bg3)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              {member.gym}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs font-medium" style={{ color: 'var(--blue)' }}>
            Open in Holiday Programs
          </span>
          <svg
            className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-0 px-5 pb-4">
        {/* Column A: Holds */}
        <div className="pr-3 space-y-2 border-r" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--blue)' }}>
            Holds ({holds.length})
          </p>
          {holds.length === 0 ? (
            <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>No upcoming holds</p>
          ) : (
            holds.map((h) => <HoldEntry key={h.id} hold={h} />)
          )}
        </div>

        {/* Column B: Holiday Programs */}
        <div className="pl-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-gold)' }}>
            Holiday Programs ({holidayProgs.length})
          </p>
          {holidayProgs.length === 0 ? (
            <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>No holiday program</p>
          ) : (
            holidayProgs.map((p) => <HolidayProgramEntry key={p.id} prog={p} />)
          )}
        </div>
      </div>
    </div>
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
    key: 'updates',
    label: 'Program Updates',
    emptyMessage: 'No unactioned programming notes for your clients.',
  },
  {
    key: 'holiday',
    label: 'Holiday Programs & Holds',
    emptyMessage: 'No members with upcoming holds or holiday programs.',
  },
]

export function ClientQueue() {
  const navigate = useNavigate()
  const { members, loading, selectedCoach, selectMember } = useEditorStore()
  const [activeTab, setActiveTab] = React.useState<QueueTab>('awaiting')
  const [modalMemberId, setModalMemberId] = useState<string | null>(null)

  const tabMembers = useMemo(() => {
    const activeMembersWithProgram = members.filter(
      (m) => m.membership_status === 'active' && m.program_status !== 'needs_program'
    )
    return {
      awaiting: members
        .filter((m) => m.is_new)
        .sort((a, b) => DRAFT_STATUS_ORDER[a.draft_status] - DRAFT_STATUS_ORDER[b.draft_status]),
      phasedue: members.filter(
        (m) => m.membership_status === 'active' && m.program_status === 'needs_program' && !m.is_new
      ),
      active: activeMembersWithProgram.filter((m) => m.program_status === 'has_program'),
      updates: members
        .filter((m) => (m.programming_notes?.length ?? 0) > 0)
        .sort((a, b) => {
          const da = a.programming_notes?.[0]?.submission_date ?? ''
          const db = b.programming_notes?.[0]?.submission_date ?? ''
          return db.localeCompare(da)
        }),
      holiday: members.filter(
        (m) => (m.holds?.length ?? 0) > 0 || (m.holiday_programs?.length ?? 0) > 0
      ),
    }
  }, [members])

  const counts: Record<QueueTab, number> = useMemo(
    () => ({
      awaiting: tabMembers.awaiting.length,
      phasedue: tabMembers.phasedue.length,
      active: tabMembers.active.length,
      updates: tabMembers.updates.length,
      holiday: tabMembers.holiday.length,
    }),
    [tabMembers]
  )

  const modalMember = modalMemberId
    ? members.find((m) => m.member_id === modalMemberId)
    : null

  const currentTab = TAB_CONFIG.find((t) => t.key === activeTab)!
  const currentMembers = tabMembers[activeTab]

  const tabBadgeStyle = (key: QueueTab) => {
    if (key === 'awaiting') return { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)' }
    if (key === 'updates') return { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)' }
    if (key === 'phasedue') return { background: 'var(--color-gold-50)', color: 'var(--color-gold)', border: '1px solid var(--color-gold-100)' }
    if (key === 'holiday') return { background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid var(--blue-border)' }
    return { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' }
  }

  const isLoading = loading.members

  const tabCountSuffix = (key: QueueTab) => {
    if (key === 'active') return 'approved'
    if (key === 'holiday') return 'remaining'
    return 'remaining'
  }

  return (
    <div className="p-7">
      {/* Coach filter indicator */}
      {selectedCoach && (
        <div className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          Showing programs for <span className="font-semibold" style={{ color: 'var(--text)' }}>{selectedCoach.first_name} {selectedCoach.last_name}</span>
        </div>
      )}

      {/* Tab strip — 4 equal columns spanning full width */}
      <div className="grid grid-cols-5 gap-2 mb-5">
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
                  {counts[tab.key]} {tabCountSuffix(tab.key)}
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
        ) : activeTab === 'holiday' ? (
          currentMembers.map((m) => (
            <HolidayHoldRow
              key={m.member_id}
              member={m}
              onClick={() => {
                selectMember(m)
                navigate('/holiday')
              }}
            />
          ))
        ) : (
          currentMembers.map((m) => (
            <MemberRow
              key={m.member_id}
              member={m}
              tab={activeTab}
              onClick={() => setModalMemberId(m.member_id)}
            />
          ))
        )}
      </div>

      {modalMemberId && modalMember && (
        <MemberDetailModal
          memberId={modalMemberId}
          memberName={`${modalMember.first_name} ${modalMember.last_name}`}
          gymLabel={modalMember.gym}
          onClose={() => setModalMemberId(null)}
          onOpenEditor={() => navigate(`/program/${modalMemberId}`)}
        />
      )}
    </div>
  )
}

function InfoBanner({ tab, count }: { tab: QueueTab; count: number }) {
  if (tab === 'updates') {
    return (
      <div
        className="rounded-lg px-4 py-3 mb-5 border"
        style={{ background: 'var(--red-bg)', borderColor: 'var(--red-border)' }}
      >
        <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: 'var(--red)' }}>
          Program Updates — {count} remaining
        </p>
        <p className="text-xs" style={{ color: '#b91c1c' }}>
          Members with unactioned rows in <strong>member_programming_notes</strong> (coach-scoped like other queues). Open a member to review notes in the Program Editor and mark them implemented.
        </p>
      </div>
    )
  }
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
          Holiday Programs & Holds — {count} member{count !== 1 ? 's' : ''}
        </p>
        <p className="text-xs" style={{ color: '#1d4ed8' }}>
          Members with upcoming holds. Left column shows hold dates and notes; right column shows any associated holiday programs. Click a member to open their Holiday Programs page.
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
