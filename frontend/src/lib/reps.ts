import type { SetPrescription, RepUnit } from '../types'

/**
 * Parse a reps string into numeric min/max and unit.
 * Handles: "8-10", "10", "30s", "10, 8, 6" (returns first value for single-set context).
 */
export function parseReps(raw: string): { min: number | null; max: number | null; unit: RepUnit } {
  const trimmed = raw.trim()
  if (!trimmed) return { min: null, max: null, unit: 'reps' }

  if (/s$/i.test(trimmed)) {
    const n = parseInt(trimmed, 10)
    return { min: isNaN(n) ? null : n, max: isNaN(n) ? null : n, unit: 'seconds' }
  }

  if (trimmed.includes('-')) {
    const [lo, hi] = trimmed.split('-').map((s) => parseInt(s.trim(), 10))
    return { min: isNaN(lo) ? null : lo, max: isNaN(hi) ? null : hi, unit: 'reps' }
  }

  const n = parseInt(trimmed, 10)
  return { min: isNaN(n) ? null : n, max: isNaN(n) ? null : n, unit: 'reps' }
}

/**
 * Enrich a SetPrescription with reps_min, reps_max, reps_display, unit.
 * Works with both old format (just `reps` string) and new format (already enriched).
 */
export function enrichSet(set: SetPrescription): SetPrescription {
  if (set.reps_min != null && set.unit) return set
  const parsed = parseReps(set.reps)
  return {
    ...set,
    reps_display: set.reps,
    reps_min: parsed.min,
    reps_max: parsed.max,
    unit: parsed.unit,
  }
}

/**
 * Build a display string from sets. If all sets have the same reps, return one value.
 * If they differ, return comma-separated.
 */
export function buildRepsDisplay(sets: SetPrescription[]): string {
  if (sets.length === 0) return ''
  const values = sets.map((s) => s.reps_display ?? s.reps)
  const allSame = values.every((v) => v === values[0])
  return allSame ? values[0] : values.join(', ')
}

/**
 * Get the unit from a set array (uses first set, falls back to 'reps').
 */
export function getUnit(sets: SetPrescription[]): RepUnit {
  if (sets.length === 0) return 'reps'
  return sets[0].unit ?? (parseReps(sets[0].reps).unit)
}

/**
 * Build enriched sets from a reps input string, a unit, and a set count.
 */
export function buildSetsFromInput(input: string, unit: RepUnit, setCount: number): SetPrescription[] {
  const parts = input.split(',').map((p) => p.trim()).filter(Boolean)

  return Array.from({ length: setCount }, (_, i) => {
    const raw = parts.length > 1 ? (parts[i] ?? parts[parts.length - 1]) : (parts[0] ?? '')
    const display = unit === 'seconds' ? raw : raw
    const repsString = unit === 'seconds' ? `${raw}s` : raw
    const parsed = parseReps(repsString)
    return {
      set_number: i + 1,
      reps: repsString,
      reps_display: display,
      reps_min: parsed.min,
      reps_max: parsed.max,
      unit,
    }
  })
}

/**
 * Validate reps input. Returns true if valid.
 * Reps mode: digits, hyphens, commas, spaces only.
 * Seconds mode: digits only (single number).
 */
export function validateRepsInput(value: string, unit: RepUnit): boolean {
  if (unit === 'seconds') {
    return /^\d+$/.test(value.trim())
  }
  return /^[\d\s,\-]+$/.test(value.trim()) && value.trim().length > 0
}

/**
 * Check if a display value is invalid for the given unit.
 * Used to show red highlight and block save.
 */
export function isRepsInvalidForUnit(display: string, unit: RepUnit): boolean {
  if (!display.trim()) return true
  return !validateRepsInput(display, unit)
}

export interface RepsValidationError {
  sessionDay: number
  seriesLabel: string
  message: string
}

/**
 * Validate all exercises in edited sessions. Returns list of errors for save blocking.
 */
export function validateSessionsReps(
  sessions: { day: number; exercises: { series_label: string; sets: SetPrescription[] }[] }[]
): RepsValidationError[] {
  const errors: RepsValidationError[] = []
  for (const session of sessions) {
    for (const ex of session.exercises) {
      const unit = getUnit(ex.sets)
      const display = buildRepsDisplay(ex.sets)
      if (isRepsInvalidForUnit(display, unit)) {
        errors.push({
          sessionDay: session.day,
          seriesLabel: ex.series_label,
          message: unit === 'seconds'
            ? 'Seconds must be a single number (e.g. 30).'
            : 'Reps can only contain numbers, hyphens, and commas (e.g. 8-10 or 10, 8, 6).',
        })
      }
    }
  }
  return errors
}
