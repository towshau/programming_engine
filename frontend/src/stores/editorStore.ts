import { create } from 'zustand'

export type ProgramViewMode = 'day' | 'weekly'
import type {
  Coach,
  MemberWithCoach,
  GeneratedProgram,
  MemberHold,
  CoachEdit,
  ExerciseLibraryItem,
  ProgressionScheme,
  RegenerationRequest,
  PastProgramInfo,
  PendingEdit,
  EditType,
  ExerciseBestsMap,
} from '../types'
import { supabase } from '../lib/supabase'
import { applyEdits } from '../lib/applyEdits'
import { validateSessionsReps, type RepsValidationError } from '../lib/reps'
import { buildTemplateProgram, buildSingleSession } from '../lib/templateBuilder'
import type { DayType } from '../lib/templateBuilder'

/** `staff_database.role` values shown in the Program Editor coach filter (exact strings). */
export const PROGRAMMING_COACH_ROLES = [
  'Coach',
  'Advanced Coach',
  'Gym Manager',
  'Senior Coach',
  'Casual Coach',
  'Head of Exercise',
] as const

export const SELECTED_COACH_STORAGE_KEY = 'lr-selected-coach-id'

/**
 * Detect when an incoming edit reverses a chain of pending edits on the same
 * exercise/field back to its original value.  Returns the indices to remove,
 * or null if no cancellation applies.
 */
function editsMatchExercise(a: PendingEdit, b: PendingEdit): boolean {
  if (a.row_id && b.row_id) {
    return a.row_id === b.row_id
  }
  return a.series_label === b.series_label
}

function findCancellableChain(
  pending: PendingEdit[],
  incoming: PendingEdit,
): number[] | null {
  const { edit_type, session_day } = incoming

  if (edit_type === 'exercise_delete') {
    const idx = pending.findIndex(
      (e) =>
        e.edit_type === 'exercise_add' &&
        e.session_day === session_day &&
        editsMatchExercise(e, incoming),
    )
    return idx !== -1 ? [idx] : null
  }

  if (edit_type === 'exercise_add') return null

  if (edit_type === 'series_change') {
    const chainIndices = collectChain(pending, edit_type, session_day, incoming)
    if (chainIndices.length > 0) {
      const first = pending[chainIndices[0]]
      if (
        String(incoming.new_value.series_label) ===
        String(first.old_value.series_label)
      ) {
        return chainIndices
      }
    }
    return null
  }

  if (edit_type === 'exercise_swap') {
    const chainIndices = collectChain(pending, edit_type, session_day, incoming)
    if (chainIndices.length > 0) {
      const first = pending[chainIndices[0]]
      if (
        String(incoming.new_value.exercise_id) ===
        String(first.old_value.exercise_id)
      ) {
        return chainIndices
      }
    }
    return null
  }

  const keyMap: Partial<Record<EditType, string>> = {
    unit_change: 'unit',
    reps_change: 'reps',
    sets_change: 'sets',
    notes_change: 'notes',
  }
  const key = keyMap[edit_type]
  if (!key) return null

  const chainIndices = collectChain(pending, edit_type, session_day, incoming)
  if (chainIndices.length > 0) {
    const first = pending[chainIndices[0]]
    if (String(incoming.new_value[key]) === String(first.old_value[key])) {
      return chainIndices
    }
  }
  return null
}

function collectChain(
  pending: PendingEdit[],
  editType: EditType,
  sessionDay: number,
  ref: PendingEdit,
): number[] {
  const indices: number[] = []
  for (let i = 0; i < pending.length; i++) {
    const e = pending[i]
    if (
      e.edit_type === editType &&
      e.session_day === sessionDay &&
      editsMatchExercise(e, ref)
    ) {
      indices.push(i)
    }
  }
  return indices
}

type ActiveView = 'next' | 'last'
export type ProgramViewMode = 'day' | 'weekly'

interface EditorState {
  coaches: Coach[]
  selectedCoach: Coach | null
  members: MemberWithCoach[]
  selectedMember: MemberWithCoach | null
  program: GeneratedProgram | null
  previousProgram: GeneratedProgram | null
  pastProgramInfo: PastProgramInfo | null
  savedEdits: CoachEdit[]
  pendingEdits: PendingEdit[]
  activeView: ActiveView
  previousSavedEdits: CoachEdit[]
  previousPendingEdits: PendingEdit[]
  previousSelectedDay: number | null
  exerciseLibrary: ExerciseLibraryItem[]
  progressionSchemes: ProgressionScheme[]
  pendingRegen: RegenerationRequest | null
  regenError: string | null
  lastProgramExpanded: boolean
  complianceDates: string[]
  exerciseBests: ExerciseBestsMap
  saveValidationErrors: RepsValidationError[] | null
  saveError: string | null
  selectedDay: number | null
  memberHolds: MemberHold[]
  holidayPrograms: GeneratedProgram[]
  configDraft: {
    scheme_name: string
    rep_range: string
    sessions_per_week: number
    duration_weeks: number
  } | null
  loading: {
    coaches: boolean
    members: boolean
    program: boolean
    saving: boolean
    regenerating: boolean
  }

  fetchCoaches: () => Promise<void>
  selectCoach: (coach: Coach | null) => void
  fetchMembers: (coachId?: string | null) => Promise<void>
  selectMember: (member: MemberWithCoach | null) => void
  fetchProgram: (memberId: string) => Promise<void>
  fetchEdits: (programId: string) => Promise<void>
  fetchPreviousEdits: (programId: string) => Promise<void>
  fetchExerciseLibrary: () => Promise<void>
  fetchProgressionSchemes: () => Promise<void>
  setSelectedDay: (day: number | null) => void
  setActiveView: (view: ActiveView) => void
  setPreviousSelectedDay: (day: number | null) => void
  addPendingEdit: (edit: PendingEdit) => void
  saveProgram: () => Promise<boolean>
  finalizeProgram: () => Promise<boolean>
  markUploaded: () => Promise<boolean>
  hasPendingChanges: () => boolean
  allEdits: () => (CoachEdit | PendingEdit)[]
  updateConfigDraft: (patch: Partial<NonNullable<EditorState['configDraft']>>) => void
  saveDurationWeeks: (weeks: number) => Promise<void>
  requestRegeneration: () => Promise<void>
  generateFirstProgram: (config: {
    sessions_per_week: number
    scheme_name: string
    rep_range: string
    duration_weeks: number
  }) => Promise<void>
  programViewMode: ProgramViewMode
  setProgramViewMode: (mode: ProgramViewMode) => void
  toggleLastProgram: () => void
  fetchComplianceDates: (memberId: string, startDate: string, endDate: string) => Promise<void>
  fetchExerciseBests: (memberId: string, exerciseNames: string[], periodStart?: string, periodEnd?: string) => Promise<void>
  copyPreviousToNext: () => Promise<boolean>
  addDay: (dayType: DayType) => Promise<boolean>
  deleteDay: (dayNumber: number) => Promise<boolean>
  swapDays: (dayA: number, dayB: number) => Promise<boolean>
  hasConfigChanges: () => boolean
  clearRegenError: () => void
  clearSaveValidationError: () => void
  hasRepsError: (sessionDay: number, seriesLabel: string) => boolean
  fetchMemberHolds: (memberId: string) => Promise<void>
  fetchHolidayPrograms: (memberId: string) => Promise<void>
  generateHolidayProgram: (config: {
    holiday_start_date: string
    holiday_end_date: string
    sessions_per_week: number
    scheme_name: string
    rep_range: string
    duration_weeks: number
  }) => Promise<GeneratedProgram | null>
  loadProgramById: (programId: string) => Promise<void>
}

export const useEditorStore = create<EditorState>((set, get) => ({
  coaches: [],
  selectedCoach: null,
  members: [],
  selectedMember: null,
  program: null,
  previousProgram: null,
  pastProgramInfo: null,
  savedEdits: [],
  pendingEdits: [],
  activeView: 'next' as ActiveView,
  previousSavedEdits: [],
  previousPendingEdits: [],
  previousSelectedDay: null,
  exerciseLibrary: [],
  progressionSchemes: [],
  pendingRegen: null,
  lastProgramExpanded: false,
  complianceDates: [],
  exerciseBests: {},
  regenError: null,
  saveValidationErrors: null,
  saveError: null,
  selectedDay: null,
  memberHolds: [],
  holidayPrograms: [],
  configDraft: null,
  programViewMode: 'day' as ProgramViewMode,
  loading: { coaches: false, members: false, program: false, saving: false, regenerating: false },

  fetchCoaches: async () => {
    set((s) => ({ loading: { ...s.loading, coaches: true } }))
    const { data } = await supabase
      .from('staff_database')
      .select('id, first_name, last_name')
      .in('role', [...PROGRAMMING_COACH_ROLES])
      .eq('staff_status', 'active')
      .order('first_name')

    set({ coaches: (data as Coach[] | null) ?? [] })
    set((s) => ({ loading: { ...s.loading, coaches: false } }))

    let storedId: string | null = null
    try {
      storedId = localStorage.getItem(SELECTED_COACH_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    if (storedId) {
      const coach = get().coaches.find((c) => c.id === storedId) ?? null
      if (coach) {
        get().selectCoach(coach)
        return
      }
      try {
        localStorage.removeItem(SELECTED_COACH_STORAGE_KEY)
      } catch {
        /* ignore */
      }
    }
    get().fetchMembers()
  },

  selectCoach: (coach) => {
    try {
      if (coach?.id) {
        localStorage.setItem(SELECTED_COACH_STORAGE_KEY, coach.id)
      } else {
        localStorage.removeItem(SELECTED_COACH_STORAGE_KEY)
      }
    } catch {
      /* ignore */
    }
    set({
      selectedCoach: coach,
      selectedMember: null,
      program: null,
      previousProgram: null,
      pastProgramInfo: null,
      savedEdits: [],
      pendingEdits: [],
      activeView: 'next' as ActiveView,
      previousSavedEdits: [],
      previousPendingEdits: [],
      previousSelectedDay: null,
      selectedDay: null,
      members: [],
      configDraft: null,
      pendingRegen: null,
      lastProgramExpanded: false,
      complianceDates: [],
    })
    get().fetchMembers(coach?.id ?? null)
  },

  fetchMembers: async (coachId?: string | null) => {
    set((s) => ({ loading: { ...s.loading, members: true } }))

    const NEW_MEMBER_DAYS = 28
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - NEW_MEMBER_DAYS)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)

    const [allMembersRes, activeMembershipRes, pgRes, mpRes, holdsRes, holidayProgRes] = await Promise.all([
      supabase
        .from('member_database')
        .select('id, first_name, last_name, member_name')
        .order('member_name')
        .limit(2000),
      supabase
        .from('member_memberships')
        .select('member_id, gym, start_date, end_date, journey_stage, status, membership_stage, pipeline_lost')
        .gt('end_date', today)
        .not('journey_stage', 'eq', 'no_sale')
        .not('journey_stage', 'eq', 'not_renewing')
        .not('journey_stage', 'eq', 'expired')
        .not('status', 'eq', 'f&f')
        .limit(2000),
      supabase
        .from('programming_generated')
        .select('member_id, next_due_date, created_at, duration_weeks, coach_approved, uploaded_to_teambuildr')
        .order('created_at', { ascending: false })
        .limit(5000),
      supabase.from('member_programs').select('member_id, programming_coach_id, sessions_per_week, scheme_name').limit(5000),
      supabase
        .from('member_holds')
        .select('id, member_id, membership_id, hold_start, hold_end, hold_notes, travel_programming_notes')
        .gte('hold_end', today)
        .order('hold_start', { ascending: true })
        .limit(2000),
      supabase
        .from('programming_generated')
        .select('id, member_id, sessions_per_week, duration_weeks, scheme_name, rep_range, program_type, holiday_start_date, holiday_end_date, coach_approved, changes_summary, created_at, updated_at, run_id, assigned_to, phase_number, rules_applied, payload, coach_edited, uploaded_to_teambuildr, next_due_date')
        .eq('program_type', 'holiday')
        .gte('holiday_end_date', today)
        .order('holiday_start_date', { ascending: true })
        .limit(2000),
    ])

    // Keep track of the most recent program for each member to check expiration
    interface ProgInfo {
      next_due_date: string | null
      created_at: string
      duration_weeks: number | null
      coach_approved: boolean
      uploaded_to_teambuildr: boolean
    }
    const pgMap = new Map<string, ProgInfo>()
    for (const row of (pgRes.data ?? []) as { member_id: string, next_due_date: string | null, created_at: string, duration_weeks: number | null, coach_approved: boolean, uploaded_to_teambuildr: boolean }[]) {
      if (!pgMap.has(row.member_id)) {
        pgMap.set(row.member_id, {
          next_due_date: row.next_due_date,
          created_at: row.created_at,
          duration_weeks: row.duration_weeks,
          coach_approved: row.coach_approved ?? false,
          uploaded_to_teambuildr: row.uploaded_to_teambuildr ?? false,
        })
      }
    }

    /** Source of truth for coach assignment in Program Editor (aligns with run_weekly_batch, Retool). */
    interface MpInfo {
      coach_id: string
      sessions_per_week: number | null
      scheme_name: string | null
    }
    const mpCoachMap = new Map<string, MpInfo>()
    for (const row of (mpRes.data ?? []) as Record<string, unknown>[]) {
      const mid = row.member_id as string
      if (mid) mpCoachMap.set(mid, {
        coach_id: (row.programming_coach_id as string) || '',
        sessions_per_week: (row.sessions_per_week as number) ?? null,
        scheme_name: (row.scheme_name as string) ?? null,
      })
    }

    // Build holds map: member_id → MemberHold[]
    const holdsMap = new Map<string, MemberHold[]>()
    for (const row of (holdsRes.data ?? []) as MemberHold[]) {
      const existing = holdsMap.get(row.member_id)
      if (existing) existing.push(row)
      else holdsMap.set(row.member_id, [row])
    }

    // Build holiday programs map: member_id → GeneratedProgram[]
    const holidayProgMap = new Map<string, GeneratedProgram[]>()
    for (const row of (holidayProgRes.data ?? []) as GeneratedProgram[]) {
      const existing = holidayProgMap.get(row.member_id)
      if (existing) existing.push(row)
      else holidayProgMap.set(row.member_id, [row])
    }

    interface ActiveInfo {
      gym: string
      start_date: string
      membership_stage: string
      not_renewing: boolean
    }
    const activeMap = new Map<string, ActiveInfo>()
    for (const row of (activeMembershipRes.data ?? []) as Record<string, unknown>[]) {
      const mid = row.member_id as string
      const existing = activeMap.get(mid)
      const startDate = (row.start_date as string) || ''
      const notRenewing = !!(row.pipeline_lost)
      if (!existing || startDate > existing.start_date) {
        activeMap.set(mid, {
          gym: (row.gym as string) || '',
          start_date: startDate,
          membership_stage: (row.membership_stage as string) || '',
          not_renewing: notRenewing,
        })
      }
    }

    const members: MemberWithCoach[] = []
    for (const row of (allMembersRes.data ?? []) as Record<string, unknown>[]) {
      const mid = row.id as string
      const active = activeMap.get(mid)
      const isActive = !!active && !active.not_renewing
      const mpInfo = mpCoachMap.get(mid)
      const mpCoach = mpInfo?.coach_id || ''

      if (coachId && mpCoach !== coachId) continue

      const fullName = (row.member_name as string) || ''
      const firstName = (row.first_name as string) || fullName.split(' ')[0] || ''
      const lastName = (row.last_name as string) || fullName.split(' ').slice(1).join(' ') || ''
      const startDate = active?.start_date || ''
      
      const progInfo = pgMap.get(mid)
      const hasProgram = !!progInfo
      
      // Check if program is expiring within 8 days
      let isExpiring = false
      if (progInfo) {
        let expiryDate: Date | null = null
        if (progInfo.next_due_date) {
          expiryDate = new Date(progInfo.next_due_date)
          expiryDate.setDate(expiryDate.getDate() - 1)
        } else if (progInfo.created_at && progInfo.duration_weeks) {
          expiryDate = new Date(progInfo.created_at)
          expiryDate.setDate(expiryDate.getDate() + progInfo.duration_weeks * 7)
        }
        
        if (expiryDate) {
          const in8Days = new Date()
          in8Days.setDate(in8Days.getDate() + 8)
          if (expiryDate <= in8Days) {
            isExpiring = true
          }
        }
      }

      const withinNewWindow = (startDate > today) || (!!startDate && startDate >= cutoffStr)
      const isNew = withinNewWindow && active?.membership_stage === 'newsale'

      // Derive draft workflow status for the "Awaiting First Program" tab
      let draftStatus: import('../types/database').ProgramDraftStatus = 'awaiting_draft'
      if (progInfo) {
        if (progInfo.uploaded_to_teambuildr) draftStatus = 'uploaded'
        else if (progInfo.coach_approved) draftStatus = 'approved'
        else draftStatus = 'draft_ready'
      }

      members.push({
        member_id: mid,
        member_name: fullName,
        first_name: firstName,
        last_name: lastName,
        gym: active?.gym || '',
        programming_coach_id: mpCoach,
        membership_status: isActive ? 'active' : 'inactive',
        program_status: (!hasProgram || isExpiring) ? 'needs_program' : isNew ? 'new_member' : 'has_program',
        is_new: isNew,
        sessions_per_week: mpInfo?.sessions_per_week ?? null,
        scheme_name: mpInfo?.scheme_name ?? null,
        draft_status: draftStatus,
        holds: holdsMap.get(mid) ?? [],
        holiday_programs: holidayProgMap.get(mid) ?? [],
      })
    }

    type PStatus = 'new_member' | 'needs_program' | 'has_program'
    const programRank: Record<PStatus, number> = { needs_program: 0, new_member: 1, has_program: 2 }
    members.sort((a, b) => {
      const aActive = a.membership_status === 'active' ? 0 : 1
      const bActive = b.membership_status === 'active' ? 0 : 1
      if (aActive !== bActive) return aActive - bActive
      if (aActive === 0) {
        const ps = programRank[a.program_status] - programRank[b.program_status]
        if (ps !== 0) return ps
      }
      return a.member_name.localeCompare(b.member_name)
    })

    set({ members })
    set((s) => ({ loading: { ...s.loading, members: false } }))
  },

  selectMember: (member) => {
    set({
      selectedMember: member,
      program: null,
      previousProgram: null,
      pastProgramInfo: null,
      savedEdits: [],
      pendingEdits: [],
      activeView: 'next' as ActiveView,
      previousSavedEdits: [],
      previousPendingEdits: [],
      previousSelectedDay: null,
      selectedDay: null,
      configDraft: null,
      pendingRegen: null,
      lastProgramExpanded: false,
      complianceDates: [],
      memberHolds: [],
      holidayPrograms: [],
    })
    if (member) {
      get().fetchProgram(member.member_id)
      void get().fetchMemberHolds(member.member_id)
      void get().fetchHolidayPrograms(member.member_id)
    }
  },

  fetchProgram: async (memberId: string) => {
    set((s) => ({ loading: { ...s.loading, program: true } }))

    const { data } = await supabase
      .from('programming_generated')
      .select('*')
      .eq('member_id', memberId)
      .neq('program_type', 'holiday')
      .order('created_at', { ascending: false })
      .limit(2)

    if (data && data.length > 0) {
      const current = data[0] as GeneratedProgram
      const previous = (data[1] as GeneratedProgram) ?? null
      let pastInfo: PastProgramInfo | null = null

      if (previous) {
        pastInfo = {
          source: 'generated',
          created_at: previous.created_at,
          scheme_name: previous.scheme_name,
          rep_range: previous.rep_range,
          phase_number: previous.phase_number,
          sessions_per_week: previous.sessions_per_week,
          duration_weeks: previous.duration_weeks,
          confidence: previous.payload?.metadata?.confidence ?? null,
        }
      } else {
        const { data: normData } = await supabase
          .from('programming_normalized_programs')
          .select('id, created_at, payload')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false })
          .limit(1)

        if (normData && normData.length > 0) {
          const norm = normData[0] as { id: string; created_at: string; payload: { sessions?: { day: string }[]; phase_detection?: { current_rep_range?: string; confidence?: string } } }
          const sessions = norm.payload?.sessions ?? []
          const days = sessions.map((s) => s.day).filter(Boolean).sort()
          pastInfo = {
            source: 'normalized',
            created_at: norm.created_at,
            session_count: sessions.length,
            confidence: norm.payload?.phase_detection?.confidence ?? null,
            rep_range: norm.payload?.phase_detection?.current_rep_range ?? null,
            date_range: days.length > 0 ? { from: days[0], to: days[days.length - 1] } : undefined,
          }
        }
      }

      set({
        program: current,
        previousProgram: previous,
        pastProgramInfo: pastInfo,
        selectedDay: 1,
        pendingEdits: [],
        activeView: 'next' as ActiveView,
        previousPendingEdits: [],
        previousSelectedDay: previous?.payload?.sessions?.[0]?.day ?? 1,
        configDraft: {
          scheme_name: current.scheme_name ?? 'GPP',
          rep_range: current.rep_range ?? '8-10',
          sessions_per_week: current.sessions_per_week,
          duration_weeks: current.duration_weeks,
        },
      })
      get().fetchEdits(current.id)
      if (previous) {
        get().fetchPreviousEdits(previous.id)
        get().fetchComplianceDates(
          memberId,
          previous.created_at.slice(0, 10),
          current.created_at.slice(0, 10),
        )
      } else {
        set({ previousSavedEdits: [], complianceDates: [] })
      }

      const { data: regenData } = await supabase
        .from('programming_regeneration_requests')
        .select('*')
        .eq('member_id', memberId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
      if (regenData && regenData.length > 0) {
        set({ pendingRegen: regenData[0] as RegenerationRequest })
      } else {
        set({ pendingRegen: null })
      }

      const exerciseNames = new Set<string>()
      current.payload.sessions.forEach(s => {
        s.exercises.forEach(e => {
          if (e.exercise_name) exerciseNames.add(e.exercise_name)
        })
      })
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      const pStart = sixMonthsAgo.toISOString().slice(0, 10)
      const pEnd = new Date().toISOString().slice(0, 10)
      void get().fetchExerciseBests(memberId, Array.from(exerciseNames), pStart, pEnd)
    } else {
      set({ program: null, previousProgram: null, pastProgramInfo: null, configDraft: null, previousSavedEdits: [], previousPendingEdits: [], previousSelectedDay: null, lastProgramExpanded: false, complianceDates: [], exerciseBests: {} })
    }
    set((s) => ({ loading: { ...s.loading, program: false } }))
  },

  fetchEdits: async (programId: string) => {
    const { data } = await supabase
      .from('programming_coach_edits')
      .select('*')
      .eq('program_id', programId)
      .order('created_at', { ascending: true })

    set({ savedEdits: (data as CoachEdit[] | null) ?? [] })
  },

  fetchPreviousEdits: async (programId: string) => {
    const { data } = await supabase
      .from('programming_coach_edits')
      .select('*')
      .eq('program_id', programId)
      .order('created_at', { ascending: true })

    set({ previousSavedEdits: (data as CoachEdit[] | null) ?? [] })
  },

  fetchExerciseLibrary: async () => {
    const { data } = await supabase
      .from('exercise_library')
      .select('id, exercise_id, exercise_name, tags, series_assignment')
      .order('exercise_name')

    if (data) set({ exerciseLibrary: data as ExerciseLibraryItem[] })
  },

  fetchProgressionSchemes: async () => {
    const { data } = await supabase
      .from('programming_progression_schemes')
      .select('id, name, from_rep_range, to_rep_range, exercise_behavior, order')
      .eq('active', true)
      .order('name')
      .order('order')

    if (data) set({ progressionSchemes: data as ProgressionScheme[] })
  },

  setSelectedDay: (day) => set({ selectedDay: day }),
  setActiveView: (view) => set({ activeView: view, saveValidationErrors: null, saveError: null }),
  setPreviousSelectedDay: (day) => set({ previousSelectedDay: day }),

  setProgramViewMode: (mode) => set({ programViewMode: mode }),

  toggleLastProgram: () => {
    set((s) => ({
      lastProgramExpanded: !s.lastProgramExpanded,
      previousSelectedDay:
        !s.lastProgramExpanded && s.previousSelectedDay === null
          ? 1
          : s.previousSelectedDay,
    }))
  },

  fetchComplianceDates: async (memberId, startDate, endDate) => {
    const { data } = await supabase
      .from('member_tbresults')
      .select('completed_date')
      .eq('member_id', memberId)
      .gte('completed_date', startDate)
      .lte('completed_date', endDate)
      .not('completed_date', 'is', null)

    if (data) {
      const dates = [
        ...new Set(
          data.map((r: { completed_date: string }) =>
            String(r.completed_date).slice(0, 10),
          ),
        ),
      ].sort()
      set({ complianceDates: dates })
    }
  },

  fetchExerciseBests: async (memberId, exerciseNames, periodStart, periodEnd) => {
    if (!exerciseNames || exerciseNames.length === 0) {
      set({ exerciseBests: {} })
      return
    }

    const [periodRes, allTimeRes] = await Promise.all([
      periodStart && periodEnd
        ? supabase
            .from('member_tbresults')
            .select('exercise_name, result, reps, set_number')
            .eq('member_id', memberId)
            .in('exercise_name', exerciseNames)
            .gte('completed_date', periodStart)
            .lte('completed_date', periodEnd)
            .not('result', 'is', null)
            .not('result', 'eq', '0')
            .not('result', 'eq', '')
            .gt('reps', 0)
        : Promise.resolve({ data: null }),
      supabase
        .from('member_tbresults')
        .select('exercise_name, result, reps, set_number')
        .eq('member_id', memberId)
        .in('exercise_name', exerciseNames)
        .not('result', 'is', null)
        .not('result', 'eq', '0')
        .not('result', 'eq', '')
        .gt('reps', 0),
    ])

    const processRows = (rows: { exercise_name: string; result: string; reps: number; set_number: number }[] | null) => {
      const bests = new Map<string, { result: number; reps: number; set_number: number }>()
      for (const r of (rows || [])) {
        const val = parseFloat(r.result)
        if (isNaN(val)) continue
        const current = bests.get(r.exercise_name)
        if (!current || val > current.result || (val === current.result && r.reps > current.reps)) {
          bests.set(r.exercise_name, { result: val, reps: r.reps, set_number: r.set_number })
        }
      }
      return bests
    }

    const periodMap = processRows(periodRes.data)
    const allTimeMap = processRows(allTimeRes.data)

    const finalBests: ExerciseBestsMap = {}
    for (const name of exerciseNames) {
      finalBests[name] = {
        period: periodMap.get(name) || null,
        allTime: allTimeMap.get(name) || null,
      }
    }

    set({ exerciseBests: finalBests })
  },

  addPendingEdit: (edit: PendingEdit) => {
    set((s) => {
      if (s.activeView === 'last') {
        const cancellable = findCancellableChain(s.previousPendingEdits, edit)
        if (cancellable) {
          const kept = s.previousPendingEdits.filter((_, i) => !cancellable.includes(i))
          return { previousPendingEdits: kept }
        }
        return { previousPendingEdits: [...s.previousPendingEdits, edit] }
      }
      const cancellable = findCancellableChain(s.pendingEdits, edit)
      if (cancellable) {
        const kept = s.pendingEdits.filter((_, i) => !cancellable.includes(i))
        return { pendingEdits: kept }
      }
      return { pendingEdits: [...s.pendingEdits, edit] }
    })
  },

  saveProgram: async () => {
    const { activeView, program, previousProgram } = get()
    const isLast = activeView === 'last'
    const targetProgram = isLast ? previousProgram : program
    const currentPending = isLast ? get().previousPendingEdits : get().pendingEdits
    const currentSaved = isLast ? get().previousSavedEdits : get().savedEdits

    if (!targetProgram || currentPending.length === 0) return false

    const combinedEdits = [...currentSaved, ...currentPending] as CoachEdit[]
    const editedSessions = applyEdits(targetProgram.payload.sessions, combinedEdits)
    const validationErrors = validateSessionsReps(editedSessions)
    if (validationErrors.length > 0) {
      set({ saveValidationErrors: validationErrors })
      return false
    }

    set({ saveValidationErrors: null, saveError: null })
    set((s) => ({ loading: { ...s.loading, saving: true } }))

    const wasUploaded = targetProgram.uploaded_to_teambuildr
    const bakedPayload = {
      ...targetProgram.payload,
      sessions: editedSessions,
    }
    const patch: Record<string, unknown> = {
      payload: bakedPayload,
      coach_edited: true,
      updated_at: new Date().toISOString(),
    }
    if (wasUploaded) {
      patch.uploaded_to_teambuildr = false
    }

    const { error: updateError } = await supabase
      .from('programming_generated')
      .update(patch)
      .eq('id', targetProgram.id)

    if (updateError) {
      set((s) => ({
        loading: { ...s.loading, saving: false },
        saveError: updateError.message ?? 'Save failed. Please try again.',
      }))
      return false
    }

    // Payload baked successfully — purge any lingering coach_edits with retry
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error: delError } = await supabase
        .from('programming_coach_edits')
        .delete()
        .eq('program_id', targetProgram.id)
      if (!delError) break
      if (attempt === 1) {
        console.warn(
          '[saveProgram] Failed to delete coach_edits after 2 attempts:',
          delError.message,
        )
      }
    }

    if (isLast) {
      set((s) => ({
        previousSavedEdits: [],
        previousPendingEdits: [],
        previousProgram: s.previousProgram
          ? {
              ...s.previousProgram,
              payload: bakedPayload,
              coach_edited: true,
              uploaded_to_teambuildr: wasUploaded ? false : s.previousProgram.uploaded_to_teambuildr,
            }
          : null,
      }))
    } else {
      set((s) => ({
        savedEdits: [],
        pendingEdits: [],
        program: s.program
          ? {
              ...s.program,
              payload: bakedPayload,
              coach_edited: true,
              uploaded_to_teambuildr: wasUploaded ? false : s.program.uploaded_to_teambuildr,
            }
          : null,
      }))
    }
    set((s) => ({ loading: { ...s.loading, saving: false } }))
    return true
  },

  finalizeProgram: async () => {
    const { program } = get()
    if (!program) return false

    set((s) => ({ loading: { ...s.loading, saving: true } }))

    let nextDueDate: string | null = null
    const { data: mpData } = await supabase
      .from('member_programs')
      .select('due_date')
      .eq('member_id', program.member_id)
      .limit(1)
      .single()

    if (mpData?.due_date) {
      const d = new Date(mpData.due_date)
      d.setDate(d.getDate() + program.duration_weeks * 7)
      const dow = d.getDay()
      if (dow !== 1) {
        d.setDate(d.getDate() + (dow === 0 ? 1 : 8 - dow))
      }
      nextDueDate = d.toISOString().slice(0, 10)
    }

    const { error } = await supabase
      .from('programming_generated')
      .update({
        coach_approved: true,
        next_due_date: nextDueDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', program.id)

    if (!error) {
      set((s) => ({
        program: s.program
          ? { ...s.program, coach_approved: true, next_due_date: nextDueDate }
          : null,
      }))
    }

    set((s) => ({ loading: { ...s.loading, saving: false } }))
    return !error
  },

  markUploaded: async () => {
    const { program } = get()
    if (!program) return false

    const { error } = await supabase
      .from('programming_generated')
      .update({
        uploaded_to_teambuildr: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', program.id)

    if (!error) {
      set((s) => ({
        program: s.program
          ? { ...s.program, uploaded_to_teambuildr: true }
          : null,
      }))
    }

    return !error
  },

  hasPendingChanges: () => {
    const { activeView, pendingEdits, previousPendingEdits } = get()
    return activeView === 'last' ? previousPendingEdits.length > 0 : pendingEdits.length > 0
  },

  allEdits: () => {
    const { activeView, savedEdits, pendingEdits, previousSavedEdits, previousPendingEdits } = get()
    if (activeView === 'last') return [...previousSavedEdits, ...previousPendingEdits]
    return [...savedEdits, ...pendingEdits]
  },

  updateConfigDraft: (patch) => {
    set((s) => {
      if (!s.configDraft) return {}
      return { configDraft: { ...s.configDraft, ...patch } }
    })
  },

  saveDurationWeeks: async (weeks: number) => {
    const { program } = get()
    if (!program) return

    set((s) => ({ loading: { ...s.loading, saving: true } }))
    
    const wasUploaded = program.uploaded_to_teambuildr
    const patch: Record<string, unknown> = {
      duration_weeks: weeks,
      coach_edited: true,
      updated_at: new Date().toISOString()
    }
    
    if (wasUploaded) {
      patch.uploaded_to_teambuildr = false
    }
    
    const { error } = await supabase
      .from('programming_generated')
      .update(patch)
      .eq('id', program.id)

    if (!error) {
      set((s) => ({
        program: s.program ? { 
          ...s.program, 
          duration_weeks: weeks,
          coach_edited: true,
          uploaded_to_teambuildr: wasUploaded ? false : s.program.uploaded_to_teambuildr
        } : null,
      }))
    }
    set((s) => ({ loading: { ...s.loading, saving: false } }))
  },

  requestRegeneration: async () => {
    const { program, configDraft, selectedCoach } = get()
    if (!program || !configDraft) return

    const apiUrl = import.meta.env.VITE_REGEN_API_URL
    const apiSecret = import.meta.env.VITE_REGEN_API_SECRET

    set((s) => ({ loading: { ...s.loading, regenerating: true }, regenError: null }))

    try {
      if (apiUrl && apiSecret) {
        const res = await fetch(`${apiUrl}/regenerate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiSecret}`,
          },
          body: JSON.stringify({
            member_id: program.member_id,
            program_id: program.id,
            requested_by: selectedCoach?.id ?? null,
            scheme_name: configDraft.scheme_name,
            rep_range: configDraft.rep_range,
            sessions_per_week: configDraft.sessions_per_week,
            duration_weeks: configDraft.duration_weeks,
          }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({ detail: res.statusText }))
          const msg = body.detail ?? JSON.stringify(body)
          console.error('Regeneration failed:', msg)
          set((s) => ({ loading: { ...s.loading, regenerating: false }, regenError: `Regeneration failed: ${msg}` }))
          return
        }

        await get().fetchProgram(program.member_id)
      } else {
        // Fallback: insert into regeneration_requests table (no API configured)
        const { data, error } = await supabase
          .from('programming_regeneration_requests')
          .insert({
            member_id: program.member_id,
            program_id: program.id,
            requested_by: selectedCoach?.id ?? null,
            scheme_name: configDraft.scheme_name,
            rep_range: configDraft.rep_range,
            sessions_per_week: configDraft.sessions_per_week,
          })
          .select()
          .single()

        if (!error && data) {
          set({ pendingRegen: data as RegenerationRequest })
        }
      }
    } catch (err) {
      console.error('Regeneration error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      set({ regenError: `Regeneration error: ${msg}` })
    }

    set((s) => ({ loading: { ...s.loading, regenerating: false } }))
  },

  generateFirstProgram: async (config) => {
    const { selectedMember, selectedCoach } = get()
    if (!selectedMember) return

    let exerciseLibrary = get().exerciseLibrary
    if (exerciseLibrary.length === 0) {
      await get().fetchExerciseLibrary()
      exerciseLibrary = get().exerciseLibrary
    }

    if (exerciseLibrary.length === 0) {
      set({ regenError: 'No exercise library found. Please try again.' })
      return
    }

    const apiUrl = import.meta.env.VITE_REGEN_API_URL
    const apiSecret = import.meta.env.VITE_REGEN_API_SECRET

    set((s) => ({ loading: { ...s.loading, regenerating: true }, regenError: null }))

    try {
      const templatePayload = buildTemplateProgram(
        config.sessions_per_week,
        config.rep_range,
        exerciseLibrary,
      )

      if ((templatePayload.sessions ?? []).length === 0) {
        set({
          regenError:
            'Could not build a starter template from the exercise library.',
        })
        return
      }

      const runId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

      const { data: seededRows, error: seedError } = await supabase
        .from('programming_generated')
        .insert({
          run_id: runId,
          member_id: selectedMember.member_id,
          assigned_to: selectedCoach?.id ?? null,
          sessions_per_week: config.sessions_per_week,
          duration_weeks: config.duration_weeks,
          phase_number: null,
          scheme_name: config.scheme_name,
          rep_range: config.rep_range,
          changes_summary: 'Cold-start seed template created in Program Editor',
          rules_applied: [],
          payload: templatePayload,
          coach_edited: false,
          coach_approved: false,
          uploaded_to_teambuildr: false,
        })
        .select('id')
        .single()

      if (seedError || !seededRows) {
        set({
          regenError:
            seedError?.message ?? 'Failed to create starter template program.',
        })
        return
      }

      if (apiUrl && apiSecret) {
        const res = await fetch(`${apiUrl}/regenerate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiSecret}`,
          },
          body: JSON.stringify({
            member_id: selectedMember.member_id,
            program_id: seededRows.id,
            requested_by: selectedCoach?.id ?? null,
            scheme_name: config.scheme_name,
            rep_range: config.rep_range,
            sessions_per_week: config.sessions_per_week,
            duration_weeks: config.duration_weeks,
          }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({ detail: res.statusText }))
          const msg = body.detail ?? JSON.stringify(body)
          set({ regenError: `Regeneration failed after seeding: ${msg}` })
          return
        }
      } else {
        const { data, error } = await supabase
          .from('programming_regeneration_requests')
          .insert({
            member_id: selectedMember.member_id,
            program_id: seededRows.id,
            requested_by: selectedCoach?.id ?? null,
            scheme_name: config.scheme_name,
            rep_range: config.rep_range,
            sessions_per_week: config.sessions_per_week,
          })
          .select()
          .single()

        if (!error && data) {
          set({ pendingRegen: data as RegenerationRequest })
        }
      }

      await get().fetchProgram(selectedMember.member_id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ regenError: `First program generation error: ${msg}` })
    } finally {
      set((s) => ({ loading: { ...s.loading, regenerating: false } }))
    }
  },

  copyPreviousToNext: async () => {
    const { previousProgram, previousSavedEdits, program } = get()
    if (!previousProgram || !program) return false

    set((s) => ({ loading: { ...s.loading, saving: true } }))

    const finalSessions = applyEdits(
      previousProgram.payload.sessions,
      previousSavedEdits as CoachEdit[],
    )
    const newPayload = {
      sessions: finalSessions,
      metadata: previousProgram.payload.metadata,
    }

    const { error } = await supabase
      .from('programming_generated')
      .update({
        payload: newPayload,
        scheme_name: previousProgram.scheme_name,
        rep_range: previousProgram.rep_range,
        sessions_per_week: previousProgram.sessions_per_week,
        coach_edited: true,
        changes_summary: 'Copied from previous program cycle',
        updated_at: new Date().toISOString(),
      })
      .eq('id', program.id)

    if (error) {
      set((s) => ({
        loading: { ...s.loading, saving: false },
        saveError: error.message ?? 'Failed to copy program.',
      }))
      return false
    }

    set((s) => ({ loading: { ...s.loading, saving: false } }))
    await get().fetchProgram(program.member_id)
    return true
  },

  addDay: async (dayType) => {
    const { program, savedEdits, pendingEdits, configDraft } = get()
    if (!program) return false

    const currentSessions = program.payload.sessions
    const newSpw = currentSessions.length + 1
    if (newSpw > 6) return false

    let exerciseLibrary = get().exerciseLibrary
    if (exerciseLibrary.length === 0) {
      await get().fetchExerciseLibrary()
      exerciseLibrary = get().exerciseLibrary
    }
    if (exerciseLibrary.length === 0) {
      set({ saveError: 'No exercise library loaded.' })
      return false
    }

    set((s) => ({ loading: { ...s.loading, saving: true }, saveError: null }))

    const allEdits = [...savedEdits, ...pendingEdits] as CoachEdit[]
    const editedSessions = applyEdits(currentSessions, allEdits)
    const usedIds = new Set<string>()
    for (const sess of editedSessions) {
      for (const ex of sess.exercises) {
        if (ex.exercise_id) usedIds.add(ex.exercise_id)
      }
    }

    const repRange = configDraft?.rep_range ?? program.rep_range ?? '8-10'
    const nextDayNumber = Math.max(0, ...currentSessions.map((s) => s.day)) + 1

    const newSession = buildSingleSession(
      nextDayNumber,
      dayType,
      repRange,
      exerciseLibrary,
      usedIds,
    )

    if (!newSession) {
      set((s) => ({
        loading: { ...s.loading, saving: false },
        saveError: 'Could not build a valid session for this day type.',
      }))
      return false
    }

    const updatedPayload = {
      ...program.payload,
      sessions: [...currentSessions, newSession],
      metadata: {
        ...program.payload.metadata,
        sessions_per_week: newSpw,
      },
    }

    const { error } = await supabase
      .from('programming_generated')
      .update({
        payload: updatedPayload,
        sessions_per_week: newSpw,
        coach_edited: true,
        changes_summary: `Added Day ${nextDayNumber} (${dayType}) via Add Day`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', program.id)

    if (error) {
      set((s) => ({
        loading: { ...s.loading, saving: false },
        saveError: error.message ?? 'Failed to add day.',
      }))
      return false
    }

    set((s) => ({ loading: { ...s.loading, saving: false } }))
    await get().fetchProgram(program.member_id)
    set({ selectedDay: nextDayNumber })
    return true
  },

  deleteDay: async (dayNumber) => {
    const { program, pendingEdits } = get()
    if (!program) return false
    
    if (pendingEdits.length > 0) {
      alert('Please save or discard your pending edits before deleting a day.')
      return false
    }

    if (!window.confirm(`Are you sure you want to delete Day ${dayNumber}? This action cannot be undone.`)) {
      return false
    }

    const currentSessions = program.payload.sessions
    const newSpw = currentSessions.length - 1
    if (newSpw < 1) {
      alert('Cannot delete the last remaining day.')
      return false
    }

    set((s) => ({ loading: { ...s.loading, saving: true }, saveError: null }))

    // Filter out the deleted day and shift higher days down
    const newSessions = currentSessions
      .filter((s) => s.day !== dayNumber)
      .map((s) => ({
        ...s,
        day: s.day > dayNumber ? s.day - 1 : s.day,
      }))

    const updatedPayload = {
      ...program.payload,
      sessions: newSessions,
      metadata: {
        ...program.payload.metadata,
        sessions_per_week: newSpw,
      },
    }

    const { error } = await supabase
      .from('programming_generated')
      .update({
        payload: updatedPayload,
        sessions_per_week: newSpw,
        coach_edited: true,
        changes_summary: `Deleted Day ${dayNumber}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', program.id)

    if (error) {
      set((s) => ({
        loading: { ...s.loading, saving: false },
        saveError: error.message ?? 'Failed to delete day.',
      }))
      return false
    }

    set((s) => ({ loading: { ...s.loading, saving: false } }))
    await get().fetchProgram(program.member_id)
    
    // Reset selected day to 1 or the nearest available
    const { selectedDay } = get()
    if (selectedDay === dayNumber) {
      set({ selectedDay: 1 })
    } else if (selectedDay && selectedDay > dayNumber) {
      set({ selectedDay: selectedDay - 1 })
    }
    
    return true
  },

  swapDays: async (dayA, dayB) => {
    const { program, pendingEdits } = get()
    if (!program) return false
    
    if (pendingEdits.length > 0) {
      alert('Please save or discard your pending edits before swapping days.')
      return false
    }

    const currentSessions = [...program.payload.sessions]
    const idxA = currentSessions.findIndex((s) => s.day === dayA)
    const idxB = currentSessions.findIndex((s) => s.day === dayB)
    
    if (idxA === -1 || idxB === -1) {
      alert('Cannot swap days: one or both days not found.')
      return false
    }

    set((s) => ({ loading: { ...s.loading, saving: true }, saveError: null }))

    // Swap the day numbers
    const tempA = currentSessions[idxA].day
    currentSessions[idxA] = { ...currentSessions[idxA], day: currentSessions[idxB].day }
    currentSessions[idxB] = { ...currentSessions[idxB], day: tempA }
    
    // Sort so array order matches day number
    currentSessions.sort((a, b) => a.day - b.day)

    const updatedPayload = {
      ...program.payload,
      sessions: currentSessions,
    }

    const { error } = await supabase
      .from('programming_generated')
      .update({
        payload: updatedPayload,
        coach_edited: true,
        changes_summary: `Swapped Day ${dayA} and Day ${dayB}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', program.id)

    if (error) {
      set((s) => ({
        loading: { ...s.loading, saving: false },
        saveError: error.message ?? 'Failed to swap days.',
      }))
      return false
    }

    set((s) => ({ loading: { ...s.loading, saving: false } }))
    await get().fetchProgram(program.member_id)
    
    // Swap the selected day so the user stays on the content they were viewing
    const { selectedDay } = get()
    if (selectedDay === dayA) {
      set({ selectedDay: dayB })
    } else if (selectedDay === dayB) {
      set({ selectedDay: dayA })
    }
    
    return true
  },

  hasConfigChanges: () => {
    const { program, configDraft } = get()
    if (!program || !configDraft) return false
    return (
      configDraft.scheme_name !== (program.scheme_name ?? '') ||
      configDraft.rep_range !== (program.rep_range ?? '') ||
      configDraft.sessions_per_week !== program.sessions_per_week
    )
  },

  clearRegenError: () => set({ regenError: null }),
  clearSaveValidationError: () => set({ saveValidationErrors: null, saveError: null }),
  hasRepsError: (sessionDay, seriesLabel) => {
    const errs = get().saveValidationErrors
    return !!errs?.some((e) => e.sessionDay === sessionDay && e.seriesLabel === seriesLabel)
  },

  fetchMemberHolds: async (memberId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('member_holds')
      .select('id, member_id, membership_id, hold_start, hold_end, hold_notes, travel_programming_notes')
      .eq('member_id', memberId)
      .gte('hold_end', today)
      .order('hold_start', { ascending: true })
    set({ memberHolds: (data ?? []) as MemberHold[] })
  },

  fetchHolidayPrograms: async (memberId: string) => {
    // Requires migration 20260408130000 (adds program_type column). Fails silently pre-migration.
    const { data, error } = await supabase
      .from('programming_generated')
      .select('*')
      .eq('member_id', memberId)
      .eq('program_type', 'holiday')
      .order('holiday_start_date', { ascending: true })
    if (!error) {
      set({ holidayPrograms: (data ?? []) as GeneratedProgram[] })
    }
  },

  generateHolidayProgram: async (config) => {
    const { selectedMember, selectedCoach } = get()
    if (!selectedMember) return null

    let exerciseLibrary = get().exerciseLibrary
    if (exerciseLibrary.length === 0) {
      await get().fetchExerciseLibrary()
      exerciseLibrary = get().exerciseLibrary
    }
    if (exerciseLibrary.length === 0) {
      set({ regenError: 'No exercise library found. Please try again.' })
      return null
    }

    set((s) => ({ loading: { ...s.loading, regenerating: true }, regenError: null }))

    try {
      const templatePayload = buildTemplateProgram(
        config.sessions_per_week,
        config.rep_range,
        exerciseLibrary,
      )

      if ((templatePayload.sessions ?? []).length === 0) {
        set({ regenError: 'Could not build a template from the exercise library.' })
        return null
      }

      const runId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

      const { data, error } = await supabase
        .from('programming_generated')
        .insert({
          run_id: runId,
          member_id: selectedMember.member_id,
          assigned_to: selectedCoach?.id ?? null,
          sessions_per_week: config.sessions_per_week,
          duration_weeks: config.duration_weeks,
          scheme_name: config.scheme_name,
          rep_range: config.rep_range,
          program_type: 'holiday',
          holiday_start_date: config.holiday_start_date || null,
          holiday_end_date: config.holiday_end_date || null,
          changes_summary: `Holiday program${config.holiday_start_date ? `: ${config.holiday_start_date} – ${config.holiday_end_date}` : ''}`,
          rules_applied: [],
          payload: templatePayload,
          coach_edited: false,
          coach_approved: false,
          uploaded_to_teambuildr: false,
        })
        .select('*')
        .single()

      if (error || !data) {
        set({ regenError: error?.message ?? 'Failed to create holiday program.' })
        return null
      }

      const newProgram = data as GeneratedProgram
      // Refresh the holiday programs list in state
      await get().fetchHolidayPrograms(selectedMember.member_id)
      return newProgram
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ regenError: `Holiday program creation error: ${msg}` })
      return null
    } finally {
      set((s) => ({ loading: { ...s.loading, regenerating: false } }))
    }
  },

  loadProgramById: async (programId: string) => {
    set((s) => ({ loading: { ...s.loading, program: true } }))
    const { data } = await supabase
      .from('programming_generated')
      .select('*')
      .eq('id', programId)
      .single()
    set((s) => ({ loading: { ...s.loading, program: false } }))
    if (!data) return
    const prog = data as GeneratedProgram
    set({
      program: prog,
      previousProgram: null,
      pastProgramInfo: null,
      savedEdits: [],
      pendingEdits: [],
      activeView: 'next' as ActiveView,
      previousSavedEdits: [],
      previousPendingEdits: [],
      selectedDay: prog.payload?.sessions?.[0]?.day ?? 1,
      lastProgramExpanded: false,
      configDraft: {
        scheme_name: prog.scheme_name ?? 'GPP',
        rep_range: prog.rep_range ?? '8-10',
        sessions_per_week: prog.sessions_per_week,
        duration_weeks: prog.duration_weeks,
      },
    })
    get().fetchEdits(prog.id)
  },
}))
