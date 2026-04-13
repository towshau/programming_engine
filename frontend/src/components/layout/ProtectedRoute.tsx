import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

export function ProtectedRoute() {
  const { session, loading, bypassAuth } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
        }}
      >
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 24,
              height: 24,
              border: '2px solid var(--border)',
              borderTopColor: 'var(--color-gold)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 14px',
            }}
          />
          <div
            style={{
              color: 'var(--text-muted)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              fontWeight: 500,
            }}
          >
            LOADING
          </div>
        </div>
      </div>
    )
  }

  if (bypassAuth) return <Outlet />

  if (!session) return <Navigate to="/login" replace />

  return <Outlet />
}
