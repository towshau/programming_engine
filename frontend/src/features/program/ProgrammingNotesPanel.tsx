import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useEditorStore } from '../../stores/editorStore'
import type { ProgrammingNote } from '../../types'
import { cn } from '../../lib/utils'

function modificationBadgeStyle(mod: string): CSSProperties {
  if (mod === 'Injury / Pain') {
    return { background: 'var(--orange-bg)', color: 'var(--orange)', border: '1px solid var(--orange-border)' }
  }
  if (mod === 'Physio Advice') {
    return { background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid var(--blue-border)' }
  }
  return { background: 'var(--bg3)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
}

function formatDateAU(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** 1 = urgent (Injury / Pain), 2 = medium (everything else). */
function notePriority(modification: string): number {
  return modification === 'Injury / Pain' ? 1 : 2
}

function priorityPillStyle(priority: number): CSSProperties {
  if (priority === 1) {
    return { background: 'var(--red-bg, #fef2f2)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.25)' }
  }
  return { background: 'var(--bg3)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
}

export function ProgrammingNotesPanel({ memberId }: { memberId: string }) {
  const { selectedCoach, fetchMembers } = useEditorStore()
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes] = useState<ProgrammingNote[]>([])
  const [loading, setLoading] = useState(true)

  const loadNotes = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('member_programming_notes')
        .select('id, member_id, modification, details, submission_date, staff_name, implemented')
        .eq('member_id', memberId)
        .order('submission_date', { ascending: false })

      if (error) {
        console.error('ProgrammingNotesPanel:', error)
        setNotes([])
        return
      }
      const rows = (data ?? []) as ProgrammingNote[]
      const sorted = [...rows].sort((a, b) => {
        if (a.implemented !== b.implemented) return a.implemented ? 1 : -1
        const pa = notePriority(String(a.modification))
        const pb = notePriority(String(b.modification))
        if (pa !== pb) return pa - pb
        return new Date(b.submission_date).getTime() - new Date(a.submission_date).getTime()
      })
      setNotes(sorted)
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    void loadNotes()
  }, [loadNotes])

  const unactionedCount = useMemo(() => notes.filter((n) => !n.implemented).length, [notes])

  const markImplemented = async (noteId: string) => {
    const { error } = await supabase
      .from('member_programming_notes')
      .update({ implemented: true })
      .eq('id', noteId)

    if (error) {
      console.error('markImplemented:', error)
      return
    }
    await loadNotes()
    void fetchMembers(selectedCoach?.id ?? null)
  }

  if (loading && notes.length === 0) {
    return (
      <div
        className="rounded-lg border px-3 py-2 text-xs"
        style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}
      >
        <span style={{ color: 'var(--text-muted)' }}>Loading programming notes…</span>
      </div>
    )
  }

  if (notes.length === 0) {
    return null
  }

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: 'var(--color-gold-100)', background: 'var(--color-gold-50)' }}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:opacity-90"
        style={{ color: '#92680a' }}
      >
        <span className="text-xs font-semibold">
          {notes.length} programming note{notes.length !== 1 ? 's' : ''}
          {unactionedCount > 0 && (
            <span className="font-normal" style={{ color: 'var(--text-muted)' }}>
              {' '}
              ({unactionedCount} unactioned)
            </span>
          )}
        </span>
        <svg
          className={cn('h-4 w-4 flex-shrink-0 transition-transform', expanded && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t px-3 py-3 space-y-3" style={{ borderColor: 'var(--color-gold-100)', background: 'var(--bg2)' }}>
          {notes.map((n) => (
            <div
              key={n.id}
              className={cn(
                'rounded-lg border p-3 space-y-2',
                n.implemented && 'opacity-60',
              )}
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span
                    className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                    style={modificationBadgeStyle(String(n.modification))}
                  >
                    {n.modification}
                  </span>
                  <span
                    className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full shrink-0"
                    style={priorityPillStyle(notePriority(String(n.modification)))}
                  >
                    {notePriority(String(n.modification)) === 1 ? 'Urgent' : 'Medium'}
                  </span>
                </div>
                <span className="text-[10px] text-right max-w-[55%]" style={{ color: 'var(--text-muted)' }}>
                  {n.staff_name?.trim()
                    ? `Submitted by ${n.staff_name.trim()} on ${formatDateAU(n.submission_date)}`
                    : `Submitted on ${formatDateAU(n.submission_date)}`}
                </span>
              </div>
              {n.details && (
                <p
                  className={cn('text-sm', n.implemented && 'line-through')}
                  style={{ color: 'var(--text)' }}
                >
                  {n.details}
                </p>
              )}
              {!n.implemented && (
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium" style={{ color: 'var(--text)' }}>
                  <input
                    type="checkbox"
                    className="rounded border-[var(--border)]"
                    onChange={() => void markImplemented(n.id)}
                  />
                  Mark as implemented
                </label>
              )}
              {n.implemented && (
                <p className="text-[10px] font-medium" style={{ color: 'var(--green)' }}>
                  Implemented
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
