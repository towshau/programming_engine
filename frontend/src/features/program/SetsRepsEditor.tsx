import { useState, useMemo } from 'react'
import { cn } from '../../lib/utils'

interface SetsRepsEditorProps {
  sets: number
  reps: string
  onSetsChange: (newSets: number) => void
  onRepsChange: (newReps: string) => void
}

function isSecondsMode(reps: string): boolean {
  return /\d+s$/.test(reps.trim().split(',')[0]?.trim() ?? '')
}

function stripUnit(val: string): string {
  return val.replace(/s$/, '').trim()
}

function formatDisplay(reps: string): { display: string; isSeconds: boolean; isCustom: boolean } {
  const isSeconds = isSecondsMode(reps)
  const parts = reps.split(',').map((p) => p.trim())
  const isCustom = parts.length > 1
  const cleaned = parts.map((p) => (isSeconds ? stripUnit(p) : p))
  const display = cleaned.join(', ')
  return { display, isSeconds, isCustom }
}

export function SetsRepsEditor({
  sets,
  reps,
  onSetsChange,
  onRepsChange,
}: SetsRepsEditorProps) {
  const [editingSets, setEditingSets] = useState(false)
  const [editingReps, setEditingReps] = useState(false)
  const [setsValue, setSetsValue] = useState(sets)
  const [repsValue, setRepsValue] = useState('')

  const { display, isSeconds, isCustom } = useMemo(() => formatDisplay(reps), [reps])

  const handleToggleUnit = () => {
    const parts = reps.split(',').map((p) => p.trim())
    let newReps: string
    if (isSeconds) {
      newReps = parts.map((p) => stripUnit(p)).join(', ')
    } else {
      newReps = parts.map((p) => `${p}s`).join(', ')
    }
    onRepsChange(newReps)
  }

  const handleRepsBlur = () => {
    setEditingReps(false)
    const raw = repsValue.trim()
    if (!raw) {
      return
    }
    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
    const withUnit = isSeconds
      ? parts.map((p) => (/s$/.test(p) ? p : `${p}s`)).join(', ')
      : parts.join(', ')
    if (withUnit !== reps) {
      onRepsChange(withUnit)
    }
  }

  const startEditingReps = () => {
    setRepsValue(display)
    setEditingReps(true)
  }

  return (
    <div className="flex items-center gap-1 text-sm">
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

      {editingReps ? (
        <input
          type="text"
          value={repsValue}
          onChange={(e) => setRepsValue(e.target.value)}
          onBlur={handleRepsBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') {
              setEditingReps(false)
            }
          }}
          autoFocus
          placeholder={isCustom ? 'e.g. 10, 8, 6' : 'e.g. 8-10'}
          className="w-24 rounded bg-zinc-700 border border-emerald-500 px-1.5 py-0.5 text-center text-zinc-200 text-sm focus:outline-none"
        />
      ) : (
        <button
          onClick={startEditingReps}
          className={cn(
            'rounded px-1.5 py-0.5 font-medium text-zinc-300',
            'hover:bg-zinc-700 hover:text-emerald-400 transition-colors cursor-pointer',
            isCustom && 'text-teal-400'
          )}
          title={isCustom ? 'Custom reps per set — click to edit' : 'Edit reps'}
        >
          {display}
        </button>
      )}

      <button
        onClick={handleToggleUnit}
        className={cn(
          'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border transition-colors',
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
