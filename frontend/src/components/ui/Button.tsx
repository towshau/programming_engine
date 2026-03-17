import { cn } from '../../lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' &&
          'bg-emerald-600 text-white hover:bg-emerald-500',
        variant === 'secondary' &&
          'bg-zinc-700 text-zinc-200 hover:bg-zinc-600 border border-zinc-600',
        variant === 'ghost' &&
          'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800',
        size === 'sm' && 'px-2.5 py-1 text-xs',
        size === 'md' && 'px-4 py-2 text-sm',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
