import { useState, useMemo, useRef, useEffect } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { useDebounce } from '../../hooks/useDebounce'
import { cn } from '../../lib/utils'
import { Badge } from '../../components/ui/Badge'
import type { ExerciseLibraryItem } from '../../types'

interface ExerciseSwapModalProps {
  currentExerciseName: string
  onSelect: (exercise: ExerciseLibraryItem) => void
  onClose: () => void
}

export function ExerciseSwapModal({
  currentExerciseName,
  onSelect,
  onClose,
}: ExerciseSwapModalProps) {
  const { exerciseLibrary, fetchExerciseLibrary } = useEditorStore()
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 200)
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (exerciseLibrary.length === 0) fetchExerciseLibrary()
  }, [exerciseLibrary.length, fetchExerciseLibrary])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return exerciseLibrary.slice(0, 50)
    
    // Split the query by spaces to support multiple keywords (e.g. "split squat db")
    const keywords = debouncedQuery.toLowerCase().split(/\s+/).filter(Boolean)
    
    return exerciseLibrary
      .filter((ex) => {
        const nameMatchStr = ex.exercise_name.toLowerCase()
        const tagMatchStr = ex.tags ? ex.tags.toLowerCase() : ''
        
        // Every keyword must be found in either the name or the tags
        return keywords.every((kw) => 
          nameMatchStr.includes(kw) || tagMatchStr.includes(kw)
        )
      })
      .slice(0, 50)
  }, [exerciseLibrary, debouncedQuery])

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[70vh] bg-white"
        style={{ border: '1px solid var(--border)' }}
      >
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Swap Exercise</h3>
            <button
              onClick={onClose}
              className="opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            Current: <span style={{ color: 'var(--text)', fontWeight: 500 }}>{currentExerciseName}</span>
          </p>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or tag..."
            className="w-full rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/40"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
              No exercises found
            </p>
          ) : (
            filtered.map((ex) => (
              <button
                key={ex.exercise_id}
                onClick={() => onSelect(ex)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors border-b',
                )}
                style={{ borderColor: 'var(--border)' }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--bg3)'}
                onMouseOut={e => e.currentTarget.style.background = ''}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate" style={{ color: 'var(--text)' }}>
                    {ex.exercise_name}
                  </p>
                  {ex.tags && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {ex.tags.split(',').map((tag) => (
                        <Badge key={tag.trim()} variant="default">
                          {tag.trim()}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <svg
                  className="ml-2 h-4 w-4 flex-shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
