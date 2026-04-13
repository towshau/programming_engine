type FormLink = {
  title: string
  href: string
  source: string
}

type FormSubgroup = {
  id: string
  title: string
  items: readonly FormLink[]
}

type FormGroup = {
  id: string
  title: string
  description?: string
  items?: readonly FormLink[]
  subgroups?: readonly FormSubgroup[]
}

const FORM_GROUPS: readonly FormGroup[] = [
  {
    id: 'client-journey',
    title: 'Client Journey',
    description: 'Calls and journey touchpoints.',
    subgroups: [
      {
        id: 'journey-coaches',
        title: 'Coaches',
        items: [
          {
            title: 'Nutrition Onboarding Form',
            href: '/client-journey',
            source: 'Client Journey',
          },
        ],
      },
      {
        id: 'journey-advanced-coaches',
        title: 'Advanced Coaches',
        items: [
          {
            title: '12 week, 3 month and 9 Month Call Link (same for all 3)',
            href: 'https://lockeroomgym.retool.com/embedded/public/b4982ee9-0b0c-43d4-a816-7bd0b3c5e9ab',
            source: 'Retool',
          },
        ],
      },
      {
        id: 'journey-gym-managers',
        title: 'Gym Managers',
        items: [
          {
            title: '30 Day Review Call',
            href: 'https://lockeroomgym.retool.com/embedded/public/eba449a8-d38b-4121-b2e6-8d4675f2a872',
            source: 'Retool',
          },
        ],
      },
      {
        id: 'journey-renewal-lead',
        title: 'Renewal Lead',
        items: [
          {
            title: 'Pre Renewal Call',
            href: 'https://lockeroomgym.retool.com/embedded/public/6540a4a2-0514-45d7-b019-826cbca4ecf1',
            source: 'Retool',
          },
        ],
      },
    ],
  },
  {
    id: 'hr',
    title: 'Human Resources Forms',
    description: 'People and review processes.',
    items: [
      {
        title: 'Your Personal Coaching Style',
        href: 'https://lockeroomgym.retool.com/embedded/public/4b3c989a-c19c-4cbb-aaa8-53e664474652',
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
    ],
  },
  {
    id: 'coach-dev',
    title: 'Coach Development',
    description: 'Feedback, style, and growth forms.',
    items: [
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
    ],
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
    <div className="flex flex-col gap-8 px-6 py-6" style={{ background: 'var(--bg)', minHeight: '100%' }}>
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
          Forms
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          Grouped by area. Each link opens in a new tab.
        </p>
      </div>

      <div className="flex max-w-2xl flex-col gap-8">
        {FORM_GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={`forms-group-${group.id}`}>
            <h2
              id={`forms-group-${group.id}`}
              className="text-base font-bold tracking-tight"
              style={{ color: 'var(--text)' }}
            >
              {group.title}
            </h2>
            {group.description ? (
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                {group.description}
              </p>
            ) : null}

            <div
              className="mt-3 flex flex-col gap-3 border-l-2 pl-4"
              style={{ borderColor: 'var(--border)' }}
            >
              {group.subgroups?.map((subgroup) => (
                <div key={subgroup.id}>
                  <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    {subgroup.title}
                  </h3>
                  <ul className="mt-2 flex flex-col gap-2 border-l pl-3" style={{ borderColor: 'var(--border)' }}>
                    {subgroup.items.map((item) => (
                      <li key={item.href}>
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center justify-between gap-4 rounded-lg border bg-white px-3 py-3 transition-colors hover:border-[var(--color-gold)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] focus-visible:ring-offset-2"
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
              ))}

              {group.items ? (
                <ul className="flex flex-col gap-2">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center justify-between gap-4 rounded-lg border bg-white px-3 py-3 transition-colors hover:border-[var(--color-gold)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] focus-visible:ring-offset-2"
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
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
