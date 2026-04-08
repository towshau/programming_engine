const GYMS = ['BLIGH', 'BRIDGE', 'COLLINS']

interface Props {
  value: string | null
  onChange: (gym: string | null) => void
}

export function GymFilter({ value, onChange }: Props) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
    >
      <option value="">All gyms</option>
      {GYMS.map((g) => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
    </select>
  )
}
