import React, { useMemo, useCallback } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { Badge } from '../../components/ui/Badge'

const SESSION_OPTIONS = [1, 2, 3, 4, 5, 6]
const DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8]

function derivePhase(
  schemes: { name: string; from_rep_range: string; order: number }[],
  schemeName: string,
  repRange: string
): number | null {
  const match = schemes.find(
    (s) => s.name === schemeName && s.from_rep_range === repRange
  )
  return match?.order ?? null
}

export function ProgramConfigEditor() {
  const {
    program,
    configDraft,
    progressionSchemes,
    pendingRegen,
    regenError,
    loading,
    updateConfigDraft,
    saveDurationWeeks,
    requestRegeneration,
    hasConfigChanges,
    clearRegenError,
    editingFutureProgram,
  } = useEditorStore()

  const schemeNames = useMemo(() => {
    const names = new Set(progressionSchemes.map((s) => s.name))
    return Array.from(names).sort()
  }, [progressionSchemes])

  const repRangesForScheme = useMemo(() => {
    if (!configDraft) return []
    return progressionSchemes
      .filter((s) => s.name === configDraft.scheme_name)
      .sort((a, b) => a.order - b.order)
      .map((s) => s.from_rep_range)
  }, [progressionSchemes, configDraft?.scheme_name])

  const derivedPhase = useMemo(() => {
    if (!configDraft) return null
    return derivePhase(progressionSchemes, configDraft.scheme_name, configDraft.rep_range)
  }, [progressionSchemes, configDraft?.scheme_name, configDraft?.rep_range])

  const confidence = program?.payload?.metadata?.confidence

  const configChanged = hasConfigChanges()

  const handleSchemeChange = useCallback(
    (name: string) => {
      const firstRange = progressionSchemes
        .filter((s) => s.name === name)
        .sort((a, b) => a.order - b.order)[0]?.from_rep_range
      updateConfigDraft({ scheme_name: name, rep_range: firstRange ?? '' })
    },
    [progressionSchemes, updateConfigDraft]
  )

  const handleRepRangeChange = useCallback(
    (range: string) => updateConfigDraft({ rep_range: range }),
    [updateConfigDraft]
  )

  const handleSessionsChange = useCallback(
    (sessions: number) => updateConfigDraft({ sessions_per_week: sessions }),
    [updateConfigDraft]
  )

  const handleDurationChange = useCallback(
    (weeks: number) => {
      updateConfigDraft({ duration_weeks: weeks })
      saveDurationWeeks(weeks)
    },
    [updateConfigDraft, saveDurationWeeks]
  )

  if (!configDraft) return null

  const selectCls = "rounded-md border px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 bg-white"
  const selectStyle: React.CSSProperties = { borderColor: 'var(--border)', color: 'var(--text)' }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Scheme */}
        <select
          value={configDraft.scheme_name}
          onChange={(e) => handleSchemeChange(e.target.value)}
          disabled={!!editingFutureProgram}
          className={selectCls}
          style={{ ...selectStyle, color: 'var(--blue)' }}
        >
          {schemeNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        {/* Rep range */}
        <select
          value={configDraft.rep_range}
          onChange={(e) => handleRepRangeChange(e.target.value)}
          disabled={!!editingFutureProgram}
          className={selectCls}
          style={{ ...selectStyle, color: '#0d9488' }}
        >
          {repRangesForScheme.map((range) => (
            <option key={range} value={range}>
              {range} reps
            </option>
          ))}
        </select>

        {/* Phase (read-only) */}
        {derivedPhase != null && (
          <Badge variant="default">Phase {derivedPhase}</Badge>
        )}

        {/* Sessions per week */}
        <select
          value={configDraft.sessions_per_week}
          onChange={(e) => handleSessionsChange(Number(e.target.value))}
          className={selectCls}
          style={selectStyle}
        >
          {SESSION_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}x / week
            </option>
          ))}
        </select>

        {/* Duration */}
        <select
          value={configDraft.duration_weeks}
          onChange={(e) => handleDurationChange(Number(e.target.value))}
          className={selectCls}
          style={selectStyle}
        >
          {DURATION_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} weeks
            </option>
          ))}
        </select>

        {/* Confidence (read-only) */}
        {confidence && (
          <Badge
            variant={
              confidence === 'high'
                ? 'emerald'
                : confidence === 'medium'
                  ? 'amber'
                  : confidence === 'low'
                    ? 'red'
                    : 'default'
            }
          >
            {confidence} confidence
          </Badge>
        )}

        {/* Regenerate button */}
        {!editingFutureProgram && configChanged && !pendingRegen && (
          <button
            onClick={requestRegeneration}
            disabled={loading.regenerating}
            className="ml-auto rounded-md px-3 py-1 text-xs font-semibold text-white disabled:opacity-50 transition-colors"
            style={{ background: 'var(--color-gold)' }}
          >
            {loading.regenerating ? 'Requesting…' : 'Regenerate Workout'}
          </button>
        )}
      </div>

      {/* Regeneration error banner */}
      {regenError && (
        <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--red-border)', background: 'var(--red-bg)', color: 'var(--red)' }}>
          <span>{regenError}</span>
          <button
            onClick={clearRegenError}
            className="ml-2 opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Pending regeneration banner */}
      {pendingRegen && (
        <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--orange-border)', background: 'var(--orange-bg)', color: 'var(--orange)' }}>
          Regeneration requested — the pipeline will pick this up and generate a
          new program with the updated settings.
        </div>
      )}
    </div>
  )
}
