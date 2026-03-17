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
    if (!debouncedQuery) return exerciseLibrary.slice(0, 50)
    const q = debouncedQuery.toLowerCase()
    return exerciseLibrary
      .filter(
        (ex) =>
          ex.exercise_name.toLowerCase().includes(q) ||
          (ex.tags && ex.tags.toLowerCase().includes(q))
      )
      .slice(0, 50)
  }, [exerciseLibrary, debouncedQuery])

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/60"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col max-h-[70vh]">
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-200">Swap Exercise</h3>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            Current: <span className="text-zinc-300">{currentExerciseName}</span>
          </p>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or tag..."
            className="w-full rounded-lg bg-zinc-800 border border-zinc-700 py-2 px-3 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">
              No exercises found
            </p>
          ) : (
            filtered.map((ex) => (
              <button
                key={ex.exercise_id}
                onClick={() => onSelect(ex)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors',
                  'hover:bg-zinc-800/70 border-b border-zinc-800/50'
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-200 truncate">
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
                  className="ml-2 h-4 w-4 text-zinc-600 flex-shrink-0"
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
