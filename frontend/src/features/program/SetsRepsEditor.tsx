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
  readOnly?: boolean
}

export function SetsRepsEditor({
  sets,
  repsDisplay,
  unit,
  hasError = false,
  onSetsChange,
  onRepsChange,
  onUnitChange,
  readOnly = false,
}: SetsRepsEditorProps) {
  const [editingSets, setEditingSets] = useState(false)
  const [editingReps, setEditingReps] = useState(false)
  const [setsValue, setSetsValue] = useState(String(sets))
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

    if (e.metaKey || e.ctrlKey) return

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

  if (readOnly) {
    return (
      <div className="flex items-center gap-1 text-sm">
        <span className="px-1.5 py-0.5 font-medium" style={{ color: 'var(--text-muted)' }}>{sets}</span>
        <span style={{ color: 'var(--text-muted)' }}>x</span>
        <span
          className="px-1.5 py-0.5 font-medium"
          style={{ color: isCustom ? '#0d9488' : 'var(--text-muted)' }}
        >
          {repsDisplay}
        </span>
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border"
          style={isSeconds
            ? { borderColor: 'var(--blue-border)', color: 'var(--blue)', background: 'var(--blue-bg)' }
            : { borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg3)' }
          }
        >
          {isSeconds ? 'sec' : 'reps'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      {/* Sets */}
      {editingSets ? (
        <input
          type="text"
          inputMode="numeric"
          value={setsValue}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9]/g, '')
            setSetsValue(v)
          }}
          onFocus={(e) => e.target.select()}
          onBlur={() => {
            setEditingSets(false)
            const n = Number(setsValue)
            if (!isNaN(n) && n >= 1 && n <= 8 && n !== sets) {
              onSetsChange(n)
            } else {
              setSetsValue(String(sets))
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') {
              setSetsValue(String(sets))
              setEditingSets(false)
            }
          }}
          autoFocus
          className="w-10 rounded border px-1.5 py-0.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/40 bg-white"
          style={{ borderColor: 'var(--color-gold)', color: 'var(--text)' }}
        />
      ) : (
        <button
          onClick={() => { setSetsValue(String(sets)); setEditingSets(true) }}
          className="rounded px-1.5 py-0.5 font-medium transition-colors cursor-pointer hover:bg-[var(--bg3)]"
          style={{ color: 'var(--text)' }}
          title="Edit sets"
        >
          {sets}
        </button>
      )}

      <span style={{ color: 'var(--text-muted)' }}>x</span>

      {/* Reps / seconds value */}
      {editingReps ? (
        <input
          type="text"
          inputMode={isSeconds ? 'numeric' : 'text'}
          value={repsValue}
          onChange={(e) => setRepsValue(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={handleRepsBlur}
          onKeyDown={handleRepsKeyDown}
          autoFocus
          placeholder={isSeconds ? 'e.g. 30' : isCustom ? 'e.g. 10, 8, 6' : 'e.g. 8-10'}
          className="w-24 rounded border px-1.5 py-0.5 text-center text-sm focus:outline-none bg-white"
          style={{
            borderColor: inputError ? 'var(--red)' : 'var(--color-gold)',
            color: 'var(--text)',
          }}
        />
      ) : (
        <button
          onClick={startEditingReps}
          className="rounded px-1.5 py-0.5 font-medium transition-colors cursor-pointer"
          style={hasError
            ? { border: '1px solid var(--red-border)', background: 'var(--red-bg)', color: 'var(--red)' }
            : { color: isCustom ? '#0d9488' : 'var(--text)' }
          }
          onMouseOver={e => { if (!hasError) e.currentTarget.style.background = 'var(--bg3)' }}
          onMouseOut={e => { if (!hasError) e.currentTarget.style.background = '' }}
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
          hasError && 'ring-1'
        )}
        style={isSeconds
          ? { borderColor: 'var(--blue-border)', color: 'var(--blue)', background: 'var(--blue-bg)' }
          : { borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg3)' }
        }
        title={isSeconds ? 'Switch to reps' : 'Switch to seconds'}
      >
        {isSeconds ? 'sec' : 'reps'}
      </button>
    </div>
  )
}
