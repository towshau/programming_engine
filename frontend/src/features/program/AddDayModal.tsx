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
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className="w-full max-w-sm rounded-xl shadow-xl bg-white" style={{ border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Add Training Day</h3>
          <button
            onClick={onClose}
            className="transition-opacity opacity-60 hover:opacity-100"
            style={{ color: 'var(--text-muted)' }}
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
              className="w-full rounded-lg border px-4 py-3 text-left transition-colors"
              style={{ borderColor: 'var(--border)', background: 'var(--bg3)' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--color-gold)'; e.currentTarget.style.background = 'rgba(184,134,11,0.05)' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg3)' }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{opt.label}</p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{opt.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
