import type { MemberWithMemberships } from '../hooks/useWorkbookMembers'
import type { Note, NoteType } from '../types'

export type SortColumn =
  | 'name'
  | 'sessWk'
  | 'lastWk'
  | 'pctLastWk'
  | 'monthPct'
  | 'expiry'
  | 'checkin'

export type SortDirection = 'asc' | 'desc'

interface SessionStats {
  lastWeekActual: number
  monthActual: number
}

function tieBreak(a: MemberWithMemberships, b: MemberWithMemberships, cmp: number): number {
  if (cmp !== 0) return cmp
  return a.memberName.localeCompare(b.memberName, undefined, { sensitivity: 'base' })
}

export function compareMembers(
  a: MemberWithMemberships,
  b: MemberWithMemberships,
  column: SortColumn,
  statsMap: Map<string, SessionStats>,
  notesMap: Map<string, Map<NoteType, Note>>,
  monthFullWeeks: number
): number {
  const sa = statsMap.get(a.memberId)
  const sb = statsMap.get(b.memberId)
  const ca = a.contractedSessions || 0
  const cb = b.contractedSessions || 0
  const lastA = sa?.lastWeekActual ?? 0
  const lastB = sb?.lastWeekActual ?? 0
  const monthA = sa?.monthActual ?? 0
  const monthB = sb?.monthActual ?? 0

  let cmp = 0

  switch (column) {
    case 'name':
      cmp = a.firstNameSortKey.localeCompare(b.firstNameSortKey, undefined, {
        sensitivity: 'base',
      })
      break
    case 'sessWk':
      cmp = ca - cb
      break
    case 'lastWk':
      cmp = lastA - lastB
      break
    case 'pctLastWk': {
      const pa = ca > 0 ? (lastA / ca) * 100 : -1
      const pb = cb > 0 ? (lastB / cb) * 100 : -1
      cmp = pa - pb
      break
    }
    case 'monthPct': {
      const expectedA = ca > 0 && monthFullWeeks > 0 ? ca * monthFullWeeks : 0
      const expectedB = cb > 0 && monthFullWeeks > 0 ? cb * monthFullWeeks : 0
      const pctA = expectedA > 0 ? (monthA / expectedA) * 100 : -1
      const pctB = expectedB > 0 ? (monthB / expectedB) * 100 : -1
      cmp = pctA - pctB
      break
    }
    case 'expiry': {
      const ta = a.membershipExpiry
        ? new Date(a.membershipExpiry).getTime()
        : Number.POSITIVE_INFINITY
      const tb = b.membershipExpiry
        ? new Date(b.membershipExpiry).getTime()
        : Number.POSITIVE_INFINITY
      cmp = ta - tb
      break
    }
    case 'checkin': {
      const checkedA = notesMap.get(a.memberId)?.get('general notes')?.checkin_1 ? 1 : 0
      const checkedB = notesMap.get(b.memberId)?.get('general notes')?.checkin_1 ? 1 : 0
      cmp = checkedA - checkedB
      break
    }
    default:
      cmp = 0
  }

  return tieBreak(a, b, cmp)
}

export function sortMembersList(
  members: MemberWithMemberships[],
  column: SortColumn | null,
  direction: SortDirection,
  statsMap: Map<string, SessionStats>,
  notesMap: Map<string, Map<NoteType, Note>>,
  monthFullWeeks: number
): MemberWithMemberships[] {
  if (!column) {
    return [...members].sort((a, b) =>
      a.firstNameSortKey.localeCompare(b.firstNameSortKey, undefined, {
        sensitivity: 'base',
      })
    )
  }
  const mult = direction === 'asc' ? 1 : -1
  return [...members].sort(
    (a, b) => mult * compareMembers(a, b, column, statsMap, notesMap, monthFullWeeks)
  )
}
