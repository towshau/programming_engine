import { Outlet, useLocation, useNavigate, NavLink } from 'react-router-dom'
import { useEditorStore } from '../../stores/editorStore'
import { formatDate } from '../../lib/utils'
import { useEffect } from 'react'
import { cn } from '../../lib/utils'

const NAV_ITEMS = [
  { label: 'Client Queue', href: '/', exact: true },
  { label: 'Intake & Assessment', href: '/intake', exact: false },
  { label: 'Programming Engine', href: '/program', exact: false },
  { label: 'Holiday Programs', href: '/holiday', exact: false },
]

export function AppShell() {
  const { coaches, selectedCoach, selectCoach, fetchCoaches, fetchMembers, loading } = useEditorStore()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    void fetchCoaches()
    void fetchMembers()
  }, [fetchCoaches, fetchMembers])

  const isDetailPage =
    location.pathname.startsWith('/program/') ||
    location.pathname.startsWith('/intake/')

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* ── Top navigation bar ── */}
      <header
        className="flex-shrink-0 bg-white border-b z-20"
        style={{ borderColor: 'var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center gap-0 px-5 h-14">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mr-8 flex-shrink-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white tracking-tight"
              style={{ background: 'var(--color-gold)' }}
            >
              LR
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                Programming OS
              </div>
              <div className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Locker Room
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex items-stretch h-full gap-1 flex-1">
            {NAV_ITEMS.map((item) => {
              const isActive = item.exact
                ? location.pathname === item.href
                : location.pathname === item.href ||
                  location.pathname.startsWith(item.href + '/')
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center px-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    isActive
                      ? 'border-[var(--color-gold)] text-[var(--color-gold)]'
                      : 'border-transparent hover:text-[var(--text)] hover:border-[var(--border)]'
                  )}
                  style={{ color: isActive ? 'var(--color-gold)' : 'var(--text-muted)' }}
                >
                  {item.label}
                </NavLink>
              )
            })}
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {isDetailPage && (
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors hover:bg-[var(--bg3)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            )}

            <select
              value={selectedCoach?.id ?? ''}
              onChange={(e) => {
                const coach = coaches.find((c) => c.id === e.target.value) ?? null
                selectCoach(coach)
              }}
              disabled={loading.coaches}
              className="rounded-lg px-3 py-1.5 text-sm border focus:outline-none focus:ring-2 min-w-[160px]"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--bg3)',
                color: 'var(--text)',
              }}
            >
              <option value="">
                {loading.coaches ? 'Loading...' : 'All Coaches'}
              </option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </select>

            <div className="text-right">
              <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {formatDate()}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                Andrew Ponce
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
