import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSubscribedToGroup } from '@/lib/queries'
import { formatPrice } from '@/lib/stripe'
import { retrieveSubscriptionState } from '@/lib/stripe-server'
import { LEGAL } from '@/lib/legal'
import { SubscribeClient } from './subscribe-client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ groupId: string }>
}

/**
 * Public sales page for a paid reading group.
 *
 * This route deliberately lives outside the (app) route group: it renders with
 * no AppShell and no onboarding gate so that a signed-out visitor — including
 * a Stripe reviewer — sees the full offer, price and terms. `middleware.ts`
 * whitelists this exact path; see lib/supabase/proxy.ts.
 *
 * Because there may be no session, the group is read with the service-role
 * client. Only fields safe to show the public are selected — never member
 * identities or channel contents.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { groupId } = await params
  const { data: group } = await createAdminClient()
    .from('reading_groups')
    .select('name, description, is_paid, price')
    .eq('id', groupId)
    .maybeSingle()

  if (!group?.is_paid) return { title: `Subscribe · ${LEGAL.productName}` }

  return {
    title: `Join ${group.name} — ${formatPrice(group.price)}/month · ${LEGAL.productName}`,
    description:
      group.description ??
      `Subscribe to ${group.name}, a paid reading group on ${LEGAL.productName}.`,
  }
}

export default async function SubscribePage({ params }: PageProps) {
  const { groupId } = await params
  const admin = createAdminClient()

  const { data: group } = await admin
    .from('reading_groups')
    .select(
      'id, name, description, is_paid, is_public, price, reading_pace, banner_image_url, created_by, stripe_price_id, current_book:books(title, author, cover_image_url, total_chapters)',
    )
    .eq('id', groupId)
    .maybeSingle()

  if (!group) notFound()
  // Free groups have nothing to sell — send people to the group itself.
  if (!group.is_paid) redirect(`/groups/${groupId}`)

  const [{ count: memberCount }, { data: channels }, { data: payoutAccount }] =
    await Promise.all([
      admin
        .from('group_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', groupId)
        .eq('is_active', true),
      admin
        .from('group_channels')
        .select('name, is_premium, is_chapter_gated')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true }),
      admin
        .from('creator_payout_accounts')
        .select('stripe_account_id, onboarding_complete')
        .eq('user_id', group.created_by)
        .maybeSingle(),
    ])

  // Viewer state. `getUser()` returns null when signed out, which is expected
  // here rather than an error.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const alreadySubscribed = user ? await isSubscribedToGroup(groupId) : false
  const isOwner = Boolean(user) && group.created_by === user!.id

  // The creator must have finished Stripe Connect onboarding and have a price
  // before checkout can succeed — otherwise the CTA would throw on click.
  const acceptingPayments = Boolean(
    group.stripe_price_id && payoutAccount?.onboarding_complete,
  )

  // For subscribers, read the live Stripe state so the page can tell an active
  // subscription apart from one already scheduled to cancel. Stripe being
  // unreachable must not break this page, so failures degrade to "active".
  let pendingCancelAt: string | null = null
  if (alreadySubscribed && payoutAccount?.stripe_account_id) {
    const { data: sub } = await admin
      .from('group_subscribers')
      .select('stripe_subscription_id')
      .eq('subscriber_id', user!.id)
      .eq('group_id', groupId)
      .maybeSingle()

    if (sub?.stripe_subscription_id) {
      try {
        const state = await retrieveSubscriptionState({
          subscriptionId: sub.stripe_subscription_id,
          stripeAccountId: payoutAccount.stripe_account_id,
        })
        pendingCancelAt =
          state.cancelAtPeriodEnd && state.currentPeriodEnd
            ? new Date(state.currentPeriodEnd * 1000).toISOString()
            : null
      } catch (err) {
        console.error('Could not read Stripe subscription state:', err)
      }
    }
  }

  return (
    <SubscribeClient
      groupId={groupId}
      group={{
        name: group.name,
        description: group.description,
        price: group.price,
        readingPace: group.reading_pace,
        isPublic: group.is_public,
        bannerImageUrl: group.banner_image_url,
      }}
      currentBook={(group.current_book as any) ?? null}
      memberCount={memberCount ?? 0}
      channels={(channels ?? []).map((c) => ({
        name: c.name,
        isPremium: Boolean(c.is_premium),
        isChapterGated: Boolean(c.is_chapter_gated),
      }))}
      viewer={{
        signedIn: Boolean(user),
        alreadySubscribed,
        isOwner,
        acceptingPayments,
        pendingCancelAt,
      }}
    />
  )
}
