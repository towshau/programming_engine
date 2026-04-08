import { cn } from '../../lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'xs' | 'sm' | 'md'
  isLoading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'sm',
  className,
  children,
  isLoading,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/40 disabled:opacity-50 disabled:cursor-not-allowed'

  const sizeClass = {
    xs: 'px-2.5 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
  }[size]

  const variantStyle: React.CSSProperties = (() => {
    switch (variant) {
      case 'primary':
        return { background: 'var(--color-gold)', color: 'white' }
      case 'secondary':
        return { background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)' }
      case 'ghost':
        return { background: 'transparent', color: 'var(--text-muted)' }
      case 'danger':
        return { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)' }
      case 'outline':
        return { background: 'white', color: 'var(--text)', border: '1px solid var(--border)' }
    }
  })()

  return (
    <button
      disabled={disabled ?? isLoading}
      className={cn(base, sizeClass, className)}
      style={variantStyle}
      {...props}
    >
      {isLoading ? (
        <>
          <div
            className="h-3.5 w-3.5 animate-spin rounded-full border-2"
            style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
          />
          {children}
        </>
      ) : (
        children
      )}
    </button>
  )
}
