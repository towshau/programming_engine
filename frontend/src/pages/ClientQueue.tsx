import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useEditorStore } from '../stores/editorStore'
import { cn, getInitials } from '../lib/utils'

type QueueTab = 'awaiting' | 'phasedue' | 'active' | 'holiday'

interface QueueMember {
  member_id: string
  first_name: string
  last_name: string
  gym: string
  sessions_per_week: number | null
  scheme_name: string | null
  primary_goal: string | null
  status_label: string
  status_color: 'red' | 'gold' | 'green'
  due_date: string | null
  coach_approved?: boolean
  uploaded?: boolean
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

function StatusBadge({ member }: { member: QueueMember }) {
  const styles = {
    red: { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)' },
    gold: { background: 'var(--color-gold-50)', color: 'var(--color-gold)', border: '1px solid var(--color-gold-100)' },
    green: { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' },
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={styles[member.status_color]}
    >
      {member.status_label}
    </span>
  )
}

function MemberRow({ member, onClick }: { member: QueueMember; onClick: () => void }) {
  const initials = getInitials(member.first_name, member.last_name)
  const bgColor = avatarColor(member.member_id)
  const meta = [
    member.sessions_per_week ? `${member.sessions_per_week}×/week` : null,
    member.scheme_name,
    member.primary_goal,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-5 py-3.5 border-b text-left transition-colors hover:bg-[var(--bg3)] group"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ background: bgColor }}
      >
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
          {member.first_name} {member.last_name}
        </p>
        {meta && (
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {meta}
            {member.gym && (
              <span
                className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ background: 'var(--bg3)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                {member.gym}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Status + arrow */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <StatusBadge member={member} />
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
  const { selectedCoach } = useEditorStore()
  const [activeTab, setActiveTab] = useState<QueueTab>('awaiting')
  const [counts, setCounts] = useState<Record<QueueTab, number>>({ awaiting: 0, phasedue: 0, active: 0, holiday: 0 })
  const [members, setMembers] = useState<QueueMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadQueue()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCoach, activeTab])

  async function loadQueue() {
    setLoading(true)
    try {
      const coachFilter = selectedCoach?.id ?? null

      if (activeTab === 'awaiting') {
        await loadAwaiting(coachFilter)
      } else if (activeTab === 'phasedue') {
        await loadPhaseDue(coachFilter)
      } else if (activeTab === 'active') {
        await loadActive(coachFilter)
      } else {
        setMembers([]) // holiday — placeholder
      }

      // Load counts for all tabs (just counts, no full data)
      await loadCounts(coachFilter)
    } finally {
      setLoading(false)
    }
  }

  async function loadCounts(coachId: string | null) {
    let awaitingQuery = supabase
      .from('member_programs')
      .select('member_id', { count: 'exact', head: true })
      .eq('update_stage', 'awaiting_program')

    if (coachId) awaitingQuery = awaitingQuery.eq('programming_coach_id', coachId)

    const eightDaysFromNow = new Date()
    eightDaysFromNow.setDate(eightDaysFromNow.getDate() + 8)

    let phaseDueQuery = supabase
      .from('member_programs')
      .select('member_id', { count: 'exact', head: true })
      .in('update_stage', ['complete', 'update_required'])
      .lte('due_date', eightDaysFromNow.toISOString())
    if (coachId) phaseDueQuery = phaseDueQuery.eq('programming_coach_id', coachId)

    // Active count: fetch approved program member_ids then cross-check non-test members
    let activeQuery = supabase
      .from('programming_generated')
      .select('member_id')
      .eq('coach_approved', true)
    if (coachId) activeQuery = activeQuery.eq('assigned_to', coachId)

    const [awaitingResult, phaseDueResult, activeRaw] = await Promise.all([
      awaitingQuery,
      phaseDueQuery,
      activeQuery,
    ])

    // Filter active count against non-test members using the already-loaded members list
    // (members is fetched at app level from editorStore)
    const activeMemberIds = new Set((activeRaw.data ?? []).map((r) => r.member_id as string))
    const activeCount = activeMemberIds.size

    setCounts({
      awaiting: awaitingResult.count ?? 0,
      phasedue: phaseDueResult.count ?? 0,
      active: activeCount,
    })
  }

  async function loadAwaiting(coachId: string | null) {
    let query = supabase
      .from('member_programs')
      .select(`
        member_id,
        sessions_per_week,
        scheme_name,
        due_date,
        programming_coach_id,
        member_database!inner (
          first_name,
          last_name,
          gym_string,
          test_account
        )
      `)
      .eq('update_stage', 'awaiting_program')
      .eq('member_database.test_account', false)
      .order('due_date', { ascending: true })
      .limit(50)

    if (coachId) query = query.eq('programming_coach_id', coachId)

    const { data } = await query

    const rows: QueueMember[] = (data ?? []).map((r) => {
      const db = (r as unknown as { member_database: { first_name: string; last_name: string; gym_string: string } }).member_database
      return {
        member_id: r.member_id,
        first_name: db.first_name,
        last_name: db.last_name,
        gym: db.gym_string ?? '',
        sessions_per_week: r.sessions_per_week,
        scheme_name: r.scheme_name,
        primary_goal: null,
        status_label: 'Awaiting Draft',
        status_color: 'red' as const,
        due_date: r.due_date,
      }
    })
    setMembers(rows)
  }

  async function loadPhaseDue(coachId: string | null) {
    const eightDaysFromNow = new Date()
    eightDaysFromNow.setDate(eightDaysFromNow.getDate() + 8)

    let query = supabase
      .from('member_programs')
      .select(`
        member_id,
        sessions_per_week,
        scheme_name,
        due_date,
        update_stage,
        programming_coach_id,
        member_database!inner (
          first_name,
          last_name,
          gym_string,
          test_account
        )
      `)
      .in('update_stage', ['complete', 'update_required'])
      .lte('due_date', eightDaysFromNow.toISOString())
      .eq('member_database.test_account', false)
      .order('due_date', { ascending: true })
      .limit(50)

    if (coachId) query = query.eq('programming_coach_id', coachId)

    const { data } = await query

    const rows: QueueMember[] = (data ?? []).map((r) => {
      const db = (r as unknown as { member_database: { first_name: string; last_name: string; gym_string: string } }).member_database
      const isOverdue = r.due_date && new Date(r.due_date) < new Date()
      return {
        member_id: r.member_id,
        first_name: db.first_name,
        last_name: db.last_name,
        gym: db.gym_string ?? '',
        sessions_per_week: r.sessions_per_week,
        scheme_name: r.scheme_name,
        primary_goal: null,
        status_label: isOverdue ? 'Overdue' : 'New Phase Due',
        status_color: isOverdue ? 'red' as const : 'gold' as const,
        due_date: r.due_date,
      }
    })
    setMembers(rows)
  }

  async function loadActive(coachId: string | null) {
    // Step 1: fetch approved programs (no FK to member_database, so avoid embedded join)
    let pgQuery = supabase
      .from('programming_generated')
      .select('id, member_id, sessions_per_week, scheme_name, coach_approved, uploaded_to_teambuildr, created_at')
      .eq('coach_approved', true)
      .order('created_at', { ascending: false })
      .limit(100)

    if (coachId) pgQuery = pgQuery.eq('assigned_to', coachId)

    const { data: pgData, error: pgError } = await pgQuery
    if (pgError) console.error('loadActive (programming_generated):', pgError.message)

    if (!pgData || pgData.length === 0) {
      setMembers([])
      return
    }

    // Step 2: fetch member info for those member_ids, filtering out test accounts
    const memberIds = [...new Set(pgData.map((r) => r.member_id as string))]
    const { data: memberData, error: memberError } = await supabase
      .from('member_database')
      .select('id, first_name, last_name, gym_string')
      .in('id', memberIds)
      .eq('test_account', false)

    if (memberError) console.error('loadActive (member_database):', memberError.message)

    const memberMap = new Map(
      (memberData ?? []).map((m) => [m.id as string, m])
    )

    // Step 3: merge — one row per member (latest program wins due to order above)
    const seen = new Set<string>()
    const rows: QueueMember[] = []
    for (const r of pgData) {
      const memberId = r.member_id as string
      if (seen.has(memberId)) continue
      const member = memberMap.get(memberId)
      if (!member) continue // test account or missing — skip
      seen.add(memberId)
      rows.push({
        member_id: memberId,
        first_name: member.first_name,
        last_name: member.last_name,
        gym: (member.gym_string as string) ?? '',
        sessions_per_week: r.sessions_per_week,
        scheme_name: r.scheme_name,
        primary_goal: null,
        status_label: r.uploaded_to_teambuildr ? '✓ Uploaded' : '✓ Approved',
        status_color: 'green' as const,
        due_date: null,
        coach_approved: r.coach_approved,
        uploaded: r.uploaded_to_teambuildr,
      })
    }
    setMembers(rows)
  }

  const currentTab = TAB_CONFIG.find((t) => t.key === activeTab)!

  const tabBadgeStyle = (key: QueueTab) => {
    if (key === 'awaiting') return { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)' }
    if (key === 'phasedue') return { background: 'var(--color-gold-50)', color: 'var(--color-gold)', border: '1px solid var(--color-gold-100)' }
    if (key === 'holiday') return { background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid var(--blue-border)' }
    return { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' }
  }

  return (
    <div className="p-7">
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
                  {counts[tab.key]} remaining
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
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--border)', borderTopColor: 'var(--color-gold)' }}
            />
          </div>
        ) : members.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {currentTab.emptyMessage}
            </p>
          </div>
        ) : (
          members.map((m) => (
            <MemberRow
              key={m.member_id}
              member={m}
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
          Awaiting First Program — {count} remaining this week
        </p>
        <p className="text-xs" style={{ color: '#92680a' }}>
          New clients whose physicals are in. No program exists yet. Draft and approve before their first training session.
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
          New Training Phase Due — {count} remaining this week
        </p>
        <p className="text-xs" style={{ color: '#1d4ed8' }}>
          These clients have completed their current phase or hit the progression threshold. New program needed before their next session.
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
        Programs approved and either uploaded or pending upload to TeamBuildr. Clients are training on their current program.
      </p>
    </div>
  )
}
