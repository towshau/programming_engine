import { useState } from 'react'
import type { DisplayRiskTier } from '../features/churn/tierUtils'
import { useChurnRisk } from '../features/churn/useChurnRisk'
import { useChurnDetail } from '../features/churn/useChurnDetail'
import { ChurnSummaryStrip } from '../features/churn/ChurnSummaryStrip'
import { StakeholderBreakdown } from '../features/churn/StakeholderBreakdown'
import { ChurnTable } from '../features/churn/ChurnTable'

export function ChurnRiskPage() {
  const { members, historyMap, loading, error } = useChurnRisk()
  const { attendanceMap, fetchAttendance } = useChurnDetail()
  const [activeTiers, setActiveTiers] = useState<Set<DisplayRiskTier>>(new Set())
  const [sortRpi, setSortRpi] = useState<'none' | 'desc'>('none')

  function handleToggleTier(tier: DisplayRiskTier | null) {
    if (tier === null) {
      setActiveTiers(new Set())
      setSortRpi('none')
    } else {
      setActiveTiers((prev) => {
        const next = new Set(prev)
        if (next.has(tier)) next.delete(tier)
        else next.add(tier)
        return next
      })
      setSortRpi('none')
    }
  }

  if (loading) {
    return (
      <div className="px-6 py-6 flex items-center justify-center" style={{ background: 'var(--bg)', minHeight: '100%' }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 rounded-full border-3 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-gold)', borderTopColor: 'transparent' }}
          />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading RPI data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-6 py-6" style={{ background: 'var(--bg)', minHeight: '100%' }}>
        <div
          className="rounded-xl border p-5"
          style={{ background: 'var(--red-bg)', borderColor: 'var(--red-border)' }}
        >
          <h1 className="text-lg font-bold" style={{ color: 'var(--red)' }}>
            Failed to load RPI data
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--red)' }}>{error}</p>
        </div>
      </div>
    )
  }

  const scoredAt = members[0]?.scored_at ?? null

  return (
    <div className="px-6 py-6 space-y-4" style={{ background: 'var(--bg)', minHeight: '100%' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>RPI</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Renewal Probability Index
          </p>
        </div>
      </div>

      <ChurnSummaryStrip
        members={members}
        activeTiers={activeTiers}
        onToggleTier={handleToggleTier}
        scoredAt={scoredAt}
        sortRpi={sortRpi}
        onToggleSortRpi={() => {
          setSortRpi((prev) => (prev === 'none' ? 'desc' : 'none'))
          setActiveTiers(new Set())
        }}
      />

      <StakeholderBreakdown members={members} activeTiers={activeTiers} sortRpi={sortRpi} />

      <ChurnTable
        members={members}
        historyMap={historyMap}
        activeTiers={activeTiers}
        attendanceMap={attendanceMap}
        onExpandMember={fetchAttendance}
      />
    </div>
  )
}
