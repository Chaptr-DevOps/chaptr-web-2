'use client'

import { useTransition } from 'react'
import {
  Users,
  BookOpen,
  BookMarked,
  CheckCircle2,
  Flag,
  UserX,
  UserCheck,
  Trash2,
  X,
  Shield,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { resolveReport, suspendUser, reinstateUser } from './actions'
import type { Report } from '@/lib/types'

interface SuspendedUser {
  id: string
  username: string | null
  display_name: string | null
  status: string
  created_at: string
}

interface AdminStats {
  totalUsers: number
  totalBooks: number
  totalGroups: number
  totalChapters: number
}

export function AdminClient({
  stats,
  reports,
  suspended,
}: {
  stats: AdminStats
  reports: Report[]
  suspended: SuspendedUser[]
}) {
  const [isPending, startTransition] = useTransition()

  function handleResolve(id: string, action: 'dismiss' | 'remove') {
    startTransition(() => resolveReport(id, action))
  }

  function handleSuspend(userId: string) {
    if (!confirm('Suspend this user? They will lose access immediately.')) return
    startTransition(() => suspendUser(userId))
  }

  function handleReinstate(userId: string) {
    startTransition(() => reinstateUser(userId))
  }

  const STAT_CARDS = [
    { label: 'Total users', value: stats.totalUsers, icon: Users, color: 'text-primary', bg: 'bg-primary/12' },
    { label: 'Books catalogued', value: stats.totalBooks, icon: BookOpen, color: 'text-[var(--success)]', bg: 'bg-[var(--success)]/12' },
    { label: 'Reading groups', value: stats.totalGroups, icon: BookMarked, color: 'text-amber-500', bg: 'bg-amber-500/12' },
    { label: 'Chapters logged', value: stats.totalChapters, icon: CheckCircle2, color: 'text-[var(--text-secondary)]', bg: 'bg-[var(--surface-elevated)]' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="px-5 pt-8 pb-6 md:px-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--error)]/12 text-[var(--error)]">
            <Shield className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-serif text-[34px] leading-10 tracking-[-0.7px] text-[var(--text-primary)]">
              Admin Dashboard
            </h1>
            <p className="mt-0.5 text-[15px] text-[var(--text-secondary)]">
              Platform management and moderation
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-8 px-5 pb-10 md:px-8">
        {/* Stats grid */}
        <section>
          <h2 className="mb-3 font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
            Platform stats
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {STAT_CARDS.map(({ label, value, icon: Icon, color, bg }) => (
              <Card key={label} elevated className="flex flex-col items-center gap-2 p-5 text-center">
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${bg} ${color}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <p className="font-serif text-[28px] tracking-[-0.5px] text-[var(--text-primary)]">
                  {value.toLocaleString()}
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Reports queue */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
              Open reports
            </h2>
            {reports.length > 0 && (
              <span className="rounded-full bg-[var(--error)]/12 px-2.5 py-0.5 text-xs font-semibold text-[var(--error)]">
                {reports.length}
              </span>
            )}
          </div>
          {reports.length === 0 ? (
            <EmptyState
              icon={Flag}
              title="No open reports"
              description="All content reports have been resolved."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--border-main)] bg-[var(--surface)]">
              {reports.map((r, i) => (
                <div
                  key={r.id}
                  className={`flex items-start gap-3 p-4 ${
                    i > 0 ? 'border-t border-[var(--border-main)]' : ''
                  }`}
                >
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--error)]/12 text-[var(--error)]">
                    <Flag className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-[var(--text-primary)] capitalize">
                      {r.target_type ?? 'Content'} reported
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                      Reason: {r.reason ?? 'Not specified'}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                      ID: {r.target_id?.slice(0, 8)}…
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => handleResolve(r.id, 'dismiss')}
                      disabled={isPending}
                      title="Dismiss"
                      className="rounded-lg border border-[var(--border-main)] p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-elevated)] disabled:opacity-40"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleResolve(r.id, 'remove')}
                      disabled={isPending}
                      title="Remove content"
                      className="rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/8 p-1.5 text-[var(--error)] transition-colors hover:bg-[var(--error)]/20 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Suspended users */}
        <section>
          <h2 className="mb-3 font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
            Suspended accounts
          </h2>
          {suspended.length === 0 ? (
            <EmptyState
              icon={UserCheck}
              title="No suspended accounts"
              description="Users you suspend will appear here."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--border-main)] bg-[var(--surface)]">
              {suspended.map((u, i) => (
                <div
                  key={u.id}
                  className={`flex items-center gap-3 p-4 ${
                    i > 0 ? 'border-t border-[var(--border-main)]' : ''
                  }`}
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--error)]/12 text-[var(--error)]">
                    <UserX className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--text-primary)]">
                      {u.display_name ?? u.username ?? 'Unknown'}
                    </p>
                    <p className="text-sm text-[var(--text-tertiary)]">@{u.username}</p>
                  </div>
                  <button
                    onClick={() => handleReinstate(u.id)}
                    disabled={isPending}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--success)]/30 bg-[var(--success)]/8 px-3 py-1.5 text-sm font-medium text-[var(--success)] transition-colors hover:bg-[var(--success)]/20 disabled:opacity-40"
                  >
                    <UserCheck className="h-4 w-4" />
                    Reinstate
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
