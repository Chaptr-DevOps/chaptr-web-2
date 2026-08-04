'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Flame,
  BookOpen,
  CheckCircle2,
  Star,
  Settings,
  Trophy,
  BarChart3,
  Clock,
  ChevronRight,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { BookCover } from '@/components/book-cover'
import { EmptyState } from '@/components/empty-state'
import type { ProfileStats, Badge } from './actions'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function BadgeCard({ badge }: { badge: Badge }) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all ${
        badge.earned
          ? 'border-primary/30 bg-primary/8'
          : 'border-[var(--border-main)] bg-[var(--surface)] opacity-45'
      }`}
    >
      <span className="text-3xl">{badge.icon}</span>
      <p className={`text-sm font-semibold ${badge.earned ? 'text-primary' : 'text-[var(--text-secondary)]'}`}>
        {badge.label}
      </p>
      <p className="text-[11px] leading-tight text-[var(--text-tertiary)]">{badge.description}</p>
    </div>
  )
}

type Tab = 'overview' | 'activity' | 'badges'

export function ProfileClient({
  stats,
  isOwn,
}: {
  stats: ProfileStats
  isOwn: boolean
}) {
  const [tab, setTab] = useState<Tab>('overview')

  const { profile, totalChapters, totalBooks, currentStreak, completions, reading, badges } = stats

  const earnedCount = badges.filter((b) => b.earned).length

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'activity', label: 'Activity', icon: Clock },
    { key: 'badges', label: 'Badges', icon: Trophy },
  ]

  return (
    <div>
      {/* Hero header */}
      <div className="relative overflow-hidden px-5 pt-8 pb-6 md:px-8">
        {/* decorative gradient */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar
              src={profile.avatar_url}
              name={profile.display_name ?? profile.username ?? 'Reader'}
              size={72}
            />
            <div>
              <h1 className="font-serif text-[28px] leading-tight tracking-[-0.5px] text-[var(--text-primary)]">
                {profile.display_name ?? profile.username ?? 'Reader'}
              </h1>
              <p className="mt-0.5 text-sm text-[var(--text-tertiary)]">
                @{profile.username}
              </p>
            </div>
          </div>
          {isOwn && (
            <Link
              href="/settings"
              className="flex items-center gap-2 self-start rounded-xl border border-[var(--border-main)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-elevated)] sm:self-auto"
            >
              <Settings className="h-4 w-4" />
              Edit profile
            </Link>
          )}
        </div>

        {/* Bio — full-width row so long bios aren't boxed into the avatar cluster */}
        {profile.bio && (
          <p className="relative mt-4 text-[15px] leading-relaxed text-pretty text-[var(--text-secondary)]">
            {profile.bio}
          </p>
        )}

        {/* Stat pills */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Card className="flex flex-col items-center gap-1 p-4">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--error)]/12 text-[var(--error)]">
              <Flame className="h-5 w-5" />
            </span>
            <p className="font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
              {currentStreak}
            </p>
            <p className="text-[11px] text-[var(--text-tertiary)]">Day streak</p>
          </Card>
          <Card className="flex flex-col items-center gap-1 p-4">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/12 text-primary">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <p className="font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
              {totalChapters}
            </p>
            <p className="text-[11px] text-[var(--text-tertiary)]">Chapters</p>
          </Card>
          <Card className="flex flex-col items-center gap-1 p-4">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--success)]/12 text-[var(--success)]">
              <BookOpen className="h-5 w-5" />
            </span>
            <p className="font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
              {totalBooks}
            </p>
            <p className="text-[11px] text-[var(--text-tertiary)]">Books done</p>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 flex gap-1 border-b border-[var(--border-main)] bg-[var(--background)] px-5 md:px-8">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-6 px-5 py-6 md:px-8">
        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <>
            {/* Genre preferences */}
            {profile.preferred_genres && profile.preferred_genres.length > 0 && (
              <section>
                <h2 className="mb-3 font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
                  Favourite genres
                </h2>
                <div className="flex flex-wrap gap-2">
                  {profile.preferred_genres.map((g) => (
                    <span
                      key={g}
                      className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Currently reading */}
            <section>
              <h2 className="mb-3 font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
                Currently reading
              </h2>
              {reading.filter((p) => p.status === 'reading').length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="Not reading anything"
                  description="Books in progress will appear here."
                />
              ) : (
                <div className="space-y-3">
                  {reading
                    .filter((p) => p.status === 'reading')
                    .slice(0, 4)
                    .map((p) =>
                      p.book ? (
                        <div
                          key={p.id}
                          className="flex gap-3 rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-4"
                        >
                          <div className="w-12 shrink-0">
                            <BookCover
                              title={p.book.title}
                              author={p.book.author}
                              src={p.book.cover_image_url}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-[var(--text-primary)]">
                              {p.book.title}
                            </p>
                            <p className="text-sm text-[var(--text-tertiary)]">Ch. {p.current_chapter}</p>
                            <Progress value={p.progress_percentage} className="mt-2" />
                          </div>
                        </div>
                      ) : null,
                    )}
                </div>
              )}
            </section>

            {/* Badge preview */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
                  Badges
                </h2>
                <button
                  onClick={() => setTab('badges')}
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  {earnedCount}/{badges.length}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {badges.slice(0, 6).map((b) => (
                  <BadgeCard key={b.id} badge={b} />
                ))}
              </div>
            </section>
          </>
        )}

        {/* ACTIVITY TAB */}
        {tab === 'activity' && (
          <section>
            <h2 className="mb-4 font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
              Reading log
            </h2>
            {completions.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No activity yet"
                description="Your chapter completions will show up here."
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[var(--border-main)] bg-[var(--surface)]">
                {completions.map((c, i) => (
                  <div
                    key={c.id}
                    className={`flex items-start gap-3 p-4 ${
                      i > 0 ? 'border-t border-[var(--border-main)]' : ''
                    }`}
                  >
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--success)]/12 text-[var(--success)]">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] text-[var(--text-primary)]">
                        Finished chapter {c.chapter_number} of{' '}
                        <span className="font-medium">{c.book?.title ?? 'a book'}</span>
                      </p>
                      {c.reflection_text && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-[var(--text-secondary)]">
                          &ldquo;{c.reflection_text}&rdquo;
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-[var(--text-tertiary)]">
                      {timeAgo(c.completed_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* BADGES TAB */}
        {tab === 'badges' && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
                Achievements
              </h2>
              <span className="rounded-full bg-primary/12 px-3 py-1 text-sm font-medium text-primary">
                {earnedCount} / {badges.length} earned
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {badges.map((b) => (
                <BadgeCard key={b.id} badge={b} />
              ))}
            </div>
            {earnedCount === badges.length && (
              <Card elevated className="mt-6 border-primary/30 bg-primary/8 p-5 text-center">
                <Star className="mx-auto mb-2 h-8 w-8 text-primary" />
                <p className="font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
                  All badges earned!
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  You&apos;re a true Chaptr legend. Keep reading!
                </p>
              </Card>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
