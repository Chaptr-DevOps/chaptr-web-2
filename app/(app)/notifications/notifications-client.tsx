'use client'

import { useTransition } from 'react'
import {
  Bell,
  Flame,
  BookOpen,
  Users,
  Star,
  CheckCheck,
  Circle,
} from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { markAllRead, markOneRead } from './actions'
import type { AppNotification } from '@/lib/types'

const TYPE_META: Record<
  string,
  { icon: React.ElementType; color: string; bg: string }
> = {
  streak: { icon: Flame, color: 'text-[var(--error)]', bg: 'bg-[var(--error)]/12' },
  chapter: { icon: BookOpen, color: 'text-[var(--success)]', bg: 'bg-[var(--success)]/12' },
  group: { icon: Users, color: 'text-primary', bg: 'bg-primary/12' },
  milestone: { icon: Star, color: 'text-amber-500', bg: 'bg-amber-500/12' },
  default: { icon: Bell, color: 'text-[var(--text-tertiary)]', bg: 'bg-[var(--surface-elevated)]' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function NotificationsClient({
  notifications,
  unreadCount,
}: {
  notifications: AppNotification[]
  unreadCount: number
}) {
  const [isPending, startTransition] = useTransition()

  function handleMarkAll() {
    startTransition(() => markAllRead())
  }

  function handleMarkOne(id: string) {
    startTransition(() => markOneRead(id))
  }

  return (
    <div>
      {/* Header */}
      <header className="flex items-start justify-between gap-4 px-5 pt-6 pb-4 md:px-8 md:pt-8">
        <div>
          <h1 className="font-serif text-[34px] leading-10 tracking-[-0.7px] text-[var(--text-primary)]">
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="mt-1 text-[15px] text-[var(--text-secondary)]">
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            disabled={isPending}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border-main)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-elevated)] disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </button>
        )}
      </header>

      <div className="px-5 pb-8 md:px-8">
        {notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="All caught up!"
            description="Notifications about your streaks, groups, and milestones will appear here."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--border-main)] bg-[var(--surface)]">
            {notifications.map((n, i) => {
              const meta = TYPE_META[n.type ?? 'default'] ?? TYPE_META.default
              const Icon = meta.icon
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-4 transition-colors ${
                    i > 0 ? 'border-t border-[var(--border-main)]' : ''
                  } ${!n.is_read ? 'bg-primary/4' : ''}`}
                >
                  <span
                    className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.bg} ${meta.color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {n.title && (
                      <p className="text-[15px] font-medium text-[var(--text-primary)]">
                        {n.title}
                      </p>
                    )}
                    {n.body && (
                      <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{n.body}</p>
                    )}
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkOne(n.id)}
                      disabled={isPending}
                      aria-label="Mark as read"
                      className="mt-1 shrink-0 text-primary opacity-70 transition-opacity hover:opacity-100 disabled:opacity-30"
                    >
                      <Circle className="h-2.5 w-2.5 fill-current" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
