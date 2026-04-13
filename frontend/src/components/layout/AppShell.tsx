import { Outlet, useLocation, useNavigate, NavLink } from 'react-router-dom'
import { useEditorStore } from '../../stores/editorStore'
import { useAuth } from '../../lib/auth'
import { formatDate } from '../../lib/utils'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'

const NAV_ITEMS = [
  { label: 'Client Queue', href: '/', exact: true },
  { label: 'Intake & Assessment', href: '/intake', exact: false },
  { label: 'Programming Engine', href: '/program', exact: false },
  { label: 'Holiday Programs', href: '/holiday', exact: false },
  { label: 'Workbook', href: '/workbook', exact: false },
]

const PROFILE_MENU_ITEMS = [
  { label: 'Forms', href: '/forms' },
  { label: 'Onboarding', href: '/onboarding' },
  { label: 'Client Journey', href: '/client-journey' },
  { label: '360', href: '/360' },
  { label: 'Churn Risk', href: '/churn-risk' },
]

export function AppShell() {
  const { coaches, selectedCoach, selectCoach, fetchCoaches, fetchMembers, loading } = useEditorStore()
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    void fetchCoaches()
    void fetchMembers()
  }, [fetchCoaches, fetchMembers])

  useEffect(() => {
    setProfileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!profileMenuRef.current) return
      if (!profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

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
                Coach OS
              </div>
              <div className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Lockeroom
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
            </div>

            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((open) => !open)}
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
                aria-label="Open profile menu"
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white border transition-all hover:opacity-90 focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--color-gold)',
                  borderColor: 'var(--color-gold)',
                  boxShadow: profileMenuOpen ? '0 0 0 2px rgba(184, 134, 11, 0.25)' : 'none',
                }}
              >
                {(user?.user_metadata?.full_name as string | undefined)
                  ?.split(/\s+/)
                  .slice(0, 2)
                  .map((n) => n[0]?.toUpperCase())
                  .join('') || 'LR'}
              </button>

              {profileMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-48 rounded-xl border py-1.5 shadow-lg"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg2)', zIndex: 40 }}
                >
                  {PROFILE_MENU_ITEMS.map((item) => {
                    const active =
                      location.pathname === item.href ||
                      location.pathname.startsWith(item.href + '/')
                    return (
                      <button
                        key={item.href}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setProfileMenuOpen(false)
                          navigate(item.href)
                        }}
                        className="w-full px-3 py-2 text-left text-sm transition-colors"
                        style={{
                          color: active ? 'var(--color-gold)' : 'var(--text)',
                          background: active ? 'var(--color-gold-50)' : 'transparent',
                        }}
                      >
                        {item.label}
                      </button>
                    )
                  })}

                  <div
                    className="mx-2 my-1.5"
                    style={{ height: 1, background: 'var(--border)' }}
                  />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false)
                      void signOut()
                    }}
                    className="w-full px-3 py-2 text-left text-sm transition-colors"
                    style={{ color: 'var(--red)' }}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
