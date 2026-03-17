import { useState, useRef, useEffect } from 'react'
import { cn, seriesColor, seriesGroup } from '../../lib/utils'

const SERIES_OPTIONS = [
  'WU1', 'WU2', 'WU3', 'WU4',
  'A1', 'A2', 'A3', 'A4',
  'B1', 'B2', 'B3', 'B4',
  'C1', 'C2', 'C3', 'C4',
  'D1', 'D2', 'D3', 'D4',
  'CD1', 'CD2', 'CD3', 'CD4',
]

interface SeriesLabelDropdownProps {
  value: string
  onChange: (newLabel: string) => void
}

export function SeriesLabelDropdown({ value, onChange }: SeriesLabelDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const group = seriesGroup(value)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center rounded px-2 py-1 text-xs font-bold border transition-colors',
          seriesColor(group),
          'hover:opacity-80 cursor-pointer'
        )}
      >
        {value}
        <svg className="ml-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-2 space-y-1 w-44">
          {['WU', 'A', 'B', 'C', 'D', 'CD'].map((grp) => {
            const opts = SERIES_OPTIONS.filter((o) => seriesGroup(o) === grp)
            return (
              <div key={grp} className="flex gap-0.5">
                {opts.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      if (opt !== value) onChange(opt)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex-1 rounded px-1.5 py-1 text-xs font-medium transition-colors',
                      opt === value
                        ? 'bg-emerald-600 text-white'
                        : 'text-zinc-300 hover:bg-zinc-700'
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
