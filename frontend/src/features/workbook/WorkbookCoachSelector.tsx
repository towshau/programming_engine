import { useState, useRef, useEffect } from 'react'
import type { WorkbookCoach } from './types'

interface Props {
  coaches: WorkbookCoach[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function WorkbookCoachSelector({ coaches, selectedIds, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  const label =
    selectedIds.length === 0
      ? 'Select coaches...'
      : selectedIds.length === 1
        ? (coaches.find((c) => c.id === selectedIds[0])?.coach_name ?? 'Unknown')
        : `${selectedIds.length} coaches selected`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 min-w-[200px] justify-between"
      >
        {label}
        <svg
          className={`h-4 w-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-lg">
          {coaches.map((c) => (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(c.id)}
                onChange={() => toggle(c.id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-700">
                  {c.coach_name ?? `${c.first_name} ${c.last_name ?? ''}`}
                </span>
                <span className="text-xs text-gray-400">{c.role}</span>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
