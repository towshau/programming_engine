interface Props {
  label: string
  expanded: boolean
  onToggle: () => void
}

export function CollapseToggle({ label, expanded, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50"
    >
      <svg
        className={`h-3.5 w-3.5 transition-transform ${expanded ? '' : '-rotate-90'}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
      {label}
    </button>
  )
}
