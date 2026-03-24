import { cn } from '../../lib/utils'

interface DayPickerProps {
  days: number[]
  selectedDay: number | null
  onSelect: (day: number) => void
  onAddDay?: () => void
}

export function DayPicker({ days, selectedDay, onSelect, onAddDay }: DayPickerProps) {
  return (
    <div className="flex gap-2 flex-wrap items-center">
      {days.map((day) => (
        <button
          key={day}
          onClick={() => onSelect(day)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500',
            day === selectedDay
              ? 'bg-emerald-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700'
          )}
        >
          Day {day}
        </button>
      ))}
      {onAddDay && days.length < 6 && (
        <button
          onClick={onAddDay}
          title="Add training day"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-zinc-600 text-zinc-500 transition-colors hover:border-emerald-500 hover:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
        </button>
      )}
    </div>
  )
}
