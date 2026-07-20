'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, Check, Lock, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookCover } from '@/components/book-cover'
import { startSubscribeCheckout } from '../../actions'
import { formatPrice } from '@/lib/stripe'
import { cn } from '@/lib/utils'

interface SubscribeClientProps {
  groupId: string
  group: {
    name: string
    reading_pace: string | null
    is_public: boolean
    price: number | null
    invite_code: string | null
  }
  currentBook: {
    title: string
    author: string | null
    cover_image_url: string | null
  } | null
  memberCount: number
  alreadySubscribed: boolean
}

export function SubscribeClient({
  groupId,
  group,
  currentBook,
  memberCount,
  alreadySubscribed,
}: SubscribeClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleSubscribe() {
    setError('')
    startTransition(async () => {
      const res = await startSubscribeCheckout(groupId)
      if (res.error) {
        setError(res.error)
      } else {
        router.push(`/groups/${groupId}`)
        router.refresh()
      }
    })
  }

  const perks = [
    'Access all group channels & discussions',
    'Chapter-gated spoiler-safe chat',
    'Premium books & reading content',
    'Member-only reading schedule & pace tools',
    'Cancel anytime',
  ]

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Back link */}
        <Link
          href={`/groups/${groupId}`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mb-6 -ml-2')}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Group
        </Link>

        <Card className="overflow-hidden border-primary/20 shadow-xl">
          {/* Header gradient */}
          <div className="bg-gradient-to-br from-primary to-primary/70 px-6 py-8 text-[var(--interactive-primary-foreground)]">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5" />
              <Badge className="bg-white/20 text-white border-0 text-xs">Premium Group</Badge>
            </div>
            <h1 className="font-serif text-3xl font-bold leading-tight mb-2">{group.name}</h1>
            <p className="text-[var(--interactive-primary-foreground)]/80 text-sm">
              {memberCount} members · {group.reading_pace ?? 'flexible'} pace
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Current book */}
            {currentBook && (
              <div className="flex gap-4 items-center p-3 rounded-xl border border-[var(--border-main)] bg-[var(--surface-elevated)]/40">
                <div className="w-14 shrink-0">
                  <BookCover
                    title={currentBook.title}
                    author={currentBook.author}
                    src={currentBook.cover_image_url}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[var(--text-tertiary)] font-semibold mb-0.5">Currently Reading</p>
                  <p className="font-serif font-bold text-[var(--text-primary)] line-clamp-1">
                    {currentBook.title}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">{currentBook.author}</p>
                </div>
              </div>
            )}

            {/* Perks list */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                What&apos;s included
              </p>
              {perks.map((perk) => (
                <div key={perk} className="flex items-start gap-2.5">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--success)]/12 text-[var(--success)] mt-0.5">
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="text-sm text-[var(--text-primary)]">{perk}</span>
                </div>
              ))}
            </div>

            {/* Price + CTA */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center">
              <p className="text-3xl font-bold font-serif text-[var(--text-primary)]">
                {formatPrice(group.price)}
                <span className="text-base font-normal text-[var(--text-secondary)]">/month</span>
              </p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1 mb-4">
                Billed monthly. Cancel anytime.
              </p>

              {alreadySubscribed ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="inline-flex items-center gap-2 text-[var(--success)] font-semibold text-sm">
                    <ShieldCheck className="h-5 w-5" /> You&apos;re already subscribed
                  </div>
                  <Link
                    href={`/groups/${groupId}`}
                    className={buttonVariants({ size: 'sm' })}
                  >
                    Back to Group
                  </Link>
                </div>
              ) : (
                <>
                  {error && (
                    <p className="text-sm text-[var(--error)] mb-3">{error}</p>
                  )}
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleSubscribe}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Subscribe for {formatPrice(group.price)}/mo
                      </>
                    )}
                  </Button>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-3 flex items-center justify-center gap-1">
                    <Lock className="h-3 w-3" /> Secure payment via Stripe
                  </p>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
