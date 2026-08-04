'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  Gauge,
  Globe,
  Hash,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BookCover } from '@/components/book-cover'
import {
  cancelGroupSubscription,
  resumeGroupSubscription,
  startSubscribeCheckout,
} from '@/app/(app)/groups/actions'
import { formatPrice } from '@/lib/stripe'
import { LEGAL, PLATFORM_FEE_PERCENT } from '@/lib/legal'
import { cn } from '@/lib/utils'

interface SubscribeClientProps {
  groupId: string
  group: {
    name: string
    description: string | null
    price: number | null
    readingPace: string | null
    isPublic: boolean
    bannerImageUrl: string | null
  }
  currentBook: {
    title: string
    author: string | null
    cover_image_url: string | null
    total_chapters: number | null
  } | null
  memberCount: number
  channels: { name: string; isPremium: boolean; isChapterGated: boolean }[]
  viewer: {
    signedIn: boolean
    alreadySubscribed: boolean
    isOwner: boolean
    acceptingPayments: boolean
    /** ISO date access lapses, when a cancellation is already scheduled. */
    pendingCancelAt: string | null
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function SubscribeClient({
  groupId,
  group,
  currentBook,
  memberCount,
  channels,
  viewer,
}: SubscribeClientProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cancelledAt, setCancelledAt] = useState<string | null>(
    viewer.pendingCancelAt,
  )

  const price = formatPrice(group.price)
  const premiumChannels = channels.filter((c) => c.isPremium)
  const backdrop = group.bannerImageUrl ?? currentBook?.cover_image_url ?? null

  function handleSubscribe() {
    setError('')
    startTransition(async () => {
      // On success this server action redirects to Stripe Checkout and never
      // returns; only the failure path produces a value.
      const res = await startSubscribeCheckout(groupId)
      if (res?.error) setError(res.error)
    })
  }

  function handleCancel() {
    setError('')
    startTransition(async () => {
      const res = await cancelGroupSubscription(groupId)
      if (res.error) {
        setError(res.error)
      } else {
        setConfirmingCancel(false)
        setCancelledAt(res.accessEndsAt ?? '')
      }
    })
  }

  function handleResume() {
    setError('')
    startTransition(async () => {
      const res = await resumeGroupSubscription(groupId)
      if (res.error) setError(res.error)
      else setCancelledAt(null)
    })
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Top bar */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-5">
        {viewer.signedIn ? (
          <Link
            href={`/groups/${groupId}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/55"
            aria-label="Back to group"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        ) : (
          <Link
            href="/"
            className="font-serif text-lg font-bold text-white drop-shadow-sm"
          >
            {LEGAL.productName}
          </Link>
        )}
        {!viewer.signedIn && (
          <Link
            href="/signin"
            className="rounded-full bg-black/40 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/55"
          >
            Sign in
          </Link>
        )}
      </header>

      {/* Hero */}
      <div className="relative h-[280px] overflow-hidden md:h-[340px] lg:h-[400px]">
        {backdrop ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backdrop}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-primary to-primary/60" />
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-white/90">
            {currentBook ? 'Currently Reading' : 'Reading Group'}
          </p>
          {currentBook && (
            <div className="relative w-[120px]">
              <div className="overflow-hidden rounded-lg shadow-2xl">
                <BookCover
                  title={currentBook.title}
                  author={currentBook.author}
                  src={currentBook.cover_image_url}
                />
              </div>
              {group.readingPace && (
                <div className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/75 px-2.5 py-1.5">
                  <Gauge className="h-3 w-3 text-white" />
                  <span className="text-[10px] font-semibold text-white">
                    {capitalize(group.readingPace)} Pace
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <main className="relative z-[1] -mt-6 rounded-t-3xl bg-[var(--background)] px-5 py-8 md:px-8 lg:-mt-10 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-2xl lg:max-w-5xl">
          {/*
            Mobile is one column in reading order: pitch → offer → terms.
            At lg the offer card moves into a sticky right rail. Explicit grid
            placement (col-start/row-start) does the move, so the card and all
            its subscribe/cancel states exist exactly once in the DOM rather
            than being duplicated and toggled per breakpoint.
          */}
          <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-x-10 lg:gap-y-8">
            {/* ── Pitch ── */}
            <div className="space-y-8 lg:col-start-1 lg:row-start-1">
              {/* Title + meta */}
              <div className="space-y-3 text-center lg:text-left">
                <Badge variant="paid" className="text-[11px]">
                  <Sparkles className="mr-1 h-3 w-3" /> Paid reading group
                </Badge>
                <h1 className="font-serif text-3xl font-bold tracking-[-0.4px] text-[var(--text-primary)] md:text-4xl">
                  {group.name}
                </h1>
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-[var(--text-secondary)] lg:justify-start">
                  <span className="inline-flex items-center gap-1.5">
                    {group.isPublic ? (
                      <Globe className="h-3.5 w-3.5" />
                    ) : (
                      <Lock className="h-3.5 w-3.5" />
                    )}
                    {group.isPublic ? 'Public group' : 'Private group'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {memberCount} {memberCount === 1 ? 'member' : 'members'}
                  </span>
                  {group.readingPace && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <Gauge className="h-3.5 w-3.5" />
                        {capitalize(group.readingPace)} pace
                      </span>
                    </>
                  )}
                </div>
                {group.description && (
                  <p className="mx-auto max-w-prose text-[15px] leading-relaxed text-[var(--text-secondary)] lg:mx-0">
                    {group.description}
                  </p>
                )}
              </div>

              {/* Currently reading */}
              {currentBook && (
                <div className="flex items-center gap-4 rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-4">
                  <div className="w-[52px] shrink-0">
                    <BookCover
                      title={currentBook.title}
                      author={currentBook.author}
                      src={currentBook.cover_image_url}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                      Currently Reading
                    </p>
                    <p className="truncate font-serif text-lg font-bold text-[var(--text-primary)]">
                      {currentBook.title}
                    </p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {currentBook.author}
                      {currentBook.total_chapters
                        ? ` · ${currentBook.total_chapters} chapters`
                        : ''}
                    </p>
                  </div>
                </div>
              )}

              {/* What you get — concrete, drawn from the group's real channels */}
              <section className="space-y-4">
                <h2 className="font-serif text-xl font-bold text-[var(--text-primary)]">
                  What your subscription includes
                </h2>

                {premiumChannels.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-[var(--border-main)] bg-[var(--surface)]">
                    <p className="border-b border-[var(--border-main)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                      {premiumChannels.length} member-only{' '}
                      {premiumChannels.length === 1 ? 'channel' : 'channels'}
                    </p>
                    {premiumChannels.map((c, i) => (
                      <div
                        key={c.name}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3',
                          i > 0 && 'border-t border-[var(--border-main)]',
                        )}
                      >
                        <Hash className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {c.name}
                        </span>
                        {c.isChapterGated && (
                          <Badge variant="neutral" className="ml-auto text-[10px]">
                            Chapter-gated
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {[
                    'Full access to this group’s member-only discussion channels',
                    'Spoiler-safe chat that unlocks as you finish each chapter',
                    'The group’s reading schedule, pace targets and progress tracking',
                    'Shared reading list and chapter-by-chapter discussion threads',
                    'Access continues for as long as your subscription is active',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--success)]/12 text-[var(--success)]">
                        <Check className="h-3 w-3" />
                      </span>
                      <span className="text-sm text-[var(--text-primary)]">{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-[var(--text-secondary)]">
                  This is a digital subscription to online content and community
                  access. Nothing is shipped, and books themselves are not included
                  — members supply their own copy of the book the group is reading.
                </p>
              </section>
            </div>

            {/* ── Offer: inline on mobile, sticky rail from lg up ── */}
            <aside className="lg:col-start-2 lg:row-start-1 lg:sticky lg:top-8">
              <section
                id="subscribe"
                className="rounded-2xl border border-primary/25 bg-primary/5 p-6 text-center"
              >
                <p className="font-serif text-4xl font-bold text-[var(--text-primary)]">
                  {price}
                  <span className="text-base font-normal text-[var(--text-secondary)]">
                    {' '}
                    USD / month
                  </span>
                </p>
                <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  Billed monthly and renews automatically until you cancel. Cancel
                  any time — you keep access through the end of the period you have
                  already paid for.
                </p>

                <div className="mt-5">
                  {viewer.isOwner ? (
                    <p className="text-sm font-medium text-[var(--text-secondary)]">
                      You own this group — no subscription needed.
                    </p>
                  ) : viewer.alreadySubscribed ? (
                    <div className="flex flex-col items-center gap-3">
                      {error && <p className="text-sm text-[var(--error)]">{error}</p>}

                      {cancelledAt !== null ? (
                        <>
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            Your subscription is set to cancel
                          </span>
                          <p className="max-w-sm text-[13px] text-[var(--text-secondary)]">
                            You won&apos;t be charged again.
                            {cancelledAt
                              ? ` You keep access until ${formatDate(cancelledAt)}.`
                              : ' You keep access until the end of the current billing period.'}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResume}
                            disabled={isPending}
                          >
                            {isPending && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Resume subscription
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--success)]">
                            <ShieldCheck className="h-5 w-5" /> You&apos;re subscribed
                          </span>
                          <Link
                            href={`/groups/${groupId}`}
                            className={buttonVariants({ size: 'sm' })}
                          >
                            Go to group
                          </Link>

                          {confirmingCancel ? (
                            <div className="w-full max-w-sm space-y-3 rounded-xl border border-[var(--border-main)] bg-[var(--surface)] p-4">
                              <p className="text-[13px] text-[var(--text-secondary)]">
                                Cancel your subscription to {group.name}? You
                                won&apos;t be charged again, and you keep access
                                until the end of the period you&apos;ve already paid
                                for. Payments already made are non-refundable.
                              </p>
                              <div className="flex justify-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setConfirmingCancel(false)}
                                  disabled={isPending}
                                >
                                  Keep it
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={handleCancel}
                                  disabled={isPending}
                                >
                                  {isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  Cancel subscription
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmingCancel(true)}
                              className="text-xs text-[var(--text-tertiary)] underline underline-offset-2 hover:text-[var(--text-secondary)]"
                            >
                              Cancel subscription
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  ) : !viewer.acceptingPayments ? (
                    <p className="text-sm text-[var(--text-secondary)]">
                      This group isn’t accepting subscriptions yet. Check back soon.
                    </p>
                  ) : !viewer.signedIn ? (
                    <Link
                      href={`/signin?redirect=${encodeURIComponent(
                        `/groups/${groupId}/subscribe`,
                      )}`}
                      className={cn(buttonVariants({ size: 'lg' }), 'w-full')}
                    >
                      Sign in to subscribe
                    </Link>
                  ) : (
                    <>
                      {error && (
                        <p className="mb-3 text-sm text-[var(--error)]">{error}</p>
                      )}
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={handleSubscribe}
                        disabled={isPending}
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Redirecting to checkout…
                          </>
                        ) : (
                          <>Subscribe — {price}/month</>
                        )}
                      </Button>
                    </>
                  )}
                </div>

                <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                  <Lock className="h-3 w-3" /> Payments processed securely by Stripe.
                  {LEGAL.entityName} never sees your card details.
                </p>
              </section>
            </aside>

            {/* ── Billing terms — the disclosures Stripe looks for ── */}
            <section className="space-y-3 rounded-2xl border border-[var(--border-main)] bg-[var(--surface-elevated)]/40 p-5 lg:col-start-1 lg:row-start-2">
              <h2 className="font-serif text-lg font-bold text-[var(--text-primary)]">
                Billing terms
              </h2>
              <dl className="space-y-2.5 text-sm">
                {[
                  [
                    'What you’re charged',
                    `${price} USD every month, starting on the day you subscribe.`,
                  ],
                  [
                    'Renewal',
                    'The subscription renews automatically each month on the same date until you cancel.',
                  ],
                  [
                    'Cancellation',
                    'Cancel at any time from your account settings or by emailing us. Your access continues until the end of the current billing period.',
                  ],
                  [
                    'Refunds',
                    'Payments are non-refundable, including partial months. Cancelling stops all future charges.',
                  ],
                  [
                    'Who you’re buying from',
                    `The subscription is sold by this group’s creator. ${LEGAL.entityName} operates the platform and collects payment on their behalf, retaining a ${PLATFORM_FEE_PERCENT}% platform fee.`,
                  ],
                  [
                    'Questions or problems',
                    `Email ${LEGAL.supportEmail} and we’ll respond within two business days.`,
                  ],
                ].map(([term, desc]) => (
                  <div key={term}>
                    <dt className="font-semibold text-[var(--text-primary)]">{term}</dt>
                    <dd className="text-[var(--text-secondary)]">{desc}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          {/* Footer — spans the full width beneath both columns */}
          <footer className="mt-8 space-y-3 border-t border-[var(--border-main)] pt-6 text-center">
            <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
              <Link href="/pricing" className="text-primary hover:underline">
                Pricing
              </Link>
              <Link href="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              <Link href="/refunds" className="text-primary hover:underline">
                Refund &amp; Cancellation Policy
              </Link>
            </nav>
            <p className="text-xs text-[var(--text-tertiary)]">
              {LEGAL.entityName} · Support:{' '}
              <a
                href={`mailto:${LEGAL.supportEmail}`}
                className="hover:underline"
              >
                {LEGAL.supportEmail}
              </a>
            </p>
          </footer>
        </div>
      </main>
    </div>
  )
}
