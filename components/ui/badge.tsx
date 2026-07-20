import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
  {
    variants: {
      variant: {
        neutral:
          'bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-main)]',
        primary: 'bg-primary/12 text-primary',
        paid: 'bg-primary text-[var(--interactive-primary-foreground)]',
        free: 'bg-[var(--success)]/12 text-[var(--success)]',
        premium: 'bg-primary/12 text-primary',
        error: 'bg-[var(--error)]/12 text-[var(--error)]',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}
