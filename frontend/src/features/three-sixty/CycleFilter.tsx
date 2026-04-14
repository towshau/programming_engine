import type { ThreeSixtyCycle } from './types'
import { cycleKey } from './cycleUtils'

interface CycleFilterProps {
  cycles: ThreeSixtyCycle[]
  value: ThreeSixtyCycle
  onChange: (cycle: ThreeSixtyCycle) => void
  disabled?: boolean
}

export function CycleFilter({ cycles, value, onChange, disabled }: CycleFilterProps) {
  const v = cycleKey(value)

  return (
    <label className="inline-flex items-center gap-2 text-sm font-medium">
      <span style={{ color: 'var(--text-muted)' }}>Renewal cycle</span>
      <select
        value={v}
        disabled={disabled}
        onChange={(e) => {
          const next = cycles.find((c) => cycleKey(c) === e.target.value)
          if (next) onChange(next)
        }}
        className="rounded-lg border px-3 py-1.5 text-sm min-w-[200px] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--bg2)',
          color: 'var(--text)',
        }}
      >
        {cycles.map((c) => (
          <option key={cycleKey(c)} value={cycleKey(c)}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  )
}
