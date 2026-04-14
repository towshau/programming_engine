import { getBenchmarkRag } from '../../lib/scoring'

export function RagBadge({
  rag,
  label,
}: {
  rag: 'green' | 'amber' | 'red' | null
  label: string
}) {
  if (!rag)
    return (
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        —
      </span>
    )

  const styles = {
    green: {
      background: 'var(--green-bg)',
      color: 'var(--green)',
      border: '1px solid var(--green-border)',
      icon: '\u2713',
    },
    amber: {
      background: 'var(--orange-bg)',
      color: 'var(--orange)',
      border: '1px solid var(--orange-border)',
      icon: '\u26A0',
    },
    red: {
      background: 'var(--red-bg)',
      color: 'var(--red)',
      border: '1px solid var(--red-border)',
      icon: '\u{1F534}',
    },
  }

  const s = styles[rag]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold"
      style={{ background: s.background, color: s.color, border: s.border }}
    >
      {s.icon} {label}
    </span>
  )
}

export function BenchmarkCard({
  label,
  value,
  unit,
  field,
  sub,
}: {
  label: string
  value: number | null
  unit: string
  field: string
  sub?: string
}) {
  const rag = getBenchmarkRag(field, value)
  const ragLabel =
    rag === 'green'
      ? 'Good'
      : rag === 'amber'
        ? 'Below average'
        : rag === 'red'
          ? 'Needs work'
          : null

  return (
    <div
      className="bg-white rounded-xl border p-4"
      style={{ borderColor: 'var(--border)' }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-wide mb-2"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </p>
      <p className="text-2xl font-black mb-2" style={{ color: 'var(--text)' }}>
        {value != null ? `${value}` : '—'}
        {value != null && (
          <span
            className="text-sm font-normal ml-1"
            style={{ color: 'var(--text-muted)' }}
          >
            {unit}
          </span>
        )}
      </p>
      {ragLabel && <RagBadge rag={rag} label={ragLabel} />}
      {sub && (
        <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

export function FormField({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="mb-3">
      <p
        className="text-[10px] font-semibold uppercase tracking-wide mb-1"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </p>
      <div
        className="px-3 py-2 rounded-lg border text-sm"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--bg3)',
          color: value ? 'var(--text)' : 'var(--text-muted)',
        }}
      >
        {value || '—'}
      </div>
    </div>
  )
}
