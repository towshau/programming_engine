import { useRef } from 'react'
import type { DayType } from '../../lib/templateBuilder'

interface AddDayModalProps {
  onSelect: (dayType: DayType) => void
  onClose: () => void
}

const OPTIONS: { type: DayType; label: string; description: string }[] = [
  { type: 'full', label: 'Full Body', description: 'Upper + lower compound and accessory work' },
  { type: 'upper', label: 'Upper Body', description: 'Press, pull, and upper-body accessories' },
  { type: 'lower', label: 'Lower Body', description: 'Push, pull, hip-dominant, and lower accessories' },
]

export function AddDayModal({ onSelect, onClose }: AddDayModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/60"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">Add Training Day</h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-3 space-y-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.type}
              onClick={() => onSelect(opt.type)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-left transition-colors hover:border-emerald-500/50 hover:bg-zinc-800/80"
            >
              <p className="text-sm font-medium text-zinc-200">{opt.label}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
