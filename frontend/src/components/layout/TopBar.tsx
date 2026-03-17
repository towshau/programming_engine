import { useEffect } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { formatDate } from '../../lib/utils'

export function TopBar() {
  const { coaches, selectedCoach, selectCoach, fetchCoaches, loading } =
    useEditorStore()

  useEffect(() => {
    fetchCoaches()
  }, [fetchCoaches])

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800">
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600 text-white font-bold text-sm">
          LR
        </div>
        <h1 className="text-lg font-semibold text-zinc-100">Program Editor</h1>
      </div>

      <div className="flex items-center gap-4">
        <select
          value={selectedCoach?.id ?? ''}
          onChange={(e) => {
            const coach = coaches.find((c) => c.id === e.target.value) ?? null
            selectCoach(coach)
          }}
          disabled={loading.coaches}
          className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[200px]"
        >
          <option value="">
            {loading.coaches ? 'Loading coaches...' : 'Select coach'}
          </option>
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.first_name} {c.last_name}
            </option>
          ))}
        </select>

        <span className="text-sm text-zinc-500">{formatDate()}</span>
      </div>
    </header>
  )
}
