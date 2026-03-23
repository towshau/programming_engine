import type { ExerciseLibraryItem, ProgramPayload, ProgramSession } from '../types'

type DayType = 'upper' | 'lower'

const UPPER_PRESS_TAGS = ['Horizontal Press', 'Vertical Press']
const UPPER_PULL_TAGS = ['Horizontal Pull', 'Vertical Pull']
const LOWER_PUSH_TAGS = ['Lower Body Push', 'Hip Dominant']
const LOWER_PULL_TAGS = ['Lower Body Pull', 'Hip Dominant']
const UPPER_ACCESSORY_TAGS = [
  'Elbow Flexion',
  'Elbow Extension',
  'Lateral & Front Raise',
  'External Rotation',
  'Core Stability',
]
const LOWER_ACCESSORY_TAGS = [
  'Hip Abduction',
  'Lower Leg',
  'Core Stability',
  'Spinal Flexion',
  'Mobility',
]

function parseRepRange(repRange: string): [number, number] {
  const m = repRange.match(/(\d+)\s*-\s*(\d+)/)
  if (!m) return [8, 10]
  return [Number(m[1]), Number(m[2])]
}

function formatRange(low: number, high: number): string {
  return `${low}-${high}`
}

function hasSeries(item: ExerciseLibraryItem, target: string): boolean {
  return !!item.series_assignment?.includes(target)
}

function hasTag(item: ExerciseLibraryItem, tags: string[]): boolean {
  return !!item.tags && tags.includes(item.tags)
}

function buildPool(
  exerciseLibrary: ExerciseLibraryItem[],
  series: string[],
  tags: string[],
): ExerciseLibraryItem[] {
  return exerciseLibrary.filter(
    (item) =>
      series.some((s) => hasSeries(item, s)) &&
      (tags.length === 0 || hasTag(item, tags)),
  )
}

function dedupeByExerciseId(items: ExerciseLibraryItem[]): ExerciseLibraryItem[] {
  const seen = new Set<string>()
  const result: ExerciseLibraryItem[] = []
  for (const item of items) {
    if (seen.has(item.exercise_id)) continue
    seen.add(item.exercise_id)
    result.push(item)
  }
  return result
}

function rotatePick(
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

function dayTypeFor(day: number): DayType {
  return day % 2 === 1 ? 'upper' : 'lower'
}

function addExercise(
  session: ProgramSession,
  item: ExerciseLibraryItem | null,
  seriesLabel: string,
  sets: number,
  reps: string,
) {
  if (!item) return
  session.exercises.push({
    exercise_name: item.exercise_name,
    exercise_id: item.exercise_id,
    series_label: seriesLabel,
    tags: item.tags ?? undefined,
    sets: Array.from({ length: sets }, (_, i) => ({
      set_number: i + 1,
      reps,
    })),
  })
}

export function buildTemplateProgram(
  sessionsPerWeek: number,
  repRange: string,
  exerciseLibrary: ExerciseLibraryItem[],
): ProgramPayload {
  const [repLow, repHigh] = parseRepRange(repRange)
  const accessoryRange = formatRange(Math.min(repLow + 2, 12), Math.min(repHigh + 2, 14))

  const warmUpPool = dedupeByExerciseId(buildPool(exerciseLibrary, ['Warm Up'], []))
  const anyAPool = dedupeByExerciseId(buildPool(exerciseLibrary, ['A'], []))
  const anyBPool = dedupeByExerciseId(buildPool(exerciseLibrary, ['B'], []))
  const anyCPool = dedupeByExerciseId(buildPool(exerciseLibrary, ['C', 'D'], []))
  const anyPool = dedupeByExerciseId(exerciseLibrary)

  const upperPressPool = dedupeByExerciseId(buildPool(exerciseLibrary, ['A', 'B'], UPPER_PRESS_TAGS))
  const upperPullPool = dedupeByExerciseId(buildPool(exerciseLibrary, ['A', 'B'], UPPER_PULL_TAGS))
  const lowerPushPool = dedupeByExerciseId(buildPool(exerciseLibrary, ['A', 'B'], LOWER_PUSH_TAGS))
  const lowerPullPool = dedupeByExerciseId(buildPool(exerciseLibrary, ['A', 'B'], LOWER_PULL_TAGS))
  const upperAccessoryPool = dedupeByExerciseId(
    buildPool(exerciseLibrary, ['C', 'D', 'B'], UPPER_ACCESSORY_TAGS),
  )
  const lowerAccessoryPool = dedupeByExerciseId(
    buildPool(exerciseLibrary, ['C', 'D', 'B'], LOWER_ACCESSORY_TAGS),
  )

  const cursors: Record<string, number> = {}
  const sessions: ProgramSession[] = []
  const maxSessions = Math.max(1, Math.min(6, sessionsPerWeek))

  for (let day = 1; day <= maxSessions; day++) {
    const type = dayTypeFor(day)
    const usedIds = new Set<string>()
    const session: ProgramSession = { day, exercises: [] }

    const warmUp = rotatePick(
      warmUpPool.length > 0 ? warmUpPool : anyPool,
      cursors,
      'warmup',
      usedIds,
    )
    addExercise(session, warmUp, 'WU1', 1, repRange)

    const a1 =
      type === 'upper'
        ? rotatePick(
            upperPressPool.length > 0 ? upperPressPool : anyAPool.length > 0 ? anyAPool : anyPool,
            cursors,
            'a1_upper',
            usedIds,
          )
        : rotatePick(
            lowerPushPool.length > 0 ? lowerPushPool : anyAPool.length > 0 ? anyAPool : anyPool,
            cursors,
            'a1_lower',
            usedIds,
          )
    addExercise(session, a1, 'A1', 3, repRange)

    const a2 =
      type === 'upper'
        ? rotatePick(
            upperPullPool.length > 0 ? upperPullPool : anyAPool.length > 0 ? anyAPool : anyPool,
            cursors,
            'a2_upper',
            usedIds,
          )
        : rotatePick(
            lowerPullPool.length > 0 ? lowerPullPool : anyAPool.length > 0 ? anyAPool : anyPool,
            cursors,
            'a2_lower',
            usedIds,
          )
    addExercise(session, a2, 'A2', 3, repRange)

    const b1 = rotatePick(
      anyBPool.length > 0 ? anyBPool : anyAPool.length > 0 ? anyAPool : anyPool,
      cursors,
      `b1_${type}`,
      usedIds,
    )
    addExercise(session, b1, 'B1', 3, repRange)

    const b2 = rotatePick(
      anyBPool.length > 0 ? anyBPool : anyCPool.length > 0 ? anyCPool : anyPool,
      cursors,
      `b2_${type}`,
      usedIds,
    )
    addExercise(session, b2, 'B2', 3, repRange)

    const c1 = rotatePick(
      type === 'upper'
        ? upperAccessoryPool.length > 0
          ? upperAccessoryPool
          : anyCPool.length > 0
            ? anyCPool
            : anyPool
        : lowerAccessoryPool.length > 0
          ? lowerAccessoryPool
          : anyCPool.length > 0
            ? anyCPool
            : anyPool,
      cursors,
      `c1_${type}`,
      usedIds,
    )
    addExercise(session, c1, 'C1', 2, accessoryRange)

    const c2 = rotatePick(
      anyCPool.length > 0 ? anyCPool : anyPool,
      cursors,
      `c2_${type}`,
      usedIds,
    )
    addExercise(session, c2, 'C2', 2, accessoryRange)

    if (session.exercises.length >= 3) {
      sessions.push(session)
    }
  }

  return {
    sessions,
    metadata: {
      next_rep_range: repRange,
      confidence: 'none',
      sessions_per_week: maxSessions,
    },
  }
}
