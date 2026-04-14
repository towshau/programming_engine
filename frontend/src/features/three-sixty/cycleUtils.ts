import type { ThreeSixtyCycle } from './types'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Local calendar YYYY-MM-DD (avoid UTC shift). */
export function toIsoDateLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function cycleLabel(start: Date, end: Date): string {
  const a = `${MONTH_SHORT[start.getMonth()]} ${start.getFullYear()}`
  const b = `${MONTH_SHORT[end.getMonth()]} ${end.getFullYear()}`
  return `${a} – ${b}`
}

/**
 * The 6-month cycle containing `d`:
 * - Nov 1 – Apr 30 (crosses calendar years)
 * - May 1 – Oct 31
 */
export function cycleContainingDate(d: Date): ThreeSixtyCycle {
  const y = d.getFullYear()
  const m = d.getMonth() + 1 // 1–12

  let start: Date
  let end: Date

  if (m >= 11) {
    start = new Date(y, 10, 1)
    end = new Date(y + 1, 3, 30)
  } else if (m <= 4) {
    start = new Date(y - 1, 10, 1)
    end = new Date(y, 3, 30)
  } else {
    start = new Date(y, 4, 1)
    end = new Date(y, 9, 31)
  }

  return {
    start: toIsoDateLocal(start),
    end: toIsoDateLocal(end),
    label: cycleLabel(start, end),
  }
}

function previousCycle(c: ThreeSixtyCycle): ThreeSixtyCycle {
  const end = new Date(c.end + 'T12:00:00')
  end.setDate(end.getDate() - 1)
  const dayBeforeStart = new Date(c.start + 'T12:00:00')
  dayBeforeStart.setDate(dayBeforeStart.getDate() - 1)
  return cycleContainingDate(dayBeforeStart)
}

/** Most recent `count` half-year cycles ending at or before today’s cycle. */
export function getRecentCycles(count: number, now: Date = new Date()): ThreeSixtyCycle[] {
  const out: ThreeSixtyCycle[] = []
  let cur = cycleContainingDate(now)
  out.push(cur)
  for (let i = 1; i < count; i++) {
    cur = previousCycle(cur)
    out.push(cur)
  }
  return out
}

export function cycleKey(c: ThreeSixtyCycle): string {
  return `${c.start}|${c.end}`
}
