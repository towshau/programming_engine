import { create } from 'zustand'
import type {
  Coach,
  MemberWithCoach,
  GeneratedProgram,
  CoachEdit,
  ExerciseLibraryItem,
  ProgressionScheme,
  RegenerationRequest,
  PastProgramInfo,
  PendingEdit,
  EditType,
} from '../types'
import { supabase } from '../lib/supabase'
import { applyEdits } from '../lib/applyEdits'
import { validateSessionsReps, type RepsValidationError } from '../lib/reps'
import { buildTemplateProgram } from '../lib/templateBuilder'

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
function findCancellableChain(
  pending: PendingEdit[],
  incoming: PendingEdit,
): number[] | null {
  const { edit_type, session_day, series_label } = incoming

  if (edit_type === 'exercise_delete') {
    const idx = pending.findIndex(
      (e) =>
        e.edit_type === 'exercise_add' &&
        e.session_day === session_day &&
        e.series_label === series_label,
    )
    return idx !== -1 ? [idx] : null
  }

  if (edit_type === 'exercise_add') return null

  if (edit_type === 'series_change') {
    const chainIndices: number[] = []
    let traceLabel = series_label
    for (let i = pending.length - 1; i >= 0; i--) {
      const e = pending[i]
      if (
        e.edit_type === 'series_change' &&
        e.session_day === session_day &&
        String(e.new_value.series_label) === traceLabel
      ) {
        chainIndices.unshift(i)
        traceLabel = e.series_label
      }
    }
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
    const chainIndices = collectChain(pending, edit_type, session_day, series_label)
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

  const chainIndices = collectChain(pending, edit_type, session_day, series_label)
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
  seriesLabel: string,
): number[] {
  const indices: number[] = []
  for (let i = 0; i < pending.length; i++) {
    const e = pending[i]
    if (
      e.edit_type === editType &&
      e.session_day === sessionDay &&
      e.series_label === seriesLabel
    ) {
      indices.push(i)
    }
  }
  return indices
}

type ActiveView = 'next' | 'last'

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
  saveValidationErrors: RepsValidationError[] | null
  saveError: string | null
  selectedDay: number | null
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
  toggleLastProgram: () => void
  fetchComplianceDates: (memberId: string, startDate: string, endDate: string) => Promise<void>
  hasConfigChanges: () => boolean
  clearRegenError: () => void
  clearSaveValidationError: () => void
  hasRepsError: (sessionDay: number, seriesLabel: string) => boolean
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
  regenError: null,
  saveValidationErrors: null,
  saveError: null,
  selectedDay: null,
  configDraft: null,
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

    const [allMembersRes, activeMembershipRes, pgRes] = await Promise.all([
      supabase
        .from('member_database')
        .select('id, first_name, last_name, member_name')
        .order('member_name')
        .limit(2000),
      supabase
        .from('member_memberships')
        .select('member_id, gym, programming_coach_id, start_date, end_date, journey_stage, status, membership_stage, pipeline_lost')
        .gt('end_date', today)
        .not('journey_stage', 'eq', 'no_sale')
        .not('status', 'eq', 'f&f')
        .limit(2000),
      supabase
        .from('programming_generated')
        .select('member_id')
        .limit(5000),
    ])

    const pgSet = new Set((pgRes.data ?? []).map((r: { member_id: string }) => r.member_id))

    interface ActiveInfo {
      gym: string
      programming_coach_id: string
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
          programming_coach_id: (row.programming_coach_id as string) || '',
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

      if (coachId && active?.programming_coach_id !== coachId) continue

      const fullName = (row.member_name as string) || ''
      const firstName = (row.first_name as string) || fullName.split(' ')[0] || ''
      const lastName = (row.last_name as string) || fullName.split(' ').slice(1).join(' ') || ''
      const startDate = active?.start_date || ''
      const hasProgram = pgSet.has(mid)
      const withinNewWindow = (startDate > today) || (!!startDate && startDate >= cutoffStr)
      const isNew = withinNewWindow && active?.membership_stage === 'newsale'

      members.push({
        member_id: mid,
        member_name: fullName,
        first_name: firstName,
        last_name: lastName,
        gym: active?.gym || '',
        programming_coach_id: active?.programming_coach_id || '',
        membership_status: isActive ? 'active' : 'inactive',
        program_status: hasProgram ? 'has_program' : isNew ? 'new_member' : 'needs_program',
        is_new: isNew,
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
    })
    if (member) get().fetchProgram(member.member_id)
  },

  fetchProgram: async (memberId: string) => {
    set((s) => ({ loading: { ...s.loading, program: true } }))

    const { data } = await supabase
      .from('programming_generated')
      .select('*')
      .eq('member_id', memberId)
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
    } else {
      set({ program: null, previousProgram: null, pastProgramInfo: null, configDraft: null, previousSavedEdits: [], previousPendingEdits: [], previousSelectedDay: null, lastProgramExpanded: false, complianceDates: [] })
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
        ...new Set(data.map((r: { completed_date: string }) => r.completed_date)),
      ].sort()
      set({ complianceDates: dates })
    }
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
    const { activeView, program, previousProgram, selectedCoach } = get()
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

    const rows = currentPending.map((edit) => ({
      program_id: targetProgram.id,
      member_id: targetProgram.member_id,
      coach_id: selectedCoach?.id ?? null,
      session_day: edit.session_day,
      series_label: edit.series_label,
      exercise_id: edit.exercise_id,
      edit_type: edit.edit_type,
      old_value: edit.old_value,
      new_value: edit.new_value,
    }))

    const { data, error } = await supabase
      .from('programming_coach_edits')
      .insert(rows)
      .select()

    if (!error && data) {
      const wasUploaded = targetProgram.uploaded_to_teambuildr
      const patch: Record<string, unknown> = {
        coach_edited: true,
        updated_at: new Date().toISOString(),
      }
      if (wasUploaded) {
        patch.uploaded_to_teambuildr = false
      }

      await supabase
        .from('programming_generated')
        .update(patch)
        .eq('id', targetProgram.id)

      if (isLast) {
        set((s) => ({
          previousSavedEdits: [...s.previousSavedEdits, ...(data as CoachEdit[])],
          previousPendingEdits: [],
          previousProgram: s.previousProgram
            ? {
                ...s.previousProgram,
                coach_edited: true,
                uploaded_to_teambuildr: wasUploaded ? false : s.previousProgram.uploaded_to_teambuildr,
              }
            : null,
        }))
      } else {
        set((s) => ({
          savedEdits: [...s.savedEdits, ...(data as CoachEdit[])],
          pendingEdits: [],
          program: s.program
            ? {
                ...s.program,
                coach_edited: true,
                uploaded_to_teambuildr: wasUploaded ? false : s.program.uploaded_to_teambuildr,
              }
            : null,
        }))
      }
      set((s) => ({ loading: { ...s.loading, saving: false } }))
      return true
    }

    set((s) => ({
      loading: { ...s.loading, saving: false },
      saveError: error?.message ?? 'Save failed. Please try again.',
    }))
    return false
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
    const { error } = await supabase
      .from('programming_generated')
      .update({ duration_weeks: weeks })
      .eq('id', program.id)

    if (!error) {
      set((s) => ({
        program: s.program ? { ...s.program, duration_weeks: weeks } : null,
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
}))
