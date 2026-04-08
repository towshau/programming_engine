import { useId, useRef, useState } from 'react'
import type { MemberPhysicals, HealthMetrics } from '../../lib/scoring'
import { RadarOverview } from './RadarOverview'
import { MasterTrendChart } from './MasterTrendChart'
import { IndividualBenchmarkCharts, IndividualBodyCompCharts } from './IndividualTrendCharts'
import { downloadProgressReport } from './pdf-export'
import { cn } from '../../lib/utils'

// ────────────────────────────────────────────────────────────────────────────
// Time filter helpers
// ────────────────────────────────────────────────────────────────────────────

type TimeRange = '3m' | '6m' | 'all'

const TIME_LABELS: Record<TimeRange, string> = {
  '3m': 'Last 3 Months',
  '6m': 'Last 6 Months',
  all: 'All Time',
}

function filterByRange<T extends { submission_date?: string | null; date_created?: string | null }>(
  rows: T[],
  range: TimeRange,
  dateKey: 'submission_date' | 'date_created',
): T[] {
  if (range === 'all') return rows
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - (range === '3m' ? 3 : 6))
  return rows.filter((r) => {
    const d = r[dateKey]
    if (!d) return false
    return new Date(d) >= cutoff
  })
}

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

interface Props {
  latestPhysicals: MemberPhysicals | null
  physicalsHistory: MemberPhysicals[]
  healthHistory: HealthMetrics[]
  memberName: string
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function ProgressTab({
  latestPhysicals,
  physicalsHistory,
  healthHistory,
  memberName,
}: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>('6m')
  const [exporting, setExporting] = useState(false)
  const contentId = useId().replace(/:/g, '_')
  const exportId = `progress-export-${contentId}`

  const filteredPhysicals = filterByRange(physicalsHistory, timeRange, 'submission_date')
  const filteredHealth = filterByRange(healthHistory, timeRange, 'date_created')

  async function handleDownload() {
    setExporting(true)
    try {
      await downloadProgressReport(exportId, memberName)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        {/* Time filter */}
        <div
          className="flex items-center rounded-lg border overflow-hidden"
          style={{ borderColor: 'var(--border)', background: 'var(--bg3)' }}
        >
          {(Object.keys(TIME_LABELS) as TimeRange[]).map((key) => (
            <button
              key={key}
              onClick={() => setTimeRange(key)}
              className={cn(
                'px-3.5 py-1.5 text-xs font-semibold transition-colors',
                timeRange === key
                  ? 'text-white'
                  : 'hover:text-[var(--text)]',
              )}
              style={
                timeRange === key
                  ? { background: 'var(--color-gold)', color: 'white' }
                  : { color: 'var(--text-muted)' }
              }
            >
              {TIME_LABELS[key]}
            </button>
          ))}
        </div>

        {/* Download button */}
        <button
          onClick={handleDownload}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-60"
          style={{
            borderColor: 'var(--color-gold)',
            color: 'var(--color-gold)',
            background: 'transparent',
          }}
          onMouseOver={(e) => {
            if (!exporting) {
              e.currentTarget.style.background = 'var(--color-gold)'
              e.currentTarget.style.color = 'white'
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--color-gold)'
          }}
        >
          {exporting ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 12a8 8 0 018-8V4"
                />
              </svg>
              Generating…
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download Report
            </>
          )}
        </button>
      </div>

      {/* Exportable content area */}
      <div id={exportId} className="space-y-5 rounded-xl p-1">
        {/* Radar */}
        <RadarOverview physicals={latestPhysicals} />

        {/* Master trend chart */}
        {filteredPhysicals.length === 0 && filteredHealth.length === 0 ? (
          <div
            className="rounded-xl border p-8 text-center"
            style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}
          >
            <p className="text-sm mb-1 font-semibold" style={{ color: 'var(--text)' }}>
              No history in this time range
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Try switching to "All Time" or check back after the next assessment.
            </p>
          </div>
        ) : (
          <>
            <MasterTrendChart data={filteredPhysicals} />
            <IndividualBenchmarkCharts data={filteredPhysicals} />
            <IndividualBodyCompCharts data={filteredHealth} />
          </>
        )}
      </div>
    </div>
  )
}
