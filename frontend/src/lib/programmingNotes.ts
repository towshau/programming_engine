import type { ProgrammingNote } from '../types'

/** 1 = urgent (Injury / Pain), 2 = medium (everything else). */
export function programmingNotePriority(modification: string): number {
  const m = modification.trim()
  if (m === 'Injury / Pain') return 1
  return 2
}

export function programmingNotePriorityLabel(modification: string): 'Urgent' | 'Medium' {
  return programmingNotePriority(modification) === 1 ? 'Urgent' : 'Medium'
}

/** Unactioned first, then urgent before medium, then newest submission first. */
export function sortProgrammingNotesForQueue(notes: ProgrammingNote[]): ProgrammingNote[] {
  return [...notes].sort((a, b) => {
    if (a.implemented !== b.implemented) return a.implemented ? 1 : -1
    const pa = programmingNotePriority(String(a.modification))
    const pb = programmingNotePriority(String(b.modification))
    if (pa !== pb) return pa - pb
    return new Date(b.submission_date).getTime() - new Date(a.submission_date).getTime()
  })
}
