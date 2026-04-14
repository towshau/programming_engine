import { useMemo, useState } from 'react'
import type { RenewalInCycleRow } from './types'
import { formatCell, SORT_MARK_ASC, SORT_MARK_DESC } from './formatCell'

type SortDir = 'asc' | 'desc'
type SortCol = keyof RenewalInCycleRow

const COLS: { key: SortCol; label: string }[] = [
  { key: 'member_name', label: 'Member' },
  { key: 'start_date', label: 'Start' },
  { key: 'end_date', label: 'End' },
  { key: 'status', label: 'Status' },
  { key: 'membership_stage', label: 'Membership stage' },
  { key: 'journey_stage', label: 'Journey stage' },
  { key: 'gym', label: 'Gym' },
  { key: 'pipeline_lost', label: 'Pipeline lost' },
  { key: 'primary_coach', label: 'Primary coach' },
  { key: 'handoff_coach', label: 'Handoff coach' },
]

interface RenewalsTableProps {
  rows: RenewalInCycleRow[]
}

export function RenewalsTable({ rows }: RenewalsTableProps) {
  const [sortCol, setSortCol] = useState<SortCol>('end_date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const sorted = useMemo(() => {
    const list = [...rows]
    list.sort((a, b) => {
      const av = a[sortCol]
      const bv = b[sortCol]
      if (av == null && bv == null) return 0
      if (av == null) return sortDir === 'asc' ? 1 : -1
      if (bv == null) return sortDir === 'asc' ? -1 : 1
      const as = String(av).toLowerCase()
      const bs = String(bv).toLowerCase()
      const c = as.localeCompare(bs)
      return sortDir === 'asc' ? c : -c
    })
    return list
  }, [rows, sortCol, sortDir])

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'end_date' ? 'asc' : 'asc')
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>
        No renewals in this cycle for this coach filter.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
            {COLS.map(({ key, label }) => (
              <th key={key} className="text-left py-2 px-2 font-semibold whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleSort(key)}
                  className="inline-flex items-center gap-1 hover:underline"
                  style={{ color: 'var(--text)' }}
                >
                  {label}
                  {sortCol === key ? (sortDir === 'asc' ? SORT_MARK_ASC : SORT_MARK_DESC) : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
              {COLS.map(({ key }) => (
                <td
                  key={key}
                  className="py-2 px-2 align-top whitespace-nowrap max-w-[220px] truncate"
                  title={formatCell(row[key])}
                >
                  {formatCell(row[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
