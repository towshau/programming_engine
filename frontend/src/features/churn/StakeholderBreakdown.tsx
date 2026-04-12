import { useState } from 'react'
import type { ChurnRiskMember, RiskTier } from './types'
import { GYM_MANAGER_MAP, groupBy, sortStakeholderCards } from './tierUtils'
import { StakeholderCard } from './StakeholderCard'
import { StakeholderMemberModal } from './StakeholderMemberModal'
import { cn } from '../../lib/utils'

type ModalState = {
  title: string
  subtitle?: string
  members: ChurnRiskMember[]
  contextLabel: string
} | null

type Tab = 'gym' | 'coach' | 'renewal_lead'

const TABS: { id: Tab; label: string }[] = [
  { id: 'gym', label: 'By Gym' },
  { id: 'coach', label: 'By Coach' },
  { id: 'renewal_lead', label: 'By Renewal Lead' },
]

interface StakeholderBreakdownProps {
  members: ChurnRiskMember[]
  activeTiers: Set<RiskTier>
}

export function StakeholderBreakdown({ members, activeTiers }: StakeholderBreakdownProps) {
  const [activeTab, setActiveTab] = useState<Tab>('gym')
  const [modal, setModal] = useState<ModalState>(null)

  const gymGroups = groupBy(members, (m) => m.gym)
  const coachGroups = groupBy(members, (m) => m.coach_name)
  const renewalLeadGroups = groupBy(members, (m) => m.renewal_lead_name)

  function renderCards() {
    switch (activeTab) {
      case 'gym': {
        const gyms = ['BLIGH', 'BRIDGE', 'COLLINS']
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {gyms.map((gym) => (
              <StakeholderCard
                key={gym}
                title={gym}
                subtitle={`Manager: ${GYM_MANAGER_MAP[gym] ?? 'Unknown'}`}
                members={gymGroups.get(gym) ?? []}
                onOpen={() =>
                  setModal({
                    title: gym,
                    subtitle: `Manager: ${GYM_MANAGER_MAP[gym] ?? 'Unknown'}`,
                    members: gymGroups.get(gym) ?? [],
                    contextLabel: 'Gym',
                  })
                }
              />
            ))}
          </div>
        )
      }
      case 'coach': {
        const sorted = sortStakeholderCards(Array.from(coachGroups.entries()), activeTiers)
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {sorted.map(([name, group]) => (
              <StakeholderCard
                key={name}
                title={name}
                subtitle={group[0]?.gym}
                members={group}
                onOpen={() =>
                  setModal({
                    title: name,
                    subtitle: group[0]?.gym,
                    members: group,
                    contextLabel: 'Coach',
                  })
                }
              />
            ))}
          </div>
        )
      }
      case 'renewal_lead': {
        const sorted = sortStakeholderCards(Array.from(renewalLeadGroups.entries()), activeTiers)
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {sorted.map(([name, group]) => (
              <StakeholderCard
                key={name}
                title={name}
                subtitle={group[0]?.gym}
                members={group}
                onOpen={() =>
                  setModal({
                    title: name,
                    subtitle: group[0]?.gym,
                    members: group,
                    contextLabel: 'Renewal lead',
                  })
                }
              />
            ))}
          </div>
        )
      }
    }
  }

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Stakeholder Breakdown
        </h2>
        <div
          className="flex rounded-lg p-0.5"
          style={{ background: 'var(--bg3)' }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                activeTab === tab.id
                  ? 'shadow-sm'
                  : 'hover:opacity-80',
              )}
              style={{
                background: activeTab === tab.id ? 'var(--bg2)' : 'transparent',
                color: activeTab === tab.id ? 'var(--text)' : 'var(--text-muted)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {renderCards()}

      <StakeholderMemberModal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.title ?? ''}
        subtitle={modal?.subtitle}
        members={modal?.members ?? []}
        contextLabel={modal?.contextLabel}
      />
    </div>
  )
}
