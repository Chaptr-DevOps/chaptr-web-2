import Link from 'next/link'
import { Users, Sparkles } from 'lucide-react'
import type { ReadingGroup } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/stripe'

export function GroupCard({
  group,
  memberCount,
  bookTitle,
}: {
  group: ReadingGroup
  memberCount?: number
  bookTitle?: string | null
}) {
  return (
    <Link
      href={`/groups/${group.id}`}
      className="group block rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-5 transition-colors hover:border-primary/50"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="font-serif text-[22px] leading-7 tracking-[-0.3px] text-[var(--text-primary)]">
          {group.name}
        </h3>
        {group.is_paid ? (
          <Badge variant="paid">
            <Sparkles className="h-3 w-3" />
            {formatPrice(group.price)}/mo
          </Badge>
        ) : (
          <Badge variant="free">Free</Badge>
        )}
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
        {group.is_public ? <span>Public</span> : <span>Private</span>}
      </div>
    </Link>
  )
}
