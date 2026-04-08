import { useState } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useWorkbookMembers } from '../features/workbook/hooks/useWorkbookMembers'
import { GymFilter } from '../features/workbook/GymFilter'
import { MemberTable } from '../features/workbook/MemberTable'
import type { CollapseState } from '../features/workbook/types'

export function Workbook() {
  const { selectedCoach } = useEditorStore()

  const [gymFilter, setGymFilter] = useState<string | null>(null)
  const [activeOnly, setActiveOnly] = useState(true)
  const [expandAllNotes, setExpandAllNotes] = useState(false)
  const [collapse, setCollapse] = useState<CollapseState>({
    sessions: true,
    memberships: false,
    goalsHabits: false,
  })

  const selectedCoachIds = selectedCoach ? [selectedCoach.id] : []
  const { members, loading: membersLoading } = useWorkbookMembers(selectedCoachIds, gymFilter)

  function handleToggleCollapse(key: keyof CollapseState) {
    setCollapse((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const activeCount = members.filter((m) => !m.isExpired).length

  return (
    <div className="flex flex-col gap-5 px-6 py-6" style={{ background: 'var(--bg)', minHeight: '100%' }}>
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
            Coach Workbook
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            {selectedCoach
              ? `${selectedCoach.first_name} ${selectedCoach.last_name} — member check-ins, attendance & notes`
              : 'Select a coach from the top bar to load their clients'}
          </p>
        </div>

        {/* Right-side filters */}
        <div className="flex flex-shrink-0 items-center gap-3">
          <GymFilter value={gymFilter} onChange={setGymFilter} />

          <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Active only
          </label>

          {selectedCoach && (
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {membersLoading ? (
                'Loading...'
              ) : (
                <>
                  <span className="font-semibold" style={{ color: 'var(--text)' }}>{activeCount}</span> members
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Main table */}
      <MemberTable
        members={members}
        selectedCoachIds={selectedCoachIds}
        activeOnly={activeOnly}
        collapse={collapse}
        onToggleCollapse={handleToggleCollapse}
        expandAllNotes={expandAllNotes}
        onToggleExpandAllNotes={() => setExpandAllNotes((v) => !v)}
        loading={membersLoading}
      />
    </div>
  )
}
