import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEditorStore } from '../../stores/editorStore'
import type { ProgramViewMode } from '../../stores/editorStore'
import { applyEdits } from '../../lib/applyEdits'
import { DayPicker } from '../ui/DayPicker'
import { Badge } from '../ui/Badge'
import { ProgramHeader } from '../../features/program/ProgramHeader'
import { ComplianceHeatmap } from '../../features/program/ComplianceHeatmap'
import { ExerciseCategoryGroup } from '../../features/program/ExerciseCategoryGroup'
import { AddExerciseButton } from '../../features/program/AddExerciseButton'
import { AddDayModal } from '../../features/program/AddDayModal'
import { ProgramConfigEditor } from '../../features/program/ProgramConfigEditor'
import { WeeklyView } from '../../features/program/WeeklyView'
import { TimelineView } from '../../features/program/TimelineView'
import type { ProgramExercise, CoachEdit } from '../../types'
import { seriesGroup, seriesSortKey } from '../../lib/utils'

function formatDateAU(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU')
}

function groupBySeries(exercises: ProgramExercise[]) {
  const groups: Record<string, ProgramExercise[]> = {}
  for (const ex of exercises) {
    const group = seriesGroup(ex.series_label)
    if (!groups[group]) groups[group] = []
    groups[group].push(ex)
  }
  
  // Sort exercises chronologically within each group (e.g. A1, A2, A3)
  for (const group of Object.keys(groups)) {
    groups[group].sort((a, b) => 
      a.series_label.localeCompare(b.series_label, undefined, { numeric: true })
    )
  }
  
  return Object.entries(groups).sort(
    ([a], [b]) => seriesSortKey(a) - seriesSortKey(b)
  )
}

const SESSION_OPTIONS = [1, 2, 3, 4, 5, 6]
const DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8]

export function ProgramViewer() {
  const navigate = useNavigate()
  const {
    selectedCoach,
    selectedMember,
    program,
    previousProgram,
    pastProgramInfo,
    savedEdits,
    pendingEdits,
    previousSavedEdits,
    previousPendingEdits,
    previousSelectedDay,
    setPreviousSelectedDay,
    selectedDay,
    setSelectedDay,
    complianceDates,
    configDraft,
    loading,
    fetchProgressionSchemes,
    fetchExerciseLibrary,
    progressionSchemes,
    exerciseLibrary,
    regenError,
    clearRegenError,
    generateFirstProgram,
    saveProgram,
    finalizeProgram,
    markUploaded,
    saveValidationErrors,
    saveError,
    clearSaveValidationError,
    copyPreviousToNext,
    addDay,
    deleteDay,
    swapDays,
    memberHolds,
    holidayPrograms,
    lastProgramExpanded,
    toggleLastProgram,
    subsequentPrograms,
    showSubsequent,
    toggleShowSubsequent,
    addSubsequentProgram,
    deleteSubsequentProgram,
    editFutureProgram,
    returnToCurrentProgram,
    editingFutureProgram,
    stashedCurrentProgram,
    pastPrograms,
  } = useEditorStore()

  const [programViewMode, setProgramViewMode] = useState<ProgramViewMode>('day')

  const handleViewModeChange = (mode: ProgramViewMode) => {
    setProgramViewMode(mode)
    if (mode === 'weekly' && lastProgramExpanded) {
      toggleLastProgram()
    }
  }
  const [showAddDayModal, setShowAddDayModal] = useState(false)
  const [firstProgramConfig, setFirstProgramConfig] = useState({
    sessions_per_week: 3,
    scheme_name: '',
    rep_range: '',
    duration_weeks: 6,
  })

  useEffect(() => {
    if (progressionSchemes.length === 0) {
      void fetchProgressionSchemes()
    }
    if (exerciseLibrary.length === 0) {
      void fetchExerciseLibrary()
    }
  }, [
    exerciseLibrary.length,
    fetchExerciseLibrary,
    fetchProgressionSchemes,
    progressionSchemes.length,
  ])

  const schemeNames = useMemo(() => {
    const names = new Set(progressionSchemes.map((s) => s.name))
    return Array.from(names).sort()
  }, [progressionSchemes])

  const availableRepRanges = useMemo(() => {
    if (!firstProgramConfig.scheme_name) return []
    return progressionSchemes
      .filter((s) => s.name === firstProgramConfig.scheme_name)
      .sort((a, b) => a.order - b.order)
      .map((s) => s.from_rep_range)
  }, [firstProgramConfig.scheme_name, progressionSchemes])

  useEffect(() => {
    if (schemeNames.length === 0) return
    setFirstProgramConfig((prev) => {
      const schemeName = prev.scheme_name && schemeNames.includes(prev.scheme_name)
        ? prev.scheme_name
        : schemeNames.includes('GPP')
          ? 'GPP'
          : schemeNames[0]

      const repRanges = progressionSchemes
        .filter((s) => s.name === schemeName)
        .sort((a, b) => a.order - b.order)
        .map((s) => s.from_rep_range)
      const repRange =
        prev.rep_range && repRanges.includes(prev.rep_range)
          ? prev.rep_range
          : (repRanges[0] ?? '8-10')

      if (schemeName === prev.scheme_name && repRange === prev.rep_range) {
        return prev
      }

      return {
        ...prev,
        scheme_name: schemeName,
        rep_range: repRange,
      }
    })
  }, [progressionSchemes, schemeNames])

  // --- Next program data ---
  const nextCombinedEdits = useMemo(
    () => [...savedEdits, ...pendingEdits] as CoachEdit[],
    [savedEdits, pendingEdits]
  )

  const nextEditedSessions = useMemo(() => {
    if (!program) return []
    return applyEdits(program.payload.sessions, nextCombinedEdits)
  }, [program, nextCombinedEdits])

  const nextDays = useMemo(
    () => nextEditedSessions.map((s) => s.day),
    [nextEditedSessions]
  )

  const nextCurrentSession = useMemo(
    () => nextEditedSessions.find((s) => s.day === selectedDay) ?? null,
    [nextEditedSessions, selectedDay]
  )

  // --- Last program data (for expanded section) ---
  const lastCombinedEdits = useMemo(
    () => [...previousSavedEdits, ...previousPendingEdits] as CoachEdit[],
    [previousSavedEdits, previousPendingEdits]
  )

  const lastEditedSessions = useMemo(() => {
    if (!previousProgram) return []
    return applyEdits(previousProgram.payload.sessions, lastCombinedEdits)
  }, [previousProgram, lastCombinedEdits])

  const lastDays = useMemo(
    () => lastEditedSessions.map((s) => s.day),
    [lastEditedSessions]
  )

  const lastCurrentSession = useMemo(
    () => lastEditedSessions.find((s) => s.day === previousSelectedDay) ?? null,
    [lastEditedSessions, previousSelectedDay]
  )

  const nextPending = pendingEdits.length > 0
  const nextEditCount = nextCombinedEdits.length

  // Compliance heatmap date range (last program period)
  const lastProgramStart = previousProgram?.created_at?.slice(0, 10) ?? null
  const lastProgramEnd = program?.created_at?.slice(0, 10) ?? null

  const selectClass = "rounded-md border px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 bg-white"
  const selectStyle: React.CSSProperties = { borderColor: 'var(--border)', color: 'var(--text)' }

  if (!selectedMember) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--bg3)' }}
          >
            <svg className="h-8 w-8" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Select a member to view their program</p>
        </div>
      </main>
    )
  }

  if (loading.program) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--color-gold)' }}
        />
      </main>
    )
  }

  if (!program) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <div
          className="w-full max-w-xl rounded-xl border p-5 space-y-4 bg-white"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>No program generated yet</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Set the starter config for {selectedMember.first_name}, then generate their first program.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={firstProgramConfig.sessions_per_week}
              onChange={(e) => {
                clearRegenError()
                setFirstProgramConfig((prev) => ({
                  ...prev,
                  sessions_per_week: Number(e.target.value),
                }))
              }}
              className={selectClass}
              style={selectStyle}
            >
              {SESSION_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}x / week
                </option>
              ))}
            </select>

            <select
              value={firstProgramConfig.scheme_name}
              onChange={(e) => {
                clearRegenError()
                const scheme = e.target.value
                const repRanges = progressionSchemes
                  .filter((s) => s.name === scheme)
                  .sort((a, b) => a.order - b.order)
                  .map((s) => s.from_rep_range)
                setFirstProgramConfig((prev) => ({
                  ...prev,
                  scheme_name: scheme,
                  rep_range: repRanges[0] ?? prev.rep_range,
                }))
              }}
              className={selectClass}
              style={{ ...selectStyle, color: 'var(--blue)' }}
            >
              {schemeNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={firstProgramConfig.rep_range}
              onChange={(e) => {
                clearRegenError()
                setFirstProgramConfig((prev) => ({
                  ...prev,
                  rep_range: e.target.value,
                }))
              }}
              className={selectClass}
              style={{ ...selectStyle, color: '#0d9488' }}
            >
              {availableRepRanges.map((range) => (
                <option key={range} value={range}>
                  {range} reps
                </option>
              ))}
            </select>

            <select
              value={firstProgramConfig.duration_weeks}
              onChange={(e) => {
                clearRegenError()
                setFirstProgramConfig((prev) => ({
                  ...prev,
                  duration_weeks: Number(e.target.value),
                }))
              }}
              className={selectClass}
              style={selectStyle}
            >
              {DURATION_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} weeks
                </option>
              ))}
            </select>
          </div>

          {regenError && (
            <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--red-border)', background: 'var(--red-bg)', color: 'var(--red)' }}>
              {regenError}
            </div>
          )}

          <div className="flex items-center justify-end">
            <button
              onClick={() => void generateFirstProgram(firstProgramConfig)}
              disabled={
                loading.regenerating ||
                !firstProgramConfig.scheme_name ||
                !firstProgramConfig.rep_range
              }
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition-colors flex items-center gap-2"
              style={{ background: 'var(--color-gold)' }}
            >
              {loading.regenerating ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Generating...
                </>
              ) : (
                'Generate First Program'
              )}
            </button>
          </div>
        </div>
      </main>
    )
  }

  const memberName = `${selectedMember.first_name} ${selectedMember.last_name}`

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5" style={{ background: 'var(--bg)' }}>
      <ProgramHeader
        program={program}
        previousProgram={previousProgram}
        pastProgramInfo={pastProgramInfo}
        memberName={memberName}
        editCount={nextEditCount}
        programViewMode={programViewMode}
        onViewModeChange={handleViewModeChange}
      />

      {/* When editing a future program, show the real current program as a collapsed read-only summary above */}
      {editingFutureProgram && stashedCurrentProgram && (
        <div
          className="rounded-xl border p-4 space-y-3"
          style={{ borderColor: 'var(--border)', background: 'var(--bg3)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Current Program
              </span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {stashedCurrentProgram.start_date
                  ? `${new Date(stashedCurrentProgram.start_date).toLocaleDateString('en-AU')} – `
                  : ''}
                {stashedCurrentProgram.end_date
                  ? new Date(stashedCurrentProgram.end_date).toLocaleDateString('en-AU')
                  : ''}
              </span>
            </div>
            <button
              onClick={returnToCurrentProgram}
              className="flex-shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-colors"
              style={{ background: 'var(--color-gold)' }}
            >
              ← Back to Current Program
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {stashedCurrentProgram.scheme_name && <Badge variant="blue">{stashedCurrentProgram.scheme_name}</Badge>}
            {stashedCurrentProgram.rep_range && <Badge variant="teal">{stashedCurrentProgram.rep_range} reps</Badge>}
            {stashedCurrentProgram.phase_number != null && <Badge variant="default">Phase {stashedCurrentProgram.phase_number}</Badge>}
            <Badge variant="default">{stashedCurrentProgram.sessions_per_week}x / week</Badge>
            <Badge variant="default">{stashedCurrentProgram.duration_weeks} weeks</Badge>
          </div>
        </div>
      )}

      {/* ── Holds & Holiday banner ── */}
      {(memberHolds.length > 0 || holidayPrograms.length > 0) && (
        <div
          className="rounded-lg border px-3 py-2.5 flex flex-col gap-1.5"
          style={{ borderColor: 'var(--blue-border)', background: 'var(--blue-bg)' }}
        >
          {memberHolds.map((hold) => (
            <div key={hold.id} className="flex items-start gap-2 text-xs" style={{ color: 'var(--blue)' }}>
              <svg className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
              </svg>
              <span>
                <span className="font-semibold">On Hold: </span>
                {new Date(hold.hold_start).toLocaleDateString('en-AU')}
                {' '}–{' '}
                {new Date(hold.hold_end).toLocaleDateString('en-AU')}
                {hold.travel_programming_notes && (
                  <span style={{ color: 'var(--text-muted)' }}> · {hold.travel_programming_notes}</span>
                )}
              </span>
            </div>
          ))}
          {holidayPrograms.length > 0 && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--blue)' }}>
              <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
              <button
                onClick={() => navigate('/holiday')}
                className="font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity"
                style={{ color: 'var(--blue)' }}
              >
                {holidayPrograms.length} Holiday Program{holidayPrograms.length !== 1 ? 's' : ''}
              </button>
              <span style={{ color: 'var(--text-muted)' }}>active for this member</span>
            </div>
          )}
        </div>
      )}

      {/* ── Weekly View ── */}
      {programViewMode === 'weekly' && (
        <WeeklyView
          program={program}
          previousProgram={previousProgram ?? null}
          nextEditedSessions={nextEditedSessions}
          lastEditedSessions={lastEditedSessions}
          nextEdits={nextCombinedEdits}
          lastEdits={lastCombinedEdits}
          coachId={selectedCoach?.id ?? null}
          onDayClick={(day) => {
            setProgramViewMode('day')
            setSelectedDay(day)
          }}
        />
      )}

      {/* ── Timeline View ── */}
      {programViewMode === 'timeline' && (
        <TimelineView
          pastPrograms={pastPrograms}
          currentProgram={program}
          subsequentPrograms={subsequentPrograms}
          holidayPrograms={holidayPrograms}
          memberHolds={memberHolds}
        />
      )}

      {/* ── Workflow buttons (visible in both Day and Weekly views) ── */}
      <div className="flex items-center justify-end gap-2">
        {nextPending && (
          <button
            onClick={saveProgram}
            disabled={loading.saving}
            className="flex-shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 transition-colors flex items-center gap-2"
            style={{ background: 'var(--color-gold)' }}
          >
            {loading.saving ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving…
              </>
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
              if (window.confirm('Finalize this program? This marks it as coach-approved and calculates the next due date.')) {
                await finalizeProgram()
              }
            }}
            disabled={loading.saving}
            className="flex-shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 transition-colors"
            style={{ background: 'var(--blue)' }}
          >
            Finalize
          </button>
        )}

        {program.coach_approved && !program.uploaded_to_teambuildr && (
          <button
            onClick={async () => {
              if (window.confirm('This is an admin-only action.\n\nConfirm you are admin and this program has been uploaded to TeamBuildr.')) {
                await markUploaded()
              }
            }}
            disabled={loading.saving}
            className="flex-shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
            style={{ border: '1px solid var(--border)', background: 'white', color: 'var(--text)' }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Mark Uploaded
          </button>
        )}
      </div>

      {/* ── Status banners (visible in both Day and Weekly views) ── */}
      {program.coach_approved && program.coach_edited && !program.uploaded_to_teambuildr && nextEditCount > 0 && (
        <div className="rounded-lg border px-3 py-2 text-xs flex items-center gap-2" style={{ borderColor: 'var(--orange-border)', background: 'var(--orange-bg)', color: 'var(--orange)' }}>
          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <div>
            <span>Program edited after upload — re-upload to TeamBuildr required</span>
            <p className="text-[10px] text-amber-500/70 italic mt-0.5">No coach action required (admin to adjust member-facing program)</p>
          </div>
        </div>
      )}

      {saveValidationErrors && saveValidationErrors.length > 0 && (
        <div className="rounded-lg border px-3 py-3 text-sm flex flex-col gap-2" style={{ borderColor: 'var(--red-border)', background: 'var(--red-bg)', color: 'var(--red)' }}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 font-medium">
              <svg className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--red)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Fix the following before saving:
            </div>
            <button
              onClick={clearSaveValidationError}
              className="flex-shrink-0 rounded p-0.5 transition-opacity opacity-70 hover:opacity-100"
              style={{ color: 'var(--red)' }}
              title="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-xs opacity-90">
            {saveValidationErrors.map((e) => (
              <li key={`${e.sessionDay}-${e.seriesLabel}`}>
                <strong>{e.seriesLabel}</strong> (Day {e.sessionDay}): {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {saveError && (
        <div className="rounded-lg border px-3 py-2 text-sm flex items-center justify-between gap-2" style={{ borderColor: 'var(--red-border)', background: 'var(--red-bg)', color: 'var(--red)' }}>
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--red)' }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {saveError}
          </div>
          <button
            onClick={clearSaveValidationError}
            className="flex-shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
            style={{ color: 'var(--red)' }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {nextPending && (
        <div className="rounded-lg border px-3 py-2 text-xs flex items-center gap-2" style={{ borderColor: 'var(--orange-border)', background: 'var(--orange-bg)', color: 'var(--orange)' }}>
          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {pendingEdits.length} unsaved change{pendingEdits.length !== 1 ? 's' : ''} — click Save Program to persist
        </div>
      )}

      {/* ── Day View: Last Program + Config + Exercises ── */}
      {programViewMode === 'day' && (
      <>
      {lastProgramExpanded && previousProgram && (
        <section className="space-y-4 rounded-xl border p-4" style={{ borderColor: 'var(--blue-border)', background: 'rgba(219,234,254,0.3)' }}>
          <button
            onClick={async () => {
              if (window.confirm('Copy the last program into the next cycle?\n\nThis will overwrite the current next program with the same exercises, scheme, and rep range.')) {
                await copyPreviousToNext()
              }
            }}
            disabled={loading.saving}
            className="rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
            style={{ border: '1px solid var(--orange-border)', background: 'var(--orange-bg)', color: 'var(--orange)' }}
          >
            {loading.saving ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-300 border-t-amber-600" />
                Copying…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                </svg>
                Copy to Next Cycle
              </>
            )}
          </button>

          {pastProgramInfo?.source === 'generated' && lastProgramStart && lastProgramEnd && (
            <ComplianceHeatmap
              startDate={lastProgramStart}
              endDate={lastProgramEnd}
              complianceDates={complianceDates}
              sessionsPerWeek={pastProgramInfo.sessions_per_week ?? null}
              durationWeeks={pastProgramInfo.duration_weeks ?? null}
            />
          )}

          <DayPicker
            days={lastDays}
            selectedDay={previousSelectedDay}
            onSelect={setPreviousSelectedDay}
          />

          {lastCurrentSession ? (
            <div className="space-y-6">
              {groupBySeries(lastCurrentSession.exercises).map(
                ([seriesLetter, exercises]) => (
                  <ExerciseCategoryGroup
                    key={seriesLetter}
                    seriesLetter={seriesLetter}
                    exercises={exercises}
                    sessionDay={lastCurrentSession.day}
                    edits={lastCombinedEdits}
                    programId={previousProgram.id}
                    memberId={previousProgram.member_id}
                    coachId={selectedCoach?.id ?? null}
                    readOnly
                  />
                )
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Select a day to view last program exercises</p>
          )}
        </section>
      )}

      {/* ── Next / Current / Future Program section ── */}
      <section
        className="rounded-xl border p-4 space-y-4"
        style={editingFutureProgram
          ? { borderColor: '#c4b5fd', background: 'rgba(139,92,246,0.05)' }
          : { borderColor: 'var(--color-gold-100)', background: 'rgba(184,134,11,0.06)' }
        }
      >

      {(() => {
        const nextExpiresDate = program.end_date ? new Date(program.end_date) : null
        const nextStartDate = program.start_date ? new Date(program.start_date) : null
        return (
          <div className="space-y-4">
            <div className="w-full text-left rounded-lg p-3 space-y-2 border bg-white" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: editingFutureProgram ? '#7c3aed' : 'var(--color-gold)' }}
                >
                  {editingFutureProgram ? 'Future Program' : pastProgramInfo ? 'Next Program' : 'Current Program'}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-zinc-500">
                    Generated {formatDateAU(program.created_at)}
                  </span>
                  {nextStartDate && (
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      Starts {nextStartDate.toLocaleDateString('en-AU')}
                    </span>
                  )}
                  {nextExpiresDate && (
                    <span
                      className="text-[10px]"
                      style={{ color: nextExpiresDate < new Date() ? 'var(--red)' : 'var(--blue)' }}
                    >
                      Expires {nextExpiresDate.toLocaleDateString('en-AU')}
                    </span>
                  )}
                </div>
              </div>
              <ProgramConfigEditor />
            </div>
            {program.changes_summary && (
              <div className="rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--bg3)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                {program.changes_summary}
              </div>
            )}
          </div>
        )
      })()}

      <DayPicker days={nextDays} selectedDay={selectedDay} onSelect={setSelectedDay} onAddDay={() => setShowAddDayModal(true)} />

      {nextCurrentSession && program ? (
        <div className="space-y-6">
          <div className="flex items-center justify-end gap-2 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Swap with:</span>
              <select
                className="rounded-md border px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 bg-white"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                value=""
                onChange={async (e) => {
                  const targetDay = Number(e.target.value)
                  if (!targetDay) return
                  await swapDays(nextCurrentSession.day, targetDay)
                }}
              >
                <option value="" disabled>Select day...</option>
                {nextDays.filter(d => d !== nextCurrentSession.day).map(d => (
                  <option key={d} value={d}>Day {d}</option>
                ))}
              </select>
            </div>
            <div className="h-4 w-px" style={{ background: 'var(--border)' }}></div>
            <button
              onClick={async () => {
                await deleteDay(nextCurrentSession.day)
              }}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors"
              style={{ border: '1px solid var(--red-border)', background: 'var(--red-bg)', color: 'var(--red)' }}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Day {nextCurrentSession.day}
            </button>
          </div>

          {groupBySeries(nextCurrentSession.exercises).map(
            ([seriesLetter, exercises]) => (
              <ExerciseCategoryGroup
                key={seriesLetter}
                seriesLetter={seriesLetter}
                exercises={exercises}
                sessionDay={nextCurrentSession.day}
                edits={nextCombinedEdits}
                programId={program.id}
                memberId={program.member_id}
                coachId={selectedCoach?.id ?? null}
                readOnly={false}
              />
            )
          )}

          <AddExerciseButton
            sessionDay={nextCurrentSession.day}
            programId={program.id}
            memberId={program.member_id}
            coachId={selectedCoach?.id ?? null}
            existingExercises={nextCurrentSession.exercises}
          />
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Select a day to view exercises</p>
      )}

      </section>

      {!editingFutureProgram && showSubsequent && subsequentPrograms.map((subProg, idx) => (
        <section
          key={subProg.id}
          className="rounded-xl border p-4 space-y-4"
          style={{ borderColor: '#c4b5fd', background: 'rgba(139,92,246,0.05)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#7c3aed' }}>
              Future Program {idx + 1}
            </span>
            <span className="text-[10px] font-medium" style={{ color: '#7c3aed' }}>
              {subProg.start_date
                ? new Date(subProg.start_date).toLocaleDateString('en-AU')
                : new Date(subProg.created_at).toLocaleDateString('en-AU')}
              {subProg.end_date && ` – ${new Date(subProg.end_date).toLocaleDateString('en-AU')}`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {subProg.scheme_name && <Badge variant="blue">{subProg.scheme_name}</Badge>}
            {subProg.rep_range && <Badge variant="teal">{subProg.rep_range} reps</Badge>}
            {subProg.phase_number != null && <Badge variant="default">Phase {subProg.phase_number}</Badge>}
            <Badge variant="default">{subProg.sessions_per_week}x / week</Badge>
            <Badge variant="default">{subProg.duration_weeks} weeks</Badge>
            {subProg.payload?.sessions && (
              <Badge variant="default">{subProg.payload.sessions.length} day{subProg.payload.sessions.length !== 1 ? 's' : ''}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => editFutureProgram(idx)}
              className="rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{ borderColor: '#7c3aed', color: '#7c3aed', background: 'rgba(139,92,246,0.08)' }}
            >
              Edit Program
            </button>
            <button
              onClick={async () => {
                if (window.confirm(`Delete future program ${idx + 1}? This cannot be undone.`)) {
                  await deleteSubsequentProgram(subProg.id)
                }
              }}
              disabled={loading.saving}
              className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-red-50 disabled:opacity-50"
              style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
            >
              Delete
            </button>
          </div>
        </section>
      ))}

      {/* Next Phase Footer — always visible at the bottom of the day view (hidden when editing a future program) */}
      {!editingFutureProgram && (
        <>
          {subsequentPrograms && subsequentPrograms.length > 0 && !showSubsequent && (
            /* Future programs already planned — show a compact info strip */
            <section
              className="rounded-xl border p-4 flex items-center justify-between gap-4"
              style={{ borderColor: 'var(--border)', background: 'var(--bg3)' }}
            >
              <div className="flex items-center gap-2.5">
                <svg className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--color-gold)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {subsequentPrograms.length} future program{subsequentPrograms.length !== 1 ? 's' : ''} planned
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Next starts {subsequentPrograms[0].start_date
                      ? new Date(subsequentPrograms[0].start_date).toLocaleDateString('en-AU')
                      : '—'}
                    {subsequentPrograms[0].end_date
                      ? ` – Expires ${new Date(subsequentPrograms[0].end_date).toLocaleDateString('en-AU')}`
                      : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={toggleShowSubsequent}
                className="flex-shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
                style={{ borderColor: 'var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}
              >
                Show Future Programs
              </button>
            </section>
          )}

          {(!subsequentPrograms || subsequentPrograms.length === 0 || showSubsequent) && (
            /* No future programs, OR future programs expanded — show the add buttons */
            <section className="rounded-xl border border-dashed p-6 text-center space-y-4" style={{ borderColor: 'var(--border)', background: 'var(--bg3)' }}>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Plan Next Phase</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Create the next program block to continue the timeline.</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={async () => await addSubsequentProgram('generate_next', configDraft)}
                  disabled={loading.saving || loading.regenerating}
                  className="rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50"
                  style={{ background: 'var(--color-gold)' }}
                >
                  {loading.regenerating ? 'Generating…' : 'Generate Next Phase'}
                </button>
                <button
                  onClick={async () => await addSubsequentProgram('clone')}
                  disabled={loading.saving || loading.regenerating}
                  className="rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}
                >
                  Clone Current Program
                </button>
                <button
                  onClick={async () => await addSubsequentProgram('randomise', configDraft)}
                  disabled={loading.saving || loading.regenerating}
                  className="rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}
                >
                  Randomise New Workout
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {showAddDayModal && (
        <AddDayModal
          onSelect={async (dayType) => {
            setShowAddDayModal(false)
            await addDay(dayType)
          }}
          onClose={() => setShowAddDayModal(false)}
        />
      )}
      </>
      )}
    </main>
  )
}
