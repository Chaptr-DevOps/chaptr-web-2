import type { ReactNode } from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

/**
 * Wraps a premium book or channel. If `locked` is false (item isn't premium,
 * or the viewer has an active subscription to the group) it renders the real
 * content. Otherwise it renders a blurred preview with a "Subscribe to unlock"
 * CTA pointing at the group's subscribe page.
 */
export function PaywallGate({
  locked,
  groupId,
  label = 'Subscribe to unlock',
  children,
}: {
  locked: boolean
  groupId: string
  label?: string
  children: ReactNode
}) {
  if (!locked) return <>{children}</>

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div
        aria-hidden
        className="pointer-events-none select-none blur-sm saturate-50"
      >
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--surface)]/70 p-6 text-center backdrop-blur-[2px]">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Lock className="h-5 w-5" />
        </span>
        <p className="text-[15px] font-semibold text-[var(--text-primary)]">
          Premium content
        </p>
        <Link
          href={`/groups/${groupId}/subscribe`}
          className={buttonVariants({ size: 'sm' })}
        >
          {label}
        </Link>
      </div>
    </div>
  )
}
