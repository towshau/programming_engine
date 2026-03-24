import { useEffect, useMemo, useState } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { applyEdits } from '../../lib/applyEdits'
import { DayPicker } from '../ui/DayPicker'
import { ProgramHeader } from '../../features/program/ProgramHeader'
import { ComplianceHeatmap } from '../../features/program/ComplianceHeatmap'
import { ExerciseCategoryGroup } from '../../features/program/ExerciseCategoryGroup'
import { AddExerciseButton } from '../../features/program/AddExerciseButton'
import { ProgramConfigEditor } from '../../features/program/ProgramConfigEditor'
import type { ProgramExercise, CoachEdit } from '../../types'
import { cn, seriesGroup, seriesSortKey } from '../../lib/utils'

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
  return Object.entries(groups).sort(
    ([a], [b]) => seriesSortKey(a) - seriesSortKey(b)
  )
}

const SESSION_OPTIONS = [1, 2, 3, 4, 5, 6]
const DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8]

export function ProgramViewer() {
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
    lastProgramExpanded,
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
  } = useEditorStore()
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
        <div className="w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <div>
            <p className="text-zinc-200 text-sm font-semibold">No program generated yet</p>
            <p className="text-zinc-500 text-xs mt-1">
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
              className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500/60"
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
              className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs font-medium text-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500/60"
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
              className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs font-medium text-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-500/60"
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
              className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500/60"
            >
              {DURATION_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} weeks
                </option>
              ))}
            </select>
          </div>

          {regenError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
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
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors flex items-center gap-2"
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
    <main className="flex-1 overflow-y-auto p-6 space-y-6">
      <ProgramHeader
        program={program}
        previousProgram={previousProgram}
        pastProgramInfo={pastProgramInfo}
        memberName={memberName}
        editCount={nextEditCount}
      />

      {/* ── Last Program expanded section ── */}
      {lastProgramExpanded && previousProgram && (
        <section className="space-y-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.02] p-4">
          <button
            onClick={async () => {
              if (window.confirm('Copy the last program into the next cycle?\n\nThis will overwrite the current next program with the same exercises, scheme, and rep range.')) {
                await copyPreviousToNext()
              }
            }}
            disabled={loading.saving}
            className="rounded-lg border border-amber-500/60 bg-amber-500/5 px-4 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading.saving ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
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

          {/* Compliance heatmap */}
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
            <p className="text-sm text-zinc-500">Select a day to view last program exercises</p>
          )}
        </section>
      )}

      {/* ── Next / Current Program card ── */}
      {(() => {
        const durationWeeks = configDraft?.duration_weeks ?? program.duration_weeks
        const nextExpiresDate = (() => {
          if (program.created_at && durationWeeks) {
            const d = new Date(program.created_at)
            d.setDate(d.getDate() + durationWeeks * 7)
            return d
          }
          if (program.next_due_date) {
            const d = new Date(program.next_due_date)
            d.setDate(d.getDate() - 1)
            return d
          }
          return null
        })()
        return (
          <div className="space-y-4">
            <div className="w-full text-left rounded-lg p-3 space-y-2 border border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                  {pastProgramInfo ? 'Next Program' : 'Current Program'}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-zinc-500">
                    Generated {formatDateAU(program.created_at)}
                  </span>
                  {nextExpiresDate && (
                    <span className={cn(
                      'text-[10px]',
                      nextExpiresDate < new Date() ? 'text-red-400/70' : 'text-blue-400/70',
                    )}>
                      Expires {nextExpiresDate.toLocaleDateString('en-AU')}
                    </span>
                  )}
                </div>
              </div>
              <ProgramConfigEditor />
            </div>
            {program.changes_summary && (
              <div className="rounded-lg bg-zinc-800/50 border border-zinc-700 px-3 py-2 text-sm text-zinc-300">
                {program.changes_summary}
              </div>
            )}
          </div>
        )
      })()}

      {/* Day picker + workflow buttons row */}
      <div className="flex items-center justify-between gap-4">
        <DayPicker days={nextDays} selectedDay={selectedDay} onSelect={setSelectedDay} />

        <div className="flex items-center gap-2">
          {nextPending && (
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

          {!program.coach_approved && !nextPending && (
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

          {program.coach_approved && !program.uploaded_to_teambuildr && (
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

      {/* Re-upload required banner */}
      {program.coach_approved && program.coach_edited && !program.uploaded_to_teambuildr && nextEditCount > 0 && (
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

      {/* Save validation errors */}
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
      {nextPending && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400 flex items-center gap-2">
          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {pendingEdits.length} unsaved change{pendingEdits.length !== 1 ? 's' : ''} — click Save Program to persist
        </div>
      )}

      {/* Next program exercises */}
      {nextCurrentSession && program ? (
        <div className="space-y-6">
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
        <p className="text-sm text-zinc-500">Select a day to view exercises</p>
      )}
    </main>
  )
}
