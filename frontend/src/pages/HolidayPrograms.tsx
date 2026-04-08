import { useEffect, useMemo, useState } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { supabase } from '../lib/supabase'
import { MemberSidebar } from '../components/layout/MemberSidebar'
import { ExerciseCategoryGroup } from '../features/program/ExerciseCategoryGroup'
import { AddExerciseButton } from '../features/program/AddExerciseButton'
import { DayPicker } from '../components/ui/DayPicker'
import { applyEdits } from '../lib/applyEdits'
import { seriesGroup, seriesSortKey } from '../lib/utils'
import type { GeneratedProgram, ProgramExercise, MemberWithCoach, CoachEdit } from '../types'
import { cn } from '../lib/utils'

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupBySeries(exercises: ProgramExercise[]) {
  const groups: Record<string, ProgramExercise[]> = {}
  for (const ex of exercises) {
    const group = seriesGroup(ex.series_label)
    if (!groups[group]) groups[group] = []
    groups[group].push(ex)
  }
  for (const group of Object.keys(groups)) {
    groups[group].sort((a, b) =>
      a.series_label.localeCompare(b.series_label, undefined, { numeric: true })
    )
  }
  return Object.entries(groups).sort(([a], [b]) => seriesSortKey(a) - seriesSortKey(b))
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return 'No dates set'
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  if (start) return `From ${fmt(start)}`
  return `Until ${fmt(end!)}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HolidayProgramCard({
  prog,
  isSelected,
  onClick,
}: {
  prog: GeneratedProgram
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border p-4 transition-all space-y-2',
        isSelected
          ? 'border-[var(--color-gold)] bg-[var(--color-gold-50)]'
          : 'border-[var(--border)] bg-white hover:border-[var(--color-gold-100)]'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--color-gold)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {formatDateRange(prog.holiday_start_date, prog.holiday_end_date)}
          </span>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={
            prog.coach_approved
              ? { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' }
              : { background: 'var(--color-gold-50)', color: 'var(--color-gold)', border: '1px solid var(--color-gold-100)' }
          }
        >
          {prog.coach_approved ? 'Approved' : 'Draft'}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        {prog.sessions_per_week && <span>{prog.sessions_per_week}×/week</span>}
        {prog.scheme_name && <span>{prog.scheme_name}</span>}
        {prog.rep_range && <span>{prog.rep_range}</span>}
        {prog.duration_weeks && <span>{prog.duration_weeks}wk</span>}
      </div>
      {prog.changes_summary && (
        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{prog.changes_summary}</p>
      )}
    </button>
  )
}

// ── Create Form ───────────────────────────────────────────────────────────────

function CreateHolidayForm({
  progressionSchemes,
  onSubmit,
  onCancel,
  loading,
  error,
}: {
  progressionSchemes: { name: string; from_rep_range: string; to_rep_range: string; order: number }[]
  onSubmit: (config: {
    holiday_start_date: string
    holiday_end_date: string
    sessions_per_week: number
    scheme_name: string
    rep_range: string
    duration_weeks: number
  }) => void
  onCancel: () => void
  loading: boolean
  error: string | null
}) {
  const [config, setConfig] = useState({
    holiday_start_date: '',
    holiday_end_date: '',
    sessions_per_week: 3,
    scheme_name: '',
    rep_range: '',
    duration_weeks: 1,
  })

  const schemeNames = useMemo(() => {
    const names = new Set(progressionSchemes.map((s) => s.name))
    return Array.from(names).sort()
  }, [progressionSchemes])

  const repRanges = useMemo(() => {
    if (!config.scheme_name) return []
    return progressionSchemes
      .filter((s) => s.name === config.scheme_name)
      .sort((a, b) => a.order - b.order)
  }, [progressionSchemes, config.scheme_name])

  const canSubmit = config.sessions_per_week && config.scheme_name && config.rep_range && !loading

  return (
    <div className="rounded-xl border p-5 bg-white space-y-4" style={{ borderColor: 'var(--color-gold-100)' }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>New Holiday Program</h3>
        <button onClick={onCancel} className="text-xs" style={{ color: 'var(--text-muted)' }}>Cancel</button>
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Start Date</label>
          <input
            type="date"
            value={config.holiday_start_date}
            onChange={(e) => setConfig((c) => ({ ...c, holiday_start_date: e.target.value }))}
            className="w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-gold)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>End Date</label>
          <input
            type="date"
            value={config.holiday_end_date}
            onChange={(e) => setConfig((c) => ({ ...c, holiday_end_date: e.target.value }))}
            className="w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-gold)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          />
        </div>
      </div>

      {/* Sessions per week */}
      <div className="space-y-1">
        <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Sessions / Week</label>
        <div className="flex gap-1.5 flex-wrap">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              onClick={() => setConfig((c) => ({ ...c, sessions_per_week: n }))}
              className={cn(
                'w-9 h-9 rounded-lg text-sm font-semibold border transition-colors',
                config.sessions_per_week === n
                  ? 'text-white border-[var(--color-gold)] bg-[var(--color-gold)]'
                  : 'bg-white border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--color-gold)]'
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Scheme + Rep Range */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Scheme</label>
          <select
            value={config.scheme_name}
            onChange={(e) => setConfig((c) => ({ ...c, scheme_name: e.target.value, rep_range: '' }))}
            className="w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 bg-white"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            <option value="">Select scheme…</option>
            {schemeNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Rep Range</label>
          <select
            value={config.rep_range}
            onChange={(e) => setConfig((c) => ({ ...c, rep_range: e.target.value }))}
            disabled={!config.scheme_name}
            className="w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 bg-white disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            <option value="">Select range…</option>
            {repRanges.map((s) => (
              <option key={s.from_rep_range} value={s.from_rep_range}>{s.from_rep_range}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-1">
        <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Duration (weeks)</label>
        <div className="flex gap-1.5 flex-wrap">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setConfig((c) => ({ ...c, duration_weeks: n }))}
              className={cn(
                'w-9 h-9 rounded-lg text-sm font-semibold border transition-colors',
                config.duration_weeks === n
                  ? 'text-white border-[var(--color-gold)] bg-[var(--color-gold)]'
                  : 'bg-white border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--color-gold)]'
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-xs rounded-lg px-3 py-2 border" style={{ color: 'var(--red)', background: 'var(--red-bg)', borderColor: 'var(--red-border)' }}>
          {error}
        </p>
      )}

      <button
        onClick={() => onSubmit(config)}
        disabled={!canSubmit}
        className="w-full rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        style={{ background: 'var(--color-gold)' }}
      >
        {loading ? (
          <>
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Building…
          </>
        ) : (
          'Generate Holiday Program'
        )}
      </button>
    </div>
  )
}

// ── Holiday Program Editor (exercise view/edit) ───────────────────────────────

function HolidayProgramEditor({ programId }: { programId: string }) {
  const {
    program,
    savedEdits,
    pendingEdits,
    selectedDay,
    setSelectedDay,
    addDay,
    loading,
    saveProgram,
    finalizeProgram,
    saveValidationErrors,
    saveError,
    clearSaveValidationError,
    selectedCoach,
  } = useEditorStore()

  const nextPending = pendingEdits.length > 0
  const combinedEdits = useMemo(
    () => [...savedEdits, ...pendingEdits] as CoachEdit[],
    [savedEdits, pendingEdits]
  )
  const editedSessions = useMemo(() => {
    if (!program?.payload?.sessions) return []
    return applyEdits(program.payload.sessions, combinedEdits)
  }, [program, combinedEdits])
  const days = useMemo(
    () => [...new Set(editedSessions.map((s) => s.day))].sort((a, b) => a - b),
    [editedSessions]
  )
  const currentSession = useMemo(
    () => editedSessions.find((s) => s.day === selectedDay) ?? null,
    [editedSessions, selectedDay]
  )

  if (!program || program.id !== programId) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--color-gold)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Day picker + workflow */}
      <div className="flex items-center justify-between gap-4">
        <DayPicker days={days} selectedDay={selectedDay} onSelect={setSelectedDay} onAddDay={async () => { await addDay('full') }} />
        <div className="flex items-center gap-2">
          {nextPending && (
            <button
              onClick={saveProgram}
              disabled={loading.saving}
              className="flex-shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-2"
              style={{ background: 'var(--color-gold)' }}
            >
              {loading.saving ? (
                <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />Saving…</>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Save Program
                </>
              )}
            </button>
          )}
          {!program.coach_approved && !nextPending && (
            <button
              onClick={async () => {
                if (window.confirm('Approve this holiday program?')) await finalizeProgram()
              }}
              disabled={loading.saving}
              className="flex-shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--green)' }}
            >
              Approve
            </button>
          )}
        </div>
      </div>

      {/* Errors */}
      {saveError && (
        <div className="rounded-lg border px-3 py-2 text-sm flex items-center justify-between gap-2" style={{ borderColor: 'var(--red-border)', background: 'var(--red-bg)', color: 'var(--red)' }}>
          <span>{saveError}</span>
          <button onClick={clearSaveValidationError} className="opacity-70 hover:opacity-100">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
      {saveValidationErrors && saveValidationErrors.length > 0 && (
        <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--red-border)', background: 'var(--red-bg)', color: 'var(--red)' }}>
          {saveValidationErrors.map((e) => (
            <div key={`${e.sessionDay}-${e.seriesLabel}`}><strong>{e.seriesLabel}</strong> (Day {e.sessionDay}): {e.message}</div>
          ))}
        </div>
      )}
      {nextPending && (
        <div className="rounded-lg border px-3 py-2 text-xs flex items-center gap-2" style={{ borderColor: 'var(--orange-border)', background: 'var(--orange-bg)', color: 'var(--orange)' }}>
          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
          {pendingEdits.length} unsaved change{pendingEdits.length !== 1 ? 's' : ''} — click Save Program to persist
        </div>
      )}

      {/* Exercises */}
      {currentSession ? (
        <div className="space-y-6">
          {groupBySeries(currentSession.exercises).map(([seriesLetter, exercises]) => (
            <ExerciseCategoryGroup
              key={seriesLetter}
              seriesLetter={seriesLetter}
              exercises={exercises}
              sessionDay={currentSession.day}
              edits={combinedEdits}
              programId={program.id}
              memberId={program.member_id}
              coachId={selectedCoach?.id ?? null}
              readOnly={false}
            />
          ))}
          <AddExerciseButton
            sessionDay={currentSession.day}
            programId={program.id}
            memberId={program.member_id}
            coachId={selectedCoach?.id ?? null}
            existingExercises={currentSession.exercises}
          />
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Select a day to view exercises</p>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function HolidayPrograms() {
  const {
    selectedMember,
    selectMember,
    holidayPrograms,
    fetchHolidayPrograms,
    generateHolidayProgram,
    loadProgramById,
    progressionSchemes,
    fetchProgressionSchemes,
    exerciseLibrary,
    fetchExerciseLibrary,
    program,
    loading,
    regenError,
    clearRegenError,
  } = useEditorStore()

  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (progressionSchemes.length === 0) void fetchProgressionSchemes()
    if (exerciseLibrary.length === 0) void fetchExerciseLibrary()
  }, [exerciseLibrary.length, fetchExerciseLibrary, fetchProgressionSchemes, progressionSchemes.length])

  useEffect(() => {
    if (selectedMember) {
      void fetchHolidayPrograms(selectedMember.member_id)
    }
  }, [selectedMember?.member_id, fetchHolidayPrograms])

  // When program is loaded into store, mark it selected
  useEffect(() => {
    if (program && program.program_type === 'holiday') {
      setSelectedProgramId(program.id)
    }
  }, [program?.id, program?.program_type])

  function handleSelectMember(member: MemberWithCoach | null) {
    selectMember(member)
    setSelectedProgramId(null)
    setShowCreate(false)
  }

  async function handleSelectProgram(prog: GeneratedProgram) {
    setShowCreate(false)
    setSelectedProgramId(prog.id)
    await loadProgramById(prog.id)
  }

  async function handleCreate(config: Parameters<typeof generateHolidayProgram>[0]) {
    setCreateError(null)
    const newProg = await generateHolidayProgram(config)
    if (newProg) {
      setShowCreate(false)
      await handleSelectProgram(newProg)
    } else {
      setCreateError(useEditorStore.getState().regenError ?? 'Failed to create program.')
    }
  }

  async function handleDeleteProgram(prog: GeneratedProgram) {
    if (!window.confirm(`Delete this holiday program (${formatDateRange(prog.holiday_start_date, prog.holiday_end_date)})?`)) return
    await supabase.from('programming_generated').delete().eq('id', prog.id)
    if (selectedProgramId === prog.id) setSelectedProgramId(null)
    if (selectedMember) void fetchHolidayPrograms(selectedMember.member_id)
  }

  const memberName = selectedMember
    ? `${selectedMember.first_name} ${selectedMember.last_name}`
    : null

  return (
    <div className="flex h-full">
      <MemberSidebar onSelectMember={handleSelectMember} />

      <main className="flex-1 overflow-y-auto p-6 space-y-6" style={{ background: 'var(--bg)' }}>

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Holiday Programs</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Travel-friendly programs for members on holiday. These sit off the regular training timeline.
            </p>
          </div>
          {selectedMember && (
            <button
              onClick={() => { setShowCreate(true); setSelectedProgramId(null) }}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
              style={{ background: 'var(--color-gold)' }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Holiday Program
            </button>
          )}
        </div>

        {/* No member selected */}
        {!selectedMember && (
          <div className="rounded-xl border bg-white p-12 text-center" style={{ borderColor: 'var(--border)' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--bg3)' }}>
              <svg className="h-5 w-5" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Select a member</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Choose a member from the sidebar to view or create holiday programs</p>
          </div>
        )}

        {/* Member selected — content area */}
        {selectedMember && (
          <div className="grid grid-cols-[280px_1fr] gap-5 items-start">

            {/* Left: holiday program list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {memberName}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {holidayPrograms.length} program{holidayPrograms.length !== 1 ? 's' : ''}
                </span>
              </div>

              {loading.program && holidayPrograms.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--color-gold)' }} />
                </div>
              ) : holidayPrograms.length === 0 && !showCreate ? (
                <div className="rounded-xl border bg-white px-4 py-8 text-center space-y-2" style={{ borderColor: 'var(--border)' }}>
                  <svg className="h-8 w-8 mx-auto" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No holiday programs yet</p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="text-xs font-semibold underline underline-offset-2 hover:opacity-70"
                    style={{ color: 'var(--color-gold)' }}
                  >
                    Create one
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {holidayPrograms.map((prog) => (
                    <div key={prog.id} className="relative group">
                      <HolidayProgramCard
                        prog={prog}
                        isSelected={selectedProgramId === prog.id}
                        onClick={() => void handleSelectProgram(prog)}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleDeleteProgram(prog) }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded p-1"
                        title="Delete program"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseOver={(e) => e.currentTarget.style.color = 'var(--red)'}
                        onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: create form or program editor */}
            <div>
              {showCreate && (
                <CreateHolidayForm
                  progressionSchemes={progressionSchemes}
                  onSubmit={handleCreate}
                  onCancel={() => setShowCreate(false)}
                  loading={loading.regenerating}
                  error={createError ?? regenError}
                />
              )}

              {!showCreate && selectedProgramId && (
                <div className="rounded-xl border p-5 bg-white space-y-4" style={{ borderColor: 'var(--border)' }}>
                  {/* Editor header */}
                  {(() => {
                    const prog = holidayPrograms.find((p) => p.id === selectedProgramId)
                    return prog ? (
                      <div className="flex items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <div className="flex items-center gap-2">
                            <svg className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--color-gold)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                            </svg>
                            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                              {formatDateRange(prog.holiday_start_date, prog.holiday_end_date)}
                            </span>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={
                                prog.coach_approved
                                  ? { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' }
                                  : { background: 'var(--color-gold-50)', color: 'var(--color-gold)', border: '1px solid var(--color-gold-100)' }
                              }
                            >
                              {prog.coach_approved ? 'Approved' : 'Draft'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {prog.sessions_per_week && <span>{prog.sessions_per_week}×/week</span>}
                            {prog.scheme_name && <span>{prog.scheme_name}</span>}
                            {prog.rep_range && <span>{prog.rep_range}</span>}
                            {prog.duration_weeks && <span>{prog.duration_weeks} wk</span>}
                          </div>
                        </div>
                      </div>
                    ) : null
                  })()}

                  <HolidayProgramEditor programId={selectedProgramId} />
                </div>
              )}

              {!showCreate && !selectedProgramId && holidayPrograms.length > 0 && (
                <div className="rounded-xl border bg-white px-4 py-12 text-center" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Select a program to view and edit exercises</p>
                </div>
              )}

              {regenError && (
                <div className="mt-3 rounded-lg border px-3 py-2 text-sm flex items-center justify-between gap-2" style={{ borderColor: 'var(--red-border)', background: 'var(--red-bg)', color: 'var(--red)' }}>
                  <span>{regenError}</span>
                  <button onClick={clearRegenError} className="opacity-70 hover:opacity-100">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
