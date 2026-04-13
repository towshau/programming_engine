import type { RiskTier, ChurnRiskMember } from './types'

export const TIER_ORDER: RiskTier[] = ['critical', 'high', 'medium', 'low']

export const TIER_CONFIG: Record<
  RiskTier,
  { label: string; color: string; bg: string; border: string; badgeVariant: 'red' | 'amber' | 'blue' | 'green' }
> = {
  critical: {
    label: 'Critical',
    color: 'var(--red)',
    bg: 'var(--red-bg)',
    border: 'var(--red-border)',
    badgeVariant: 'red',
  },
  high: {
    label: 'High',
    color: 'var(--orange)',
    bg: 'var(--orange-bg)',
    border: 'var(--orange-border)',
    badgeVariant: 'amber',
  },
  medium: {
    label: 'Medium',
    color: 'var(--blue)',
    bg: 'var(--blue-bg)',
    border: 'var(--blue-border)',
    badgeVariant: 'blue',
  },
  low: {
    label: 'Low',
    color: 'var(--green)',
    bg: 'var(--green-bg)',
    border: 'var(--green-border)',
    badgeVariant: 'green',
  },
}

export const GYM_MANAGER_MAP: Record<string, string> = {
  BLIGH: 'Levi Wheatley',
  BRIDGE: 'Andy Kong',
  COLLINS: 'Nick Woolward',
}

export function tierCounts(members: { risk_tier: RiskTier }[]): Record<RiskTier, number> {
  const counts: Record<RiskTier, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const m of members) counts[m.risk_tier]++
  return counts
}

export function pct(n: number, total: number): string {
  if (total === 0) return '0'
  return Math.round((n / total) * 100).toString()
}

export function formatScoredDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** Calendar days from today to membership end_date (local date). Negative = expired (days overdue). */
export function calendarDaysToEndDate(endDate: string | null | undefined): number | null {
  if (!endDate || !ISO_DATE_ONLY.test(endDate.trim())) return null
  const [y, mo, d] = endDate.trim().split('-').map(Number)
  const end = new Date(y, mo - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - today.getTime()) / 86_400_000)
}

export function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const arr = map.get(key) ?? []
    arr.push(item)
    map.set(key, arr)
  }
  return map
}

/** Sort coach / renewal-lead cards: when tier filters are active, rank by count in those tiers (highest first). */
export function sortStakeholderCards(
  entries: [string, ChurnRiskMember[]][],
  activeTiers: Set<RiskTier>,
): [string, ChurnRiskMember[]][] {
  return [...entries].sort(([, a], [, b]) => {
    if (activeTiers.size > 0) {
      const countInSelectedTiers = (group: ChurnRiskMember[]) =>
        group.filter((m) => activeTiers.has(m.risk_tier)).length
      return countInSelectedTiers(b) - countInSelectedTiers(a)
    }
    const aCritHigh = a.filter((m) => m.risk_tier === 'critical' || m.risk_tier === 'high').length
    const bCritHigh = b.filter((m) => m.risk_tier === 'critical' || m.risk_tier === 'high').length
    const aPct = a.length > 0 ? aCritHigh / a.length : 0
    const bPct = b.length > 0 ? bCritHigh / b.length : 0
    return bPct - aPct
  })
}
