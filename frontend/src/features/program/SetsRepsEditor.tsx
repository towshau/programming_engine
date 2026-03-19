import { useState, useMemo } from 'react'
import { cn } from '../../lib/utils'
import type { RepUnit } from '../../types'

interface SetsRepsEditorProps {
  sets: number
  repsDisplay: string
  unit: RepUnit
  hasError?: boolean
  onSetsChange: (newSets: number) => void
  onRepsChange: (newReps: string) => void
  onUnitChange: (newUnit: RepUnit) => void
}

export function SetsRepsEditor({
  sets,
  repsDisplay,
  unit,
  hasError = false,
  onSetsChange,
  onRepsChange,
  onUnitChange,
}: SetsRepsEditorProps) {
  const [editingSets, setEditingSets] = useState(false)
  const [editingReps, setEditingReps] = useState(false)
  const [setsValue, setSetsValue] = useState(sets)
  const [repsValue, setRepsValue] = useState('')
  const [inputError, setInputError] = useState(false)

  const isCustom = useMemo(() => repsDisplay.includes(','), [repsDisplay])
  const isSeconds = unit === 'seconds'

  const handleRepsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
    if (e.key === 'Escape') {
      setEditingReps(false)
      setInputError(false)
    }

    if (isSeconds) {
      if (!/[\d]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault()
      }
    } else {
      if (!/[\d\-,\s]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault()
      }
    }
  }

  const handleRepsBlur = () => {
    setEditingReps(false)
    setInputError(false)
    const raw = repsValue.trim()
    if (!raw) return

    if (isSeconds && !/^\d+$/.test(raw)) {
      setInputError(true)
      return
    }
    if (!isSeconds && !/^[\d\s,\-]+$/.test(raw)) {
      setInputError(true)
      return
    }

    if (raw !== repsDisplay) {
      onRepsChange(raw)
    }
  }

  const startEditingReps = () => {
    setRepsValue(repsDisplay)
    setInputError(false)
    setEditingReps(true)
  }

  const handleToggleUnit = () => {
    onUnitChange(isSeconds ? 'reps' : 'seconds')
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      {/* Sets */}
      {editingSets ? (
        <input
          type="number"
          min={1}
          max={8}
          value={setsValue}
          onChange={(e) => setSetsValue(Number(e.target.value))}
          onBlur={() => {
            setEditingSets(false)
            if (setsValue !== sets && setsValue >= 1 && setsValue <= 8) {
              onSetsChange(setsValue)
            } else {
              setSetsValue(sets)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') {
              setSetsValue(sets)
              setEditingSets(false)
            }
          }}
          autoFocus
          className="w-10 rounded bg-zinc-700 border border-emerald-500 px-1.5 py-0.5 text-center text-zinc-200 text-sm focus:outline-none"
        />
      ) : (
        <button
          onClick={() => setEditingSets(true)}
          className={cn(
            'rounded px-1.5 py-0.5 font-medium text-zinc-300',
            'hover:bg-zinc-700 hover:text-emerald-400 transition-colors cursor-pointer'
          )}
          title="Edit sets"
        >
          {sets}
        </button>
      )}

      <span className="text-zinc-600">x</span>

      {/* Reps / seconds value */}
      {editingReps ? (
        <input
          type="text"
          inputMode={isSeconds ? 'numeric' : 'text'}
          value={repsValue}
          onChange={(e) => setRepsValue(e.target.value)}
          onBlur={handleRepsBlur}
          onKeyDown={handleRepsKeyDown}
          autoFocus
          placeholder={isSeconds ? 'e.g. 30' : isCustom ? 'e.g. 10, 8, 6' : 'e.g. 8-10'}
          className={cn(
            'w-24 rounded bg-zinc-700 border px-1.5 py-0.5 text-center text-zinc-200 text-sm focus:outline-none',
            inputError ? 'border-red-500' : 'border-emerald-500'
          )}
        />
      ) : (
        <button
          onClick={startEditingReps}
          className={cn(
            'rounded px-1.5 py-0.5 font-medium transition-colors cursor-pointer',
            hasError
              ? 'ring-1 ring-red-500 bg-red-500/10 text-red-300 hover:bg-red-500/20'
              : isCustom
                ? 'text-teal-400 hover:bg-zinc-700 hover:text-emerald-400'
                : 'text-zinc-300 hover:bg-zinc-700 hover:text-emerald-400'
          )}
          title={hasError ? 'Invalid — fix before saving' : isCustom ? 'Custom reps per set — click to edit' : 'Edit reps'}
        >
          {repsDisplay}
        </button>
      )}

      {/* Unit toggle */}
      <button
        onClick={handleToggleUnit}
        className={cn(
          'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border transition-colors',
          hasError && 'ring-1 ring-red-500 border-red-500/50',
          isSeconds
            ? 'border-blue-500/40 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20'
            : 'border-zinc-600/40 text-zinc-500 bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-300'
        )}
        title={isSeconds ? 'Switch to reps' : 'Switch to seconds'}
      >
        {isSeconds ? 'sec' : 'reps'}
      </button>
    </div>
  )
}
