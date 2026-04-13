import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.73 1.22 9.24 3.63l6.9-6.9C35.95 2.47 30.42 0 24 0 14.62 0 6.51 5.38 2.56 13.22l8.04 6.24C12.57 13.41 17.88 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.14-3.09-.4-4.55H24v9.02h12.94c-.56 3-2.25 5.55-4.8 7.25l7.36 5.7c4.3-3.97 6.78-9.82 6.78-17.42z"
    />
    <path
      fill="#FBBC05"
      d="M10.6 28.54A14.5 14.5 0 0 1 9.5 24c0-1.57.28-3.09.78-4.54l-8.04-6.24A24 24 0 0 0 0 24c0 3.87.92 7.53 2.56 10.78l8.04-6.24z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.92-2.13 15.9-5.8l-7.36-5.7c-2.05 1.38-4.68 2.2-8.54 2.2-6.12 0-11.43-3.91-13.4-9.46l-8.04 6.24C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
)

const Spinner = ({ className }: { className?: string }) => (
  <div
    className={className}
    style={{
      width: 15,
      height: 15,
      border: '2px solid rgba(255,255,255,0.35)',
      borderTopColor: '#ffffff',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }}
  />
)

export function LoginPage() {
  const { session, loading: authLoading, bypassAuth, signIn, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  if (authLoading) {
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
            CHECKING SESSION
          </div>
        </div>
      </div>
    )
  }

  if (bypassAuth || session) return <Navigate to="/" replace />

  const busy = submitting || googleLoading

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = email.trim()
    if (!trimmed || !password) {
      setError('Please enter your email and password.')
      return
    }
    setSubmitting(true)
    const errMsg = await signIn(trimmed, password)
    setSubmitting(false)
    if (errMsg) setError(errMsg)
  }

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    const errMsg = await signInWithGoogle()
    if (errMsg) {
      setGoogleLoading(false)
      setError(errMsg)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ width: '100%', maxWidth: 460, padding: 24 }}>
        <div
          style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '44px 40px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.02)',
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div
              style={{
                width: 48,
                height: 48,
                background: 'var(--color-gold)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 18px',
                color: '#fff',
                fontWeight: 900,
                fontSize: 16,
                letterSpacing: '0.02em',
              }}
            >
              LR
            </div>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--text)',
                letterSpacing: '0.02em',
                marginBottom: 6,
              }}
            >
              Coach OS
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Sign in to access the staff portal
            </p>
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '12px 20px',
              color: 'var(--text)',
              fontSize: 14,
              fontWeight: 500,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.5 : 1,
              marginBottom: 24,
              fontFamily: 'inherit',
            }}
          >
            {googleLoading ? (
              <>
                <Spinner />
                Redirecting to Google…
              </>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>

          {/* Divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 24,
            }}
          >
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
                fontWeight: 500,
              }}
            >
              OR
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: 18 }}>
              <label
                htmlFor="login-email"
                style={{
                  display: 'block',
                  fontSize: 13,
                  color: 'var(--text)',
                  fontWeight: 500,
                  marginBottom: 6,
                }}
              >
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={busy}
                required
                style={{
                  width: '100%',
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: 'var(--text)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  outline: 'none',
                  opacity: busy ? 0.5 : 1,
                }}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label
                htmlFor="login-password"
                style={{
                  display: 'block',
                  fontSize: 13,
                  color: 'var(--text)',
                  fontWeight: 500,
                  marginBottom: 6,
                }}
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={busy}
                required
                style={{
                  width: '100%',
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: 'var(--text)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  outline: 'none',
                  opacity: busy ? 0.5 : 1,
                }}
              />
            </div>

            {error && (
              <div
                role="alert"
                style={{
                  background: 'var(--red-bg)',
                  border: '1px solid var(--red-border)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  marginBottom: 18,
                  fontSize: 13,
                  color: 'var(--red)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  lineHeight: 1.5,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0, marginTop: 2 }}
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                width: '100%',
                background: 'var(--color-gold)',
                border: 'none',
                borderRadius: 10,
                padding: '12px 20px',
                color: '#ffffff',
                fontSize: 14,
                fontFamily: 'inherit',
                fontWeight: 600,
                cursor: busy ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 6,
                opacity: busy ? 0.5 : 1,
              }}
            >
              {submitting ? (
                <>
                  <Spinner />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer */}
          <div
            style={{
              textAlign: 'center',
              marginTop: 28,
              paddingTop: 20,
              borderTop: '1px solid var(--border)',
              fontSize: 11,
              color: '#9ca3af',
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
              fontWeight: 500,
            }}
          >
            LOCKER ROOM GYM — STAFF PORTAL
          </div>
        </div>
      </div>
    </div>
  )
}
