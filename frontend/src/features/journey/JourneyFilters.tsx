import { useJourneyStore } from '../../stores/journeyStore'
import { Button } from '../../components/ui/Button'
import { cn } from '../../lib/utils'

export function JourneyFilters() {
  const {
    templates,
    selectedType, setTypeFilter,
    editMode, setEditMode,
  } = useJourneyStore()

  const types = ['All', ...Array.from(new Set(templates.map(t => t.journey_type))).sort()]

  const typeLabels: Record<string, string> = {
    'All': 'All Types',
    'new_member': 'New Member',
    'renewal': 'Renewal',
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex p-0.5 rounded-lg" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
        {types.map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={cn(
              'px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors',
              selectedType === t
                ? 'bg-white shadow-sm'
                : 'hover:bg-[var(--border)]',
            )}
            style={{ color: selectedType === t ? 'var(--text)' : 'var(--text-muted)' }}
          >
            {typeLabels[t] || t}
          </button>
        ))}
      </div>

      <Button
        variant={editMode ? 'primary' : 'outline'}
        onClick={() => setEditMode(!editMode)}
        className="text-xs px-2.5 py-1 h-auto"
      >
        {editMode ? 'Exit Edit' : 'Edit Journey'}
      </Button>
    </div>
  )
}
