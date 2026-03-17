import { useState } from 'react'
import { cn } from '../../lib/utils'

interface SetsRepsEditorProps {
  sets: number
  reps: string
  onSetsChange: (newSets: number) => void
  onRepsChange: (newReps: string) => void
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
  const [repsValue, setRepsValue] = useState(reps)

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
          onBlur={() => {
            setEditingReps(false)
            if (repsValue !== reps && repsValue.trim()) {
              onRepsChange(repsValue.trim())
            } else {
              setRepsValue(reps)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') {
              setRepsValue(reps)
              setEditingReps(false)
            }
          }}
          autoFocus
          className="w-16 rounded bg-zinc-700 border border-emerald-500 px-1.5 py-0.5 text-center text-zinc-200 text-sm focus:outline-none"
        />
      ) : (
        <button
          onClick={() => setEditingReps(true)}
          className={cn(
            'rounded px-1.5 py-0.5 font-medium text-zinc-300',
            'hover:bg-zinc-700 hover:text-emerald-400 transition-colors cursor-pointer'
          )}
          title="Edit reps"
        >
          {reps}
        </button>
      )}
    </div>
  )
}
