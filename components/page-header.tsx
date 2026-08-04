import Link from 'next/link'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  subtitle,
  action,
  showBell = true,
  unread = 0,
  variant = 'default',
  bannerUrl = null,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  showBell?: boolean
  unread?: number
  /**
   * 'hero' renders the header over a full-bleed banner (group pages), matching
   * the mobile GroupDetailScreen. Falls back to a gradient when there's no image.
   */
  variant?: 'default' | 'hero'
  bannerUrl?: string | null
}) {
  const hero = variant === 'hero'

  return (
    <header
      className={cn(
        'flex items-start justify-between gap-4 px-5 pt-6 pb-4 md:px-8 md:pt-8',
        hero && 'relative min-h-[168px] items-end overflow-hidden pb-5 md:min-h-[200px] md:pb-6',
      )}
    >
      {hero && (
        <>
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bannerUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-br from-[var(--accent-brand-dark)] via-primary to-[var(--accent-brand-light)]"
            />
          )}
          {/* Photos need a heavier scrim than the brand gradient, which is already dark. */}
          <div
            aria-hidden
            className={cn('absolute inset-0', bannerUrl ? 'bg-black/45' : 'bg-black/20')}
          />
        </>
      )}

      <div className={cn('min-w-0', hero && 'relative')}>
        <h1
          className={cn(
            'font-serif text-[34px] leading-10 tracking-[-0.7px] text-[var(--text-primary)]',
            hero && 'text-white drop-shadow-sm',
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={cn(
              'mt-1 text-[15px] text-[var(--text-secondary)]',
              hero && 'text-white/80',
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
      <div className={cn('flex shrink-0 items-center gap-2', hero && 'relative')}>
        {action}
        {showBell && (
          <Link
            href="/notifications"
            aria-label="Notifications"
            className={cn(
              'relative inline-flex h-11 w-11 items-center justify-center rounded-full border',
              hero
                ? 'border-white/30 bg-black/20 text-white hover:bg-black/40'
                : 'border-[var(--border-main)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]',
            )}
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
