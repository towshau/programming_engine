import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useEditorStore } from '../../stores/editorStore'
import type { ProgrammingNote } from '../../types'
import {
  programmingNotePriority,
  sortProgrammingNotesForQueue,
} from '../../lib/programmingNotes'
import { cn } from '../../lib/utils'

const NOTES_PAGE_SIZE = 20

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
  const [notesPage, setNotesPage] = useState(1)

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
      setNotes(sortProgrammingNotesForQueue(rows))
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    void loadNotes()
  }, [loadNotes])

  useEffect(() => {
    setNotesPage(1)
  }, [memberId])

  const unactionedCount = useMemo(() => notes.filter((n) => !n.implemented).length, [notes])

  const notesPagination = useMemo(() => {
    const total = notes.length
    const totalPages = Math.max(1, Math.ceil(total / NOTES_PAGE_SIZE))
    const safePage = Math.min(notesPage, totalPages)
    const start = (safePage - 1) * NOTES_PAGE_SIZE
    const slice = notes.slice(start, start + NOTES_PAGE_SIZE)
    return { total, totalPages, safePage, slice, start }
  }, [notes, notesPage])

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
        <div
          className="border-t px-3 py-3 space-y-3"
          style={{ borderColor: 'var(--color-gold-100)', background: 'var(--bg2)' }}
        >
          {notesPagination.slice.map((n) => {
            const pri = programmingNotePriority(String(n.modification))
            return (
              <div
                key={n.id}
                className={cn(
                  'rounded-lg border p-3 space-y-2 transition-opacity',
                  n.implemented && 'opacity-50 grayscale-[0.35]',
                )}
                style={{
                  borderColor: 'var(--border)',
                  background: n.implemented ? 'var(--bg3)' : undefined,
                }}
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
                      style={priorityPillStyle(pri)}
                    >
                      {pri === 1 ? 'Urgent' : 'Medium'}
                    </span>
                  </div>
                  <span className="text-[10px] text-right max-w-[55%]" style={{ color: 'var(--text-muted)' }}>
                    {n.staff_name?.trim()
                      ? `Submitted by ${n.staff_name.trim()} on ${formatDateAU(n.submission_date)}`
                      : `Submitted on ${formatDateAU(n.submission_date)}`}
                  </span>
                </div>
                {n.details && (
                  <p className="text-sm" style={{ color: n.implemented ? 'var(--text-muted)' : 'var(--text)' }}>
                    {n.details}
                  </p>
                )}
                {!n.implemented && (
                  <label
                    className="flex items-center gap-2 cursor-pointer text-xs font-medium"
                    style={{ color: 'var(--text)' }}
                  >
                    <input
                      type="checkbox"
                      className="rounded border-[var(--border)]"
                      onChange={() => void markImplemented(n.id)}
                    />
                    Mark as implemented
                  </label>
                )}
                {n.implemented && (
                  <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    Implemented — kept for history
                  </p>
                )}
              </div>
            )
          })}

          {notesPagination.totalPages > 1 && (
            <div
              className="flex items-center justify-between gap-2 pt-1 text-[11px]"
              style={{ color: 'var(--text-muted)' }}
            >
              <span>
                {notesPagination.start + 1}–
                {Math.min(notesPagination.start + NOTES_PAGE_SIZE, notesPagination.total)} of {notesPagination.total}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={notesPagination.safePage <= 1}
                  onClick={() => setNotesPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-1 rounded border text-[11px] font-medium disabled:opacity-40"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  Prev
                </button>
                <span className="tabular-nums" style={{ color: 'var(--text)' }}>
                  {notesPagination.safePage}/{notesPagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={notesPagination.safePage >= notesPagination.totalPages}
                  onClick={() => setNotesPage((p) => Math.min(notesPagination.totalPages, p + 1))}
                  className="px-2 py-1 rounded border text-[11px] font-medium disabled:opacity-40"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
