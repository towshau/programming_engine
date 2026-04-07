export function HolidayPrograms() {
  return (
    <div className="p-7">
      <div
        className="bg-white rounded-xl border p-12 text-center"
        style={{ borderColor: 'var(--border)' }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl"
          style={{ background: 'var(--bg3)' }}
        >
          ✈️
        </div>
        <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>
          Holiday Programs
        </h2>
        <p className="text-sm max-w-sm mx-auto mb-6" style={{ color: 'var(--text-muted)' }}>
          Travel programs, hotel-friendly sessions, and solo safety protocols. This feature is coming soon.
        </p>
        <span
          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold"
          style={{ background: 'var(--bg3)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          Coming soon
        </span>
      </div>
    </div>
  )
}
