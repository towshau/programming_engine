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
} from '../types'
import { supabase } from '../lib/supabase'

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
  exerciseLibrary: ExerciseLibraryItem[]
  progressionSchemes: ProgressionScheme[]
  pendingRegen: RegenerationRequest | null
  regenError: string | null
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
  fetchMembers: (coachId: string) => Promise<void>
  selectMember: (member: MemberWithCoach | null) => void
  fetchProgram: (memberId: string) => Promise<void>
  fetchEdits: (programId: string) => Promise<void>
  fetchExerciseLibrary: () => Promise<void>
  fetchProgressionSchemes: () => Promise<void>
  setSelectedDay: (day: number | null) => void
  addPendingEdit: (edit: PendingEdit) => void
  saveProgram: () => Promise<boolean>
  finalizeProgram: () => Promise<boolean>
  markUploaded: () => Promise<boolean>
  hasPendingChanges: () => boolean
  allEdits: () => (CoachEdit | PendingEdit)[]
  updateConfigDraft: (patch: Partial<NonNullable<EditorState['configDraft']>>) => void
  saveDurationWeeks: (weeks: number) => Promise<void>
  requestRegeneration: () => Promise<void>
  hasConfigChanges: () => boolean
  clearRegenError: () => void
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
  exerciseLibrary: [],
  progressionSchemes: [],
  pendingRegen: null,
  regenError: null,
  selectedDay: null,
  configDraft: null,
  loading: { coaches: false, members: false, program: false, saving: false, regenerating: false },

  fetchCoaches: async () => {
    set((s) => ({ loading: { ...s.loading, coaches: true } }))
    const { data } = await supabase.rpc('get_programming_coaches')
    if (data) {
      set({ coaches: data })
    } else {
      const { data: fallback } = await supabase
        .from('staff_database')
        .select('id, first_name, last_name')
        .order('first_name')
      if (fallback) set({ coaches: fallback })
    }
    set((s) => ({ loading: { ...s.loading, coaches: false } }))
  },

  selectCoach: (coach) => {
    set({
      selectedCoach: coach,
      selectedMember: null,
      program: null,
      previousProgram: null,
      pastProgramInfo: null,
      savedEdits: [],
      pendingEdits: [],
      selectedDay: null,
      members: [],
      configDraft: null,
      pendingRegen: null,
    })
    if (coach) get().fetchMembers(coach.id)
  },

  fetchMembers: async (coachId: string) => {
    set((s) => ({ loading: { ...s.loading, members: true } }))
    const { data } = await supabase
      .from('member_memberships')
      .select('member_id, member_name, gym, programming_coach_id')
      .eq('programming_coach_id', coachId)
      .eq('status', 'active')
      .order('member_name')

    if (data) {
      const unique = new Map<string, MemberWithCoach>()
      for (const row of data as Record<string, unknown>[]) {
        const mid = row.member_id as string
        if (!unique.has(mid)) {
          const fullName = (row.member_name as string) || ''
          const parts = fullName.split(' ')
          const firstName = parts[0] || ''
          const lastName = parts.slice(1).join(' ') || ''
          unique.set(mid, {
            member_id: mid,
            member_name: fullName,
            first_name: firstName,
            last_name: lastName,
            gym: (row.gym as string) || '',
            programming_coach_id: row.programming_coach_id as string,
          })
        }
      }
      set({ members: Array.from(unique.values()) })
    }
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
      selectedDay: null,
      configDraft: null,
      pendingRegen: null,
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
        configDraft: {
          scheme_name: current.scheme_name ?? 'GPP',
          rep_range: current.rep_range ?? '8-10',
          sessions_per_week: current.sessions_per_week,
          duration_weeks: current.duration_weeks,
        },
      })
      get().fetchEdits(current.id)

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
      set({ program: null, previousProgram: null, pastProgramInfo: null, configDraft: null })
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

  addPendingEdit: (edit: PendingEdit) => {
    set((s) => ({ pendingEdits: [...s.pendingEdits, edit] }))
  },

  saveProgram: async () => {
    const { program, pendingEdits, selectedCoach } = get()
    if (!program || pendingEdits.length === 0) return false

    set((s) => ({ loading: { ...s.loading, saving: true } }))

    const rows = pendingEdits.map((edit) => ({
      program_id: program.id,
      member_id: program.member_id,
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
      const wasUploaded = program.uploaded_to_teambuildr
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
        .eq('id', program.id)

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
      set((s) => ({ loading: { ...s.loading, saving: false } }))
      return true
    }

    set((s) => ({ loading: { ...s.loading, saving: false } }))
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
    return get().pendingEdits.length > 0
  },

  allEdits: () => {
    const { savedEdits, pendingEdits } = get()
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
}))
