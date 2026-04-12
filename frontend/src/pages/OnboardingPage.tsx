export function OnboardingPage() {
  return (
    <div className="px-6 py-6" style={{ background: 'var(--bg)', minHeight: '100%' }}>
      <div className="rounded-xl border p-5 bg-white" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
          Onboarding
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Onboarding page scaffold is ready.
        </p>
      </div>
    </div>
  )
}
