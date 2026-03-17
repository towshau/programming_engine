import { useMemo, useCallback } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { Badge } from '../../components/ui/Badge'

const SESSION_OPTIONS = [2, 3, 4, 5, 6]
const DURATION_OPTIONS = [4, 5, 6, 7, 8]

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
    loading,
    updateConfigDraft,
    saveDurationWeeks,
    requestRegeneration,
    hasConfigChanges,
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Scheme */}
        <select
          value={configDraft.scheme_name}
          onChange={(e) => handleSchemeChange(e.target.value)}
          className="rounded-md border border-zinc-600/50 bg-zinc-800 px-2 py-1 text-xs font-medium text-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
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
          className="rounded-md border border-zinc-600/50 bg-zinc-800 px-2 py-1 text-xs font-medium text-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-500/50"
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
          className="rounded-md border border-zinc-600/50 bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
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
          className="rounded-md border border-zinc-600/50 bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
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
        {configChanged && !pendingRegen && (
          <button
            onClick={requestRegeneration}
            disabled={loading.regenerating}
            className="ml-auto rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {loading.regenerating ? 'Requesting…' : 'Regenerate Workout'}
          </button>
        )}
      </div>

      {/* Pending regeneration banner */}
      {pendingRegen && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
          Regeneration requested — the pipeline will pick this up and generate a
          new program with the updated settings.
        </div>
      )}
    </div>
  )
}
