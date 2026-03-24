import { useMemo } from 'react'
import { cn } from '../../lib/utils'

interface ComplianceHeatmapProps {
  startDate: string
  endDate: string
  complianceDates: string[]
  sessionsPerWeek: number | null
  durationWeeks: number | null
}

/** Calendar YYYY-MM-DD in the user's local timezone (not UTC — avoids weekday shift in AU etc.). */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function ComplianceHeatmap({
  startDate,
  endDate,
  complianceDates,
  sessionsPerWeek,
  durationWeeks,
}: ComplianceHeatmapProps) {
  const loggedSet = useMemo(
    () => new Set(complianceDates.map((d) => d.slice(0, 10))),
    [complianceDates],
  )

  const { weeks, totalDaysLogged, expectedSessions } = useMemo(() => {
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')

    const dow = start.getDay()
    const mondayOffset = dow === 0 ? -6 : 1 - dow
    const weekStart = addDays(start, mondayOffset)

    const rows: { weekLabel: string; days: { date: string; inRange: boolean; logged: boolean }[] }[] = []
    let cursor = new Date(weekStart)
    let weekNum = 1

    while (cursor <= end || cursor < addDays(end, 7)) {
      const week: { date: string; inRange: boolean; logged: boolean }[] = []
      for (let d = 0; d < 7; d++) {
        const ds = toLocalDateStr(cursor)
        const inRange = cursor >= start && cursor <= end
        week.push({ date: ds, inRange, logged: loggedSet.has(ds) })
        cursor = addDays(cursor, 1)
      }
      if (week.some((d) => d.inRange)) {
        rows.push({ weekLabel: `W${weekNum}`, days: week })
        weekNum++
      }
      if (cursor > addDays(end, 7)) break
    }

    let logged = 0
    for (const date of complianceDates) {
      const d = date.slice(0, 10)
      if (d >= startDate && d <= endDate) logged++
    }

    const expected =
      sessionsPerWeek != null && durationWeeks != null
        ? sessionsPerWeek * durationWeeks
        : null

    return { weeks: rows, totalDaysLogged: logged, expectedSessions: expected }
  }, [startDate, endDate, loggedSet, complianceDates, sessionsPerWeek, durationWeeks])

  if (weeks.length === 0) return null

  const pct =
    expectedSessions != null && expectedSessions > 0
      ? Math.round((totalDaysLogged / expectedSessions) * 100)
      : null

  return (
    <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Training Compliance
        </span>
        <span className="text-[10px] text-zinc-400">
          {totalDaysLogged} session{totalDaysLogged !== 1 ? 's' : ''} logged
          {expectedSessions != null && (
            <> of {expectedSessions} expected{pct != null && <> ({pct}%)</>}</>
          )}
        </span>
      </div>

      <div className="space-y-0.5">
        {/* Day-of-week header */}
        <div className="flex items-center gap-0.5 pl-7">
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              className="w-4 h-3 flex items-center justify-center text-[8px] text-zinc-600"
            >
              {label}
            </div>
          ))}
        </div>

        {weeks.map((week) => (
          <div key={week.weekLabel} className="flex items-center gap-0.5">
            <span className="w-6 text-[8px] text-zinc-600 text-right mr-1">
              {week.weekLabel}
            </span>
            {week.days.map((day) => (
              <div
                key={day.date}
                title={day.inRange ? `${day.date}${day.logged ? ' — logged' : ''}` : ''}
                className={cn(
                  'w-4 h-4 rounded-[3px] transition-colors',
                  !day.inRange && 'bg-transparent',
                  day.inRange && !day.logged && 'bg-zinc-700/50',
                  day.inRange && day.logged && 'bg-emerald-500/70',
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
