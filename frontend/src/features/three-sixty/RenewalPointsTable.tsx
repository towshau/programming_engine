import { useMemo, useState } from 'react'
import type { RenewalMetaRow } from './types'
import { columnKeysForRows, formatCell, SORT_MARK_ASC, SORT_MARK_DESC } from './formatCell'

type SortDir = 'asc' | 'desc'

const EXCLUDE = new Set<string>(['coach_staff'])

interface RenewalPointsTableProps {
  rows: RenewalMetaRow[]
}

export function RenewalPointsTable({ rows }: RenewalPointsTableProps) {
  const [sortCol, setSortCol] = useState<string>('date_created')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const columns = useMemo(
    () => columnKeysForRows(rows, ['date_created', 'coach_name', 'coach_id', 'id'], EXCLUDE),
    [rows],
  )

  const sorted = useMemo(() => {
    const list = [...rows]
    const col = sortCol
    list.sort((a, b) => {
      const av = a[col]
      const bv = b[col]
      if (av == null && bv == null) return 0
      if (av == null) return sortDir === 'asc' ? 1 : -1
      if (bv == null) return sortDir === 'asc' ? -1 : 1
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      const as = String(av).toLowerCase()
      const bs = String(bv).toLowerCase()
      const c = as.localeCompare(bs)
      return sortDir === 'asc' ? c : -c
    })
    return list
  }, [rows, sortCol, sortDir])

  function toggleSort(col: string) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'date_created' ? 'desc' : 'asc')
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>
        No renewal points for this coach filter.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
            {columns.map((col) => (
              <th key={col} className="text-left py-2 px-2 font-semibold whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleSort(col)}
                  className="inline-flex items-center gap-1 hover:underline"
                  style={{ color: 'var(--text)' }}
                >
                  {col.replace(/_/g, ' ')}
                  {sortCol === col ? (sortDir === 'asc' ? SORT_MARK_ASC : SORT_MARK_DESC) : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={(row.id as string | undefined) ?? `rm-${i}`}
              className="border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              {columns.map((col) => (
                <td key={col} className="py-2 px-2 align-top whitespace-nowrap max-w-[280px] truncate" title={formatCell(row[col])}>
                  {formatCell(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
