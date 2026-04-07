import { cn } from '../../lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'emerald' | 'blue' | 'amber' | 'red' | 'teal' | 'green' | 'gold' | 'gray'
  className?: string
}

const variantStyles: Record<NonNullable<BadgeProps['variant']>, React.CSSProperties> = {
  default: { background: 'var(--bg3)', color: 'var(--text-muted)', border: '1px solid var(--border)' },
  gray: { background: 'var(--bg3)', color: 'var(--text-muted)', border: '1px solid var(--border)' },
  gold: { background: 'var(--color-gold-50)', color: 'var(--color-gold)', border: '1px solid var(--color-gold-100)' },
  emerald: { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' },
  green: { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' },
  blue: { background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid var(--blue-border)' },
  amber: { background: 'var(--orange-bg)', color: 'var(--orange)', border: '1px solid var(--orange-border)' },
  red: { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)' },
  teal: { background: '#ccfbf1', color: '#0d9488', border: '1px solid #99f6e4' },
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', className)}
      style={variantStyles[variant]}
    >
      {children}
    </span>
  )
}
