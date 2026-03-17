import { cn } from '../../lib/utils'

interface DayPickerProps {
  days: number[]
  selectedDay: number | null
  onSelect: (day: number) => void
}

export function DayPicker({ days, selectedDay, onSelect }: DayPickerProps) {
  return (
    <div className="flex gap-2 flex-wrap">
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
    </div>
  )
}
