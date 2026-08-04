'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarDays,
  Gauge,
  Globe,
  Hash,
  Loader2,
  Lock,
  LogIn,
  MessageSquare,
  Sparkles,
  Star,
  Users,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { CommunityGuidelinesModal, GUIDELINES } from '@/components/community-guidelines-modal'
import { formatPrice } from '@/lib/stripe'
import { cn } from '@/lib/utils'
import { joinGroupAction } from './actions'

export interface PreviewGroup {
  id: string
  name: string
  description: string | null
  banner_image_url: string | null
  is_public: boolean
  is_paid: boolean
  price: number | null
  reading_pace: string | null
  member_limit: number | null
  target_end_date: string | null
}

export interface PreviewBook {
  title: string
  author: string | null
  cover_image_url: string | null
  total_chapters: number | null
  total_pages: number | null
  description: string | null
  genres: string[]
  average_rating: number | null
  total_ratings: number | null
}

export interface PreviewChannel {
  id: string
  name: string
  description: string | null
  isPremium: boolean
  isChapterGated: boolean
}

export interface PreviewMember {
  id: string
  name: string
  avatarUrl: string | null
  isHost: boolean
}

const PACE_LABEL: Record<string, string> = {
  slow: 'Slow',
  moderate: 'Moderate',
  fast: 'Fast',
}

const PACE_BLURB: Record<string, string> = {
  slow: 'A relaxed chapter or two a week',
  moderate: 'A steady few chapters a week',
  fast: 'A brisk pace — several chapters a week',
}

function formatTargetDate(value: string | null): string | null {
  if (!value) return null
  // Date-only column: parse as UTC so it doesn't slip a day in western zones.
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function GroupPreviewClient({
  group,
  book,
  channels,
  members,
  memberCount,
  weeklyMessages,
  isSignedIn,
}: {
  group: PreviewGroup
  book: PreviewBook | null
  channels: PreviewChannel[]
  members: PreviewMember[]
  memberCount: number
  weeklyMessages: number | null
  isSignedIn: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showGuidelines, setShowGuidelines] = useState(false)
  const [error, setError] = useState('')

  // The hero uses the group banner at full clarity, and falls back to the book
  // cover blown up and blurred — the same trick the mobile preview screen uses.
  const heroImage = group.banner_image_url ?? book?.cover_image_url ?? null
  const heroIsBanner = Boolean(group.banner_image_url)
  const paceLabel = group.reading_pace ? (PACE_LABEL[group.reading_pace] ?? group.reading_pace) : null
  const paceBlurb = group.reading_pace ? PACE_BLURB[group.reading_pace] : null
  const targetDate = formatTargetDate(group.target_end_date)
  const host = members.find((m) => m.isHost)
  const spotsLeft =
    group.member_limit != null ? Math.max(group.member_limit - memberCount, 0) : null

  function runJoin() {
    setError('')
    startTransition(async () => {
      const res = await joinGroupAction(group.id)
      if (res?.error) {
        setError(res.error)
        setShowGuidelines(false)
        return
      }
      router.replace(`/groups/${group.id}`)
      router.refresh()
    })
  }

  // Public groups agree to the guidelines first; private groups join straight
  // through, matching the mobile flow.
  function handleJoinClick() {
    if (group.is_public) {
      setError('')
      setShowGuidelines(true)
      return
    }
    runJoin()
  }

  // Membership is free for every group — `is_paid` marks a premium *tier*, not a
  // paid door — so Join is the primary action for paid and free groups alike.
  // A signed-out visitor goes to signup; lib/pending-redirect.ts carries this
  // destination through signup and all six onboarding steps and returns them here.
  const joinButton = !isSignedIn ? (
    <Link
      href={`/signup?redirect=${encodeURIComponent(`/join/${group.id}`)}`}
      className={buttonVariants({ className: 'w-full' })}
    >
      <LogIn className="mr-1.5 h-4 w-4" /> Join Group
    </Link>
  ) : (
    <Button className="w-full" onClick={handleJoinClick} disabled={isPending}>
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <LogIn className="mr-1.5 h-4 w-4" /> Join Group
        </>
      )}
    </Button>
  )

  const priceNote = group.is_paid ? (
    <>
      Joining is free · {formatPrice(group.price)}/month unlocks the premium channels
    </>
  ) : (
    <>Free to join · leave any time</>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero ── */}
      <div className="relative h-[280px] w-full overflow-hidden md:h-[340px] lg:h-[400px]">
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            alt=""
            aria-hidden
            className={cn('h-full w-full object-cover', !heroIsBanner && 'scale-125 blur-2xl')}
          />
        ) : (
          <div className="h-full w-full bg-primary/15" />
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 px-6">
          {book && (
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[1.2px] text-white/90">
              Currently Reading
            </p>
          )}
          {book?.cover_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.cover_image_url}
              alt={book.title}
              className="h-[170px] w-[113px] rounded-lg object-cover shadow-[0_12px_20px_rgba(0,0,0,0.5)]"
            />
          )}
          {paceLabel && (
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-black/75 px-2.5 py-1.5 text-[10px] font-semibold text-white">
              <Gauge className="h-3 w-3" />
              {paceLabel} Pace
            </span>
          )}
        </div>

        <Link
          href="/groups"
          aria-label="Back to groups"
          className="absolute left-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>

      {/* `relative` (not z-10) so the -mt overlap still covers the hero via DOM
          order without painting over the fixed join bar below. */}
      <div className="relative -mt-6 rounded-t-2xl bg-background px-6 pb-44 pt-8 md:px-8 lg:-mt-10 lg:rounded-t-3xl lg:px-10 lg:pb-16 lg:pt-10">
        <div className="mx-auto max-w-2xl lg:max-w-5xl">
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-10">
            {/* ── Main column ── */}
            <div className="space-y-6">
              {/* Title block */}
              <div className="text-center lg:text-left">
                <h1 className="font-serif text-3xl font-bold leading-tight text-[var(--text-primary)] lg:text-4xl">
                  {group.name}
                </h1>

                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-xs text-[var(--text-tertiary)] lg:justify-start">
                  {group.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  <span>{group.is_public ? 'Public group' : 'Private group'}</span>
                  {memberCount >= 2 && (
                    <>
                      <span className="mx-1">•</span>
                      <span className="flex items-center">
                        {members.slice(0, 3).map((m, i) => (
                          <Avatar
                            key={m.id}
                            src={m.avatarUrl}
                            name={m.name}
                            size={24}
                            className={cn('ring-2 ring-background', i > 0 && '-ml-2')}
                          />
                        ))}
                      </span>
                      <span className="ml-1 font-medium">
                        {memberCount > 3
                          ? `+ ${memberCount - 3} members`
                          : `${memberCount} members`}
                      </span>
                    </>
                  )}
                </div>

                {group.description && (
                  <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-secondary)]">
                    {group.description}
                  </p>
                )}

                {host && (
                  <p className="mt-3 text-sm text-[var(--text-tertiary)]">
                    Hosted by{' '}
                    <span className="font-medium text-[var(--text-secondary)]">{host.name}</span>
                  </p>
                )}
              </div>

              {/* Currently reading */}
              {book && (
                <section className="rounded-xl border border-[var(--border-main)] bg-[var(--surface)] p-5">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    Currently Reading
                  </p>
                  <div className="flex gap-4">
                    {book.cover_image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={book.cover_image_url}
                        alt={book.title}
                        className="h-[144px] w-[96px] shrink-0 rounded-md object-cover shadow-sm"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-xl font-bold leading-tight text-[var(--text-primary)]">
                        {book.title}
                      </p>
                      {book.author && (
                        <p className="text-sm text-[var(--text-secondary)]">by {book.author}</p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-tertiary)]">
                        {book.total_chapters && <span>{book.total_chapters} chapters</span>}
                        {book.total_pages && <span>{book.total_pages} pages</span>}
                        {Boolean(book.average_rating) && Boolean(book.total_ratings) && (
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3 w-3 fill-current" />
                            {Number(book.average_rating).toFixed(1)}
                          </span>
                        )}
                      </div>

                      {book.genres.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {book.genres.map((g) => (
                            <Badge key={g} variant="neutral">
                              {g}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {book.description && (
                    <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {book.description}
                    </p>
                  )}

                  {targetDate && (
                    <p className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Aiming to finish by {targetDate}
                    </p>
                  )}
                </section>
              )}

              {/* What's inside */}
              {channels.length > 0 && (
                <section className="rounded-xl border border-[var(--border-main)] bg-[var(--surface)] p-5">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    What&apos;s Inside
                  </p>
                  <p className="mb-4 text-sm text-[var(--text-secondary)]">
                    {channels.length} {channels.length === 1 ? 'channel' : 'channels'} to talk in as
                    you read.
                  </p>
                  <ul className="space-y-2.5">
                    {channels.map((c) => (
                      <li key={c.id} className="flex items-center gap-2.5">
                        <Hash className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
                        <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {c.name}
                        </span>
                        {c.isChapterGated && (
                          <span className="shrink-0 text-xs text-[var(--text-tertiary)]">
                            chapter-gated
                          </span>
                        )}
                        {c.isPremium && (
                          <Badge variant="neutral" className="shrink-0">
                            <Sparkles className="mr-1 h-3 w-3" />
                            Premium
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Members */}
              {(members.length > 0 || memberCount > 0) && (
                <section className="rounded-xl border border-[var(--border-main)] bg-[var(--surface)] p-5">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    Who&apos;s Reading ({memberCount})
                  </p>
                  {!isSignedIn ? (
                    <p className="text-sm text-[var(--text-secondary)]">
                      {memberCount === 1
                        ? '1 reader has joined so far.'
                        : `${memberCount} readers have joined so far.`}
                    </p>
                  ) : (
                  <div className="flex flex-wrap gap-2">
                    {members.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--border-main)] py-1 pl-1 pr-3"
                      >
                        <Avatar src={m.avatarUrl} name={m.name} size={24} />
                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                          {m.name}
                        </span>
                        {m.isHost && (
                          <span className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
                            Host
                          </span>
                        )}
                      </span>
                    ))}
                    {memberCount > members.length && (
                      <span className="inline-flex items-center rounded-full border border-dashed border-[var(--border-main)] px-3 py-1.5 text-xs text-[var(--text-tertiary)]">
                        +{memberCount - members.length} more
                      </span>
                    )}
                  </div>
                  )}
                </section>
              )}

              {/* Community guidelines — shown up front, and agreed to in the
                  modal before a public-group join goes through. */}
              <section className="rounded-xl border border-[var(--border-main)] bg-[var(--surface)] p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  Community Guidelines
                </p>
                <p className="mb-4 mt-1 text-sm text-[var(--text-secondary)]">
                  Read respectfully. Discuss thoughtfully.
                </p>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {GUIDELINES.map(({ icon: Icon, title, description }) => (
                    <li key={title} className="flex gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
                        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                          {description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-[var(--border-main)] pt-3 text-xs text-[var(--text-tertiary)]">
                  Violations may result in removal or bans.
                </p>
              </section>
            </div>

            {/* ── Desktop join panel ── */}
            <aside className="hidden lg:block lg:sticky lg:top-8">
              <div className="rounded-xl border border-[var(--border-main)] bg-[var(--surface)] p-5">
                <p className="font-serif text-lg font-bold text-[var(--text-primary)]">
                  Join {group.name}
                </p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">{priceNote}</p>

                <dl className="my-5 space-y-3 border-y border-[var(--border-main)] py-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                      <Users className="h-4 w-4" /> Members
                    </dt>
                    <dd className="font-medium text-[var(--text-primary)]">{memberCount}</dd>
                  </div>
                  {paceLabel && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                        <Gauge className="h-4 w-4" /> Pace
                      </dt>
                      <dd className="font-medium text-[var(--text-primary)]">{paceLabel}</dd>
                    </div>
                  )}
                  {weeklyMessages !== null && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                        <MessageSquare className="h-4 w-4" /> This week
                      </dt>
                      <dd className="font-medium text-[var(--text-primary)]">
                        {weeklyMessages} {weeklyMessages === 1 ? 'message' : 'messages'}
                      </dd>
                    </div>
                  )}
                </dl>

                {paceBlurb && (
                  <p className="mb-4 text-xs leading-relaxed text-[var(--text-tertiary)]">
                    {paceBlurb}.
                  </p>
                )}

                {error && <p className="mb-3 text-sm text-[var(--error)]">{error}</p>}

                {joinButton}

                {spotsLeft !== null && spotsLeft <= 10 && (
                  <p className="mt-3 text-center text-xs text-[var(--text-tertiary)]">
                    {spotsLeft === 0
                      ? 'This group is full'
                      : `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left`}
                  </p>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* ── Mobile join bar ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-main)] bg-background px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto max-w-2xl space-y-2">
          {error && <p className="text-center text-sm text-[var(--error)]">{error}</p>}
          <p className="text-center text-xs text-[var(--text-tertiary)]">{priceNote}</p>
          {joinButton}
        </div>
      </div>

      <CommunityGuidelinesModal
        open={showGuidelines}
        onClose={() => setShowGuidelines(false)}
        onAccept={runJoin}
        isLoading={isPending}
        error={error}
      />
    </div>
  )
}
