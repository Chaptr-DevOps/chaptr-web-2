import Link from 'next/link'
import { Users } from 'lucide-react'
import type { ReadingGroup } from '@/lib/types'
import { Badge } from '@/components/ui/badge'

export function GroupCard({
  group,
  memberCount,
  bookTitle,
  href,
}: {
  group: ReadingGroup
  memberCount?: number
  bookTitle?: string | null
  /**
   * Defaults to the group page, which is right for groups you're already in.
   * Discover passes `/join/[id]` so a card click lands on the preview instead
   * of a group page the viewer isn't a member of.
   */
  href?: string
}) {
  return (
    <Link
      href={href ?? `/groups/${group.id}`}
      className="group block overflow-hidden rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] transition-colors hover:border-primary/50"
    >
      {/* Groups without a banner keep the plain card — no placeholder strip. */}
      {group.banner_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={group.banner_image_url}
          alt=""
          aria-hidden
          className="h-24 w-full object-cover"
        />
      )}
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="font-serif text-[22px] leading-7 tracking-[-0.3px] text-[var(--text-primary)]">
            {group.name}
          </h3>
          <Badge variant="neutral">{group.is_public ? 'Public' : 'Private'}</Badge>
        </div>
        {bookTitle && (
          <p className="mb-3 text-[15px] text-[var(--text-secondary)]">
            Currently reading{' '}
            <span className="font-medium text-[var(--text-primary)]">
              {bookTitle}
            </span>
          </p>
        )}
        <div className="flex items-center gap-4 text-sm text-[var(--text-tertiary)]">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {memberCount ?? 0} members
          </span>
          {group.reading_pace && <span>{group.reading_pace}</span>}
          <span>{group.is_paid ? 'Paid' : 'Free'}</span>
        </div>
      </div>
    </Link>
  )
}
