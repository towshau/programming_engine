/** Unicode arrows for sortable column headers (avoids mojibake in source). */
export const SORT_MARK_ASC = ' \u2191'
export const SORT_MARK_DESC = ' \u2193'

export function formatCell(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** Column keys for dynamic tables; `preferred` first, then rest sorted. */
export function columnKeysForRows(
  rows: Record<string, unknown>[],
  preferred: string[],
  exclude: Set<string>,
): string[] {
  const keys = new Set<string>()
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!exclude.has(k)) keys.add(k)
    }
  }
  const pref = preferred.filter((k) => keys.has(k))
  const rest = [...keys].filter((k) => !pref.includes(k)).sort((a, b) => a.localeCompare(b))
  return [...pref, ...rest]
}
