import { useState } from 'react'
import { cn } from '../../lib/utils'

interface NotesInputProps {
  value: string
  onChange: (newNotes: string) => void
}

export function NotesInput({ value, onChange }: NotesInputProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (editing) {
    return (
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          if (draft !== value) onChange(draft)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        autoFocus
        placeholder="Add note..."
        className="w-full rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1 bg-white"
        style={{ borderColor: 'var(--color-gold)', color: 'var(--text)' }}
      />
    )
  }

  return (
    <button
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      className={cn(
        'text-xs rounded px-2 py-1 text-left truncate max-w-[200px] transition-colors',
        !value && 'italic'
      )}
      style={{ color: 'var(--text-muted)' }}
      onMouseOver={e => e.currentTarget.style.background = 'var(--bg3)'}
      onMouseOut={e => e.currentTarget.style.background = ''}
    >
      {value || 'Add note...'}
    </button>
  )
}
