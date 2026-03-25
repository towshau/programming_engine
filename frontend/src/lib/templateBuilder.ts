import type { ExerciseLibraryItem, ProgramPayload, ProgramSession } from '../types'

export type DayType = 'upper' | 'lower' | 'full'

const SPLIT_MAP: Record<number, DayType[]> = {
  1: ['full'],
  2: ['upper', 'lower'],
  3: ['upper', 'lower', 'full'],
  4: ['upper', 'lower', 'upper', 'lower'],
  5: ['upper', 'lower', 'upper', 'lower', 'full'],
  6: ['upper', 'lower', 'upper', 'lower', 'upper', 'lower'],
}

// ── Slot definitions per day type ─────────────────────────────────────────────
// Each slot: [seriesLabel, sets, tagFilter[], seriesFilter[], cursorKey]

interface SlotDef {
  label: string
  sets: number
  accessory: boolean
  tags: string[]
  series: string[]
  cursor: string
}

const UPPER_SLOTS: SlotDef[] = [
  { label: 'A1', sets: 3, accessory: false, tags: ['Horizontal Press'], series: ['A', 'B'], cursor: 'hpress' },
  { label: 'A2', sets: 3, accessory: false, tags: ['Horizontal Pull'], series: ['A', 'B'], cursor: 'hpull' },
  { label: 'B1', sets: 3, accessory: false, tags: ['Vertical Press'], series: ['A', 'B'], cursor: 'vpress' },
  { label: 'B2', sets: 3, accessory: false, tags: ['Vertical Pull'], series: ['A', 'B'], cursor: 'vpull' },
  { label: 'C1', sets: 2, accessory: true, tags: ['Elbow Flexion', 'Elbow Extension', 'Lateral & Front Raise', 'External Rotation'], series: ['C', 'D', 'B'], cursor: 'upper_acc1' },
  { label: 'C2', sets: 2, accessory: true, tags: ['Core Stability', 'Elbow Flexion', 'Elbow Extension', 'Lateral & Front Raise'], series: ['C', 'D', 'B'], cursor: 'upper_acc2' },
]

const LOWER_SLOTS: SlotDef[] = [
  { label: 'A1', sets: 3, accessory: false, tags: ['Lower Body Push'], series: ['A', 'B'], cursor: 'lbpush' },
  { label: 'A2', sets: 3, accessory: false, tags: ['Lower Body Pull'], series: ['A', 'B'], cursor: 'lbpull' },
  { label: 'B1', sets: 3, accessory: false, tags: ['Hip Dominant'], series: ['A', 'B'], cursor: 'hipdominant' },
  { label: 'B2', sets: 3, accessory: false, tags: ['Lower Body Push', 'Lower Body Pull', 'Hip Dominant'], series: ['B', 'C'], cursor: 'lower_b2' },
  { label: 'C1', sets: 2, accessory: true, tags: ['Hip Abduction', 'Lower Leg', 'Core Stability'], series: ['C', 'D', 'B'], cursor: 'lower_acc1' },
  { label: 'C2', sets: 2, accessory: true, tags: ['Spinal Flexion', 'Mobility', 'Core Stability'], series: ['C', 'D', 'B'], cursor: 'lower_acc2' },
]

const FULL_SLOTS: SlotDef[] = [
  { label: 'A1', sets: 3, accessory: false, tags: ['Horizontal Press'], series: ['A', 'B'], cursor: 'full_hpress' },
  { label: 'A2', sets: 3, accessory: false, tags: ['Horizontal Pull'], series: ['A', 'B'], cursor: 'full_hpull' },
  { label: 'B1', sets: 3, accessory: false, tags: ['Lower Body Push'], series: ['A', 'B'], cursor: 'full_lbpush' },
  { label: 'B2', sets: 3, accessory: false, tags: ['Lower Body Pull'], series: ['A', 'B'], cursor: 'full_lbpull' },
  { label: 'C1', sets: 2, accessory: true, tags: ['Core Stability', 'Elbow Flexion', 'Lateral & Front Raise'], series: ['C', 'D', 'B'], cursor: 'full_acc1' },
  { label: 'C2', sets: 2, accessory: true, tags: ['Hip Abduction', 'Lower Leg', 'Spinal Flexion', 'Mobility'], series: ['C', 'D', 'B'], cursor: 'full_acc2' },
]

const DAY_TYPE_SLOTS: Record<DayType, SlotDef[]> = {
  upper: UPPER_SLOTS,
  lower: LOWER_SLOTS,
  full: FULL_SLOTS,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseRepRange(repRange: string): [number, number] {
  const m = repRange.match(/(\d+)\s*-\s*(\d+)/)
  if (!m) return [8, 10]
  return [Number(m[1]), Number(m[2])]
}

function formatRange(low: number, high: number): string {
  return `${low}-${high}`
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function buildPool(
  exerciseLibrary: ExerciseLibraryItem[],
  series: string[],
  tags: string[],
): ExerciseLibraryItem[] {
  return exerciseLibrary.filter(
    (item) =>
      item.series_assignment?.some((s) => series.includes(s)) &&
      (tags.length === 0 || (!!item.tags && tags.includes(item.tags))),
  )
}

function dedupeAndShuffle(items: ExerciseLibraryItem[]): ExerciseLibraryItem[] {
  const seen = new Set<string>()
  const result: ExerciseLibraryItem[] = []
  for (const item of items) {
    if (seen.has(item.exercise_id)) continue
    seen.add(item.exercise_id)
    result.push(item)
  }
  return shuffle(result)
}

function pickFromPool(
  pool: ExerciseLibraryItem[],
  cursorMap: Record<string, number>,
  cursorKey: string,
  usedIds: Set<string>,
): ExerciseLibraryItem | null {
  if (pool.length === 0) return null
  const start = cursorMap[cursorKey] ?? 0

  for (let i = 0; i < pool.length; i++) {
    const idx = (start + i) % pool.length
    const item = pool[idx]
    if (!usedIds.has(item.exercise_id)) {
      cursorMap[cursorKey] = (idx + 1) % pool.length
      usedIds.add(item.exercise_id)
      return item
    }
  }

  const idx = start % pool.length
  const fallback = pool[idx]
  cursorMap[cursorKey] = (idx + 1) % pool.length
  usedIds.add(fallback.exercise_id)
  return fallback
}

// ── Single-session builder ────────────────────────────────────────────────────

export function buildSingleSession(
  dayNumber: number,
  dayType: DayType,
  repRange: string,
  exerciseLibrary: ExerciseLibraryItem[],
  usedExerciseIds?: Set<string>,
): ProgramSession | null {
  const [repLow, repHigh] = parseRepRange(repRange)
  const compoundRange = repRange
  const accessoryRange = formatRange(
    Math.min(repLow + 2, 12),
    Math.min(repHigh + 2, 14),
  )

  const warmUpPool = dedupeAndShuffle(
    buildPool(exerciseLibrary, ['Warm Up'], []),
  )
  const fallbackPool = dedupeAndShuffle(exerciseLibrary)

  const slotPools = new Map<string, ExerciseLibraryItem[]>()
  function getPool(slot: SlotDef): ExerciseLibraryItem[] {
    const key = `${slot.cursor}__${slot.tags.join(',')}__${slot.series.join(',')}`
    if (!slotPools.has(key)) {
      const pool = dedupeAndShuffle(buildPool(exerciseLibrary, slot.series, slot.tags))
      slotPools.set(key, pool)
    }
    return slotPools.get(key)!
  }

  const cursors: Record<string, number> = {}
  const usedIds = new Set<string>(usedExerciseIds)
  const slots = DAY_TYPE_SLOTS[dayType]
  const session: ProgramSession = { day: dayNumber, exercises: [] }

  const warmUp = pickFromPool(
    warmUpPool.length > 0 ? warmUpPool : fallbackPool,
    cursors,
    'warmup',
    usedIds,
  )
  if (warmUp) {
    session.exercises.push({
      exercise_name: warmUp.exercise_name,
      exercise_id: warmUp.exercise_id,
      series_label: 'WU1',
      tags: warmUp.tags ?? undefined,
      sets: [{ set_number: 1, reps: repRange }],
      row_id: crypto.randomUUID(),
    })
  }

  for (const slot of slots) {
    const pool = getPool(slot)
    const picked = pickFromPool(
      pool.length > 0 ? pool : fallbackPool,
      cursors,
      slot.cursor,
      usedIds,
    )
    if (!picked) continue

    const reps = slot.accessory ? accessoryRange : compoundRange
    session.exercises.push({
      exercise_name: picked.exercise_name,
      exercise_id: picked.exercise_id,
      series_label: slot.label,
      tags: picked.tags ?? undefined,
      sets: Array.from({ length: slot.sets }, (_, i) => ({
        set_number: i + 1,
        reps,
      })),
      row_id: crypto.randomUUID(),
    })
  }

  if (session.exercises.length < 3) return null
  return session
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildTemplateProgram(
  sessionsPerWeek: number,
  repRange: string,
  exerciseLibrary: ExerciseLibraryItem[],
): ProgramPayload {
  const clamped = Math.max(1, Math.min(6, sessionsPerWeek))
  const dayTypes = SPLIT_MAP[clamped]

  const sessions: ProgramSession[] = []
  for (let dayIdx = 0; dayIdx < dayTypes.length; dayIdx++) {
    const session = buildSingleSession(
      dayIdx + 1,
      dayTypes[dayIdx],
      repRange,
      exerciseLibrary,
    )
    if (session) sessions.push(session)
  }

  return {
    sessions,
    metadata: {
      next_rep_range: repRange,
      confidence: 'none',
      sessions_per_week: clamped,
    },
  }
}
