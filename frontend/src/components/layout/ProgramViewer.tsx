import { useEffect, useMemo } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { applyEdits } from '../../lib/applyEdits'
import { DayPicker } from '../ui/DayPicker'
import { ProgramHeader } from '../../features/program/ProgramHeader'
import { ExerciseCategoryGroup } from '../../features/program/ExerciseCategoryGroup'
import { AddExerciseButton } from '../../features/program/AddExerciseButton'
import type { ProgramExercise, CoachEdit } from '../../types'
import { seriesGroup, seriesSortKey } from '../../lib/utils'

function groupBySeries(exercises: ProgramExercise[]) {
  const groups: Record<string, ProgramExercise[]> = {}
  for (const ex of exercises) {
    const group = seriesGroup(ex.series_label)
    if (!groups[group]) groups[group] = []
    groups[group].push(ex)
  }
  return Object.entries(groups).sort(
    ([a], [b]) => seriesSortKey(a) - seriesSortKey(b)
  )
}

function computeExpiresDate(
  previousNextDueDate: string | null | undefined,
  currentCreatedAt: string,
): Date | null {
  const ref = previousNextDueDate ?? currentCreatedAt
  if (!ref) return null
  const d = new Date(ref)
  d.setDate(d.getDate() - 1)
  return d
}

export function ProgramViewer() {
  const {
    selectedCoach,
    selectedMember,
    program,
    previousProgram,
    pastProgramInfo,
    savedEdits,
    pendingEdits,
    activeView,
    previousSavedEdits,
    previousPendingEdits,
    previousSelectedDay,
    setPreviousSelectedDay,
    selectedDay,
    setSelectedDay,
    loading,
    fetchProgressionSchemes,
    progressionSchemes,
    saveProgram,
    finalizeProgram,
    markUploaded,
    hasPendingChanges,
    saveValidationErrors,
    saveError,
    clearSaveValidationError,
  } = useEditorStore()

  useEffect(() => {
    if (progressionSchemes.length === 0) {
      fetchProgressionSchemes()
    }
  }, [fetchProgressionSchemes, progressionSchemes.length])

  const isLastView = activeView === 'last'

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

  // --- Last program data ---
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

  // Active view derived values
  const combinedEdits = isLastView ? lastCombinedEdits : nextCombinedEdits
  const days = isLastView ? lastDays : nextDays
  const currentDaySelection = isLastView ? previousSelectedDay : selectedDay
  const setDaySelection = isLastView ? setPreviousSelectedDay : setSelectedDay
  const currentSession = isLastView ? lastCurrentSession : nextCurrentSession
  const activeProgram = isLastView ? previousProgram : program

  const pending = hasPendingChanges()
  const activePendingEdits = isLastView ? previousPendingEdits : pendingEdits
  const totalEditCount = combinedEdits.length

  // Expiry check for last program
  const expiresDate = useMemo(() => {
    if (!previousProgram || !program) return null
    return computeExpiresDate(previousProgram.next_due_date, program.created_at)
  }, [previousProgram, program])

  const isLastExpired = expiresDate ? new Date() > expiresDate : false
  const readOnly = isLastView && isLastExpired

  if (!selectedCoach) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <p className="text-zinc-500 text-sm">Select a coach to get started</p>
        </div>
      </main>
    )
  }

  if (!selectedMember) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="text-zinc-500 text-sm">Select a member to view their program</p>
        </div>
      </main>
    )
  }

  if (loading.program) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-500" />
      </main>
    )
  }

  if (!program) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 text-sm">No program generated yet</p>
          <p className="text-zinc-600 text-xs mt-1">
            Run the pipeline for {selectedMember.first_name} to generate a program
          </p>
        </div>
      </main>
    )
  }

  const memberName = `${selectedMember.first_name} ${selectedMember.last_name}`

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-6">
      <ProgramHeader
        program={program}
        previousProgram={previousProgram}
        pastProgramInfo={pastProgramInfo}
        memberName={memberName}
        editCount={totalEditCount}
      />

      {/* Read-only banner for expired last program */}
      {readOnly && (
        <div className="rounded-lg border border-zinc-600/40 bg-zinc-800/40 px-3 py-2 text-xs text-zinc-400 flex items-center gap-2">
          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          This program has expired — view only
        </div>
      )}

      {/* Day picker + workflow buttons row */}
      <div className="flex items-center justify-between gap-4">
        <DayPicker days={days} selectedDay={currentDaySelection} onSelect={setDaySelection} />

        <div className="flex items-center gap-2">
          {pending && !readOnly && (
            <button
              onClick={saveProgram}
              disabled={loading.saving}
              className="flex-shrink-0 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors flex items-center gap-2"
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

          {!isLastView && !program.coach_approved && !pending && (
            <button
              onClick={async () => {
                if (window.confirm('Finalize this program? This marks it as coach-approved and calculates the next due date.')) {
                  await finalizeProgram()
                }
              }}
              disabled={loading.saving}
              className="flex-shrink-0 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              Finalize
            </button>
          )}

          {!isLastView && program.coach_approved && !program.uploaded_to_teambuildr && (
            <button
              onClick={async () => {
                if (window.confirm('This is an admin-only action.\n\nConfirm you are admin and this program has been uploaded to TeamBuildr.')) {
                  await markUploaded()
                }
              }}
              disabled={loading.saving}
              className="flex-shrink-0 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Mark Uploaded
            </button>
          )}
        </div>
      </div>

      {/* Re-upload required banner (next program only) */}
      {!isLastView && program.coach_approved && program.coach_edited && !program.uploaded_to_teambuildr && totalEditCount > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400 flex items-center gap-2">
          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <div>
            <span>Program edited after upload — re-upload to TeamBuildr required</span>
            <p className="text-[10px] text-amber-500/70 italic mt-0.5">No coach action required (admin to adjust member-facing program)</p>
          </div>
        </div>
      )}

      {/* Save validation errors — block save until fixed */}
      {saveValidationErrors && saveValidationErrors.length > 0 && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-3 text-sm text-red-200 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 font-medium">
              <svg className="h-5 w-5 flex-shrink-0 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Fix the following before saving:
            </div>
            <button
              onClick={clearSaveValidationError}
              className="flex-shrink-0 rounded p-0.5 text-red-400 hover:bg-red-500/20 hover:text-red-200"
              title="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-xs text-red-300/90">
            {saveValidationErrors.map((e) => (
              <li key={`${e.sessionDay}-${e.seriesLabel}`}>
                <strong>{e.seriesLabel}</strong> (Day {e.sessionDay}): {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Save error (Supabase / server) */}
      {saveError && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 flex-shrink-0 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {saveError}
          </div>
          <button
            onClick={clearSaveValidationError}
            className="flex-shrink-0 rounded p-0.5 text-red-400 hover:bg-red-500/20 hover:text-red-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Unsaved changes indicator */}
      {pending && !readOnly && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400 flex items-center gap-2">
          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {activePendingEdits.length} unsaved change{activePendingEdits.length !== 1 ? 's' : ''} — click Save Program to persist
        </div>
      )}

      {currentSession && activeProgram ? (
        <div className="space-y-6">
          {groupBySeries(currentSession.exercises).map(
            ([seriesLetter, exercises]) => (
              <ExerciseCategoryGroup
                key={seriesLetter}
                seriesLetter={seriesLetter}
                exercises={exercises}
                sessionDay={currentSession.day}
                edits={combinedEdits}
                programId={activeProgram.id}
                memberId={activeProgram.member_id}
                coachId={selectedCoach?.id ?? null}
                readOnly={readOnly}
              />
            )
          )}

          {!readOnly && (
            <AddExerciseButton
              sessionDay={currentSession.day}
              programId={activeProgram.id}
              memberId={activeProgram.member_id}
              coachId={selectedCoach?.id ?? null}
              existingExercises={currentSession.exercises}
            />
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Select a day to view exercises</p>
      )}
    </main>
  )
}
