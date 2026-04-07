import { cn } from '../../lib/utils'

interface DayPickerProps {
  days: number[]
  selectedDay: number | null
  onSelect: (day: number) => void
  onAddDay?: () => void
}

export function DayPicker({ days, selectedDay, onSelect, onAddDay }: DayPickerProps) {
  return (
    <div className="flex gap-1.5 flex-wrap items-center">
      {days.map((day) => (
        <button
          key={day}
          onClick={() => onSelect(day)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border',
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/40',
          )}
          style={
            day === selectedDay
              ? { background: 'var(--color-gold)', color: 'white', borderColor: 'var(--color-gold)' }
              : {
                  background: 'white',
                  color: 'var(--text)',
                  borderColor: 'var(--border)',
                }
          }
          onMouseOver={e => {
            if (day !== selectedDay) {
              e.currentTarget.style.background = 'var(--bg3)'
            }
          }}
          onMouseOut={e => {
            if (day !== selectedDay) {
              e.currentTarget.style.background = 'white'
            }
          }}
        >
          Day {day}
        </button>
      ))}
      {onAddDay && days.length < 6 && (
        <button
          onClick={onAddDay}
          title="Add training day"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/40"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          onMouseOver={e => {
            e.currentTarget.style.borderColor = 'var(--color-gold)'
            e.currentTarget.style.color = 'var(--color-gold)'
          }}
          onMouseOut={e => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color = 'var(--text-muted)'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
        </button>
      )}
    </div>
  )
}
