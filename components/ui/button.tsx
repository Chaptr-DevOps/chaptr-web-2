'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-[var(--interactive-primary-foreground)] hover:opacity-90',
        secondary:
          'bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--border-main)] hover:bg-[var(--border-main)]/40',
        outline:
          'border border-[var(--border-main)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]',
        ghost:
          'bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]',
        destructive: 'bg-[var(--error)] text-white hover:opacity-90',
        link: 'text-primary underline-offset-4 hover:underline rounded-none',
      },
      size: {
        default: 'h-12 px-6 text-[15px] tracking-[0.3px]',
        lg: 'h-14 px-8 text-[18px] tracking-[0.5px]',
        sm: 'h-10 px-4 text-[14px]',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
