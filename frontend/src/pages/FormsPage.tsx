const FORM_LINKS = [
  {
    title: 'Your Personal Coaching Style',
    href: 'https://lockeroomgym.retool.com/embedded/public/4b3c989a-c19c-4cbb-aaa8-53e664474652',
    source: 'Retool',
  },
  {
    title: 'Perfect Session Feedback Form',
    href: 'https://lockeroomgym.retool.com/embedded/public/e648bfb5-1a82-4e53-b361-80a31b633aec/page1',
    source: 'Retool',
  },
  {
    title: 'RM Intensive Form',
    href: 'https://lockeroomgym.retool.com/embedded/public/24ed10d2-390d-4f28-b667-cf335858ac93/page1',
    source: 'Retool',
  },
  {
    title: 'Personal Vision Form',
    href: 'https://lockeroomgym.retool.com/embedded/public/a737c2cb-0f54-4af0-85ca-112f26a1606a',
    source: 'Retool',
  },
  {
    title: '6 Month Review Form',
    href: 'https://form.jotform.com/242898166432062',
    source: 'Jotform',
  },
] as const

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

export function FormsPage() {
  return (
    <div className="flex flex-col gap-5 px-6 py-6" style={{ background: 'var(--bg)', minHeight: '100%' }}>
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
          Forms
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          Coach and team forms. Each link opens in a new browser tab.
        </p>
      </div>

      <ul className="flex flex-col gap-3 max-w-2xl">
        {FORM_LINKS.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-4 rounded-xl border bg-white px-4 py-3.5 transition-colors hover:border-[var(--color-gold)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] focus-visible:ring-offset-2"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {item.source}
                </p>
              </div>
              <span
                className="flex-shrink-0 rounded-lg p-2 transition-colors group-hover:bg-[var(--color-gold-50)]"
                style={{ color: 'var(--color-gold)' }}
                aria-hidden
              >
                <ExternalLinkIcon />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
