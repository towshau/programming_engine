import type { RiskTier, ChurnRiskMember } from './types'

export type DisplayRiskTier = 'high' | 'medium' | 'low'

export const TIER_ORDER: DisplayRiskTier[] = ['high', 'medium', 'low']

export const TIER_CONFIG: Record<
  DisplayRiskTier,
  { label: string; color: string; bg: string; border: string; badgeVariant: 'red' | 'amber' | 'green' }
> = {
  high: {
    label: 'High',
    color: 'var(--red)',
    bg: 'var(--red-bg)',
    border: 'var(--red-border)',
    badgeVariant: 'red',
  },
  medium: {
    label: 'Medium',
    color: 'var(--yellow)',
    bg: 'var(--yellow-bg)',
    border: 'var(--yellow-border)',
    badgeVariant: 'amber',
  },
  low: {
    label: 'Low',
    color: 'var(--green)',
    bg: 'var(--green-bg)',
    border: 'var(--green-border)',
    badgeVariant: 'green',
  },
}

export function toDisplayTier(tier: RiskTier): DisplayRiskTier {
  if (tier === 'critical') return 'high'
  return tier
}

export const GYM_MANAGER_MAP: Record<string, string> = {
  BLIGH: 'Levi Wheatley',
  BRIDGE: 'Andy Kong',
  COLLINS: 'Nick Woolward',
}

export function tierCounts(members: { risk_tier: RiskTier }[]): Record<DisplayRiskTier, number> {
  const counts: Record<DisplayRiskTier, number> = { high: 0, medium: 0, low: 0 }
  for (const m of members) counts[toDisplayTier(m.risk_tier)]++
  return counts
}

export function calculateRpi(members: { risk_tier: RiskTier }[]): number {
  const counts = tierCounts(members)
  const expectedRenewals = counts.high * 0.10 + counts.medium * 0.50 + counts.low * 0.90
  return members.length > 0 ? (expectedRenewals / members.length) * 100 : 0
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
  activeTiers: Set<DisplayRiskTier>,
  sortRpi: 'none' | 'desc' = 'none'
): [string, ChurnRiskMember[]][] {
  return [...entries].sort(([, a], [, b]) => {
    if (sortRpi === 'desc') {
      return calculateRpi(b) - calculateRpi(a)
    }

    if (activeTiers.size > 0) {
      const countInSelectedTiers = (group: ChurnRiskMember[]) =>
        group.filter((m) => activeTiers.has(toDisplayTier(m.risk_tier))).length
      return countInSelectedTiers(b) - countInSelectedTiers(a)
    }

    // Default: Sort by seniority / sheer volume of active members (largest portfolio first)
    return b.length - a.length
  })
}
