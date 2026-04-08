import { useState, useRef, useEffect } from 'react'

interface Props {
  content: string
  label: string
  expandAll?: boolean
  onSave: (content: string) => void
}

export function NoteCell({ content, label, expandAll = false, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(content)
  const [hovered, setHovered] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setDraft(content)
  }, [content])

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.max(120, el.scrollHeight) + 'px'
  }

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      )
      autoResize(textareaRef.current)
    }
  }, [editing])

  function handleSave() {
    setEditing(false)
    if (draft.trim() !== content.trim()) {
      onSave(draft.trim())
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setDraft(content)
      setEditing(false)
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave()
    }
  }

  if (editing) {
    return (
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            autoResize(e.target)
          }}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full min-h-[120px] rounded-lg border border-blue-300 bg-white p-3 text-sm leading-relaxed text-gray-800 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
          placeholder={`Enter ${label.toLowerCase()}...`}
        />
        <div className="mt-1 text-[10px] text-gray-400">Ctrl+Enter to save / Esc to cancel</div>
      </div>
    )
  }

  const isEmpty = !content.trim()

  if (expandAll) {
    return (
      <div
        className="min-h-[80px] cursor-pointer rounded-lg p-2 text-sm leading-relaxed text-gray-700 hover:bg-gray-50"
        onClick={() => setEditing(true)}
      >
        {isEmpty ? (
          <span className="text-gray-400 italic">Click to add {label.toLowerCase()}</span>
        ) : (
          <p className="whitespace-pre-wrap">{content}</p>
        )}
      </div>
    )
  }

  return (
    <div
      className="relative cursor-pointer"
      onClick={() => setEditing(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="truncate rounded px-1 py-0.5 text-sm text-gray-600 hover:bg-gray-50">
        {isEmpty ? (
          <span className="text-gray-400 italic">Click to add {label.toLowerCase()}</span>
        ) : (
          content.length > 40 ? content.slice(0, 40) + '...' : content
        )}
      </div>

      {hovered && !isEmpty && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-xl">
          <div className="mb-1 text-xs font-semibold text-gray-500">{label}</div>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{content}</p>
        </div>
      )}
    </div>
  )
}
