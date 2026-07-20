import Link from 'next/link'
import { Bell } from 'lucide-react'

export function PageHeader({
  title,
  subtitle,
  action,
  showBell = true,
  unread = 0,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  showBell?: boolean
  unread?: number
}) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 pt-6 pb-4 md:px-8 md:pt-8">
      <div className="min-w-0">
        <h1 className="font-serif text-[34px] leading-10 tracking-[-0.7px] text-[var(--text-primary)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[15px] text-[var(--text-secondary)]">
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {showBell && (
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-main)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--error)]" />
            )}
          </Link>
        )}
      </div>
    </header>
  )
}
