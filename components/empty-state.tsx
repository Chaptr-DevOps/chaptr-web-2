import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-main)] bg-[var(--surface)] px-6 py-14 text-center md:px-12 md:py-16">
      <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/12 text-primary">
        <Icon className="h-7 w-7" />
      </span>
      <h3 className="font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-pretty text-[var(--text-secondary)]">
        {description}
      </p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className={`${buttonVariants()} mt-5`}>
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
