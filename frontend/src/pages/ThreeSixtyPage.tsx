/**
 * 360 — coach performance metrics (WCR, renewals in cycle, renewal points).
 *
 * Maintenance: plan a pass to clean up table columns, queries, and Supabase shapes;
 * document changes in docs/ONE-PAGE-PLAN.md and align wiki/docs with canonical Coach OS:
 * https://github.com/Lockeroom-Gym/coachOS
 */
import { useMemo, useState } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { getRecentCycles, cycleContainingDate } from '../features/three-sixty/cycleUtils'
import type { ThreeSixtyCycle } from '../features/three-sixty/types'
import { CycleFilter } from '../features/three-sixty/CycleFilter'
import { useThreeSixty } from '../features/three-sixty/useThreeSixty'
import { WcrTable } from '../features/three-sixty/WcrTable'
import { RenewalsTable } from '../features/three-sixty/RenewalsTable'
import { RenewalPointsTable } from '../features/three-sixty/RenewalPointsTable'

export function ThreeSixtyPage() {
  const { selectedCoach } = useEditorStore()
  const coachId = selectedCoach?.id ?? null

  const cycles = useMemo(() => getRecentCycles(8), [])
  const [cycle, setCycle] = useState<ThreeSixtyCycle>(() => cycleContainingDate(new Date()))

  const { wcr, renewals, renewalMeta, loading, error } = useThreeSixty(coachId, cycle.start, cycle.end)

  return (
    <div className="flex flex-col gap-5 px-6 py-6" style={{ background: 'var(--bg)', minHeight: '100%' }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
            360
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            Coach performance: winning client results, renewals in cycle, and renewal points. Use the header coach
            filter; renewal cycle applies to the renewals table only.
          </p>
        </div>
        <CycleFilter cycles={cycles} value={cycle} onChange={setCycle} disabled={loading} />
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div
            className="h-8 w-8 rounded-full border-3 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-gold)', borderTopColor: 'transparent' }}
          />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading 360 data...
          </p>
        </div>
      )}

      {!loading && error && (
        <div
          className="rounded-xl border p-5"
          style={{ background: 'var(--bg2)', borderColor: 'var(--red)', color: 'var(--red)' }}
        >
          <h2 className="text-lg font-bold">Failed to load 360 data</h2>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-col gap-5">
          <section
            className="rounded-xl border p-5"
            style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
          >
            <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>
              Winning client results
            </h2>
            <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>
              {coachId ? 'Filtered by selected coach.' : 'All coaches.'} Sorted by submission date (newest first by
              default).
            </p>
            <WcrTable rows={wcr} />
          </section>

          <section
            className="rounded-xl border p-5"
            style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
          >
            <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>
              Renewals in cycle
            </h2>
            <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>
              Memberships with end date between{' '}
              <strong>
                {cycle.start} and {cycle.end}
              </strong>
              . Primary or handoff coach matches the header filter when a coach is selected.
            </p>
            <RenewalsTable rows={renewals} />
          </section>

          <section
            className="rounded-xl border p-5"
            style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
          >
            <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>
              Renewal points
            </h2>
            <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>
              {coachId ? 'Filtered by selected coach.' : 'All coaches.'}
            </p>
            <RenewalPointsTable rows={renewalMeta} />
          </section>
        </div>
      )}
    </div>
  )
}
