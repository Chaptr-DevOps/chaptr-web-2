'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import {
  cancelSubscriptionAtPeriodEnd,
  createGroupCheckoutSession,
  resumeSubscription,
} from '@/lib/stripe-server'
import { redirect } from 'next/navigation'

// ── Group Creation ─────────────────────────────────────────────────────────

export async function createGroup(formData: {
  name: string
  readingPace: string
  isPublic: boolean
  isPaid: boolean
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Generate a short invite code
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

  const { data: group, error } = await supabase
    .from('reading_groups')
    .insert({
      name: formData.name.trim(),
      created_by: user.id,
      reading_pace: formData.readingPace,
      is_public: formData.isPublic,
      // Monetization is never enabled here. A price requires a Stripe Price
      // object, which requires a completed Connect account the creator almost
      // certainly does not have yet — writing is_paid without stripe_price_id
      // produces a group that presents as paid and cannot take payment.
      // setGroupPaid owns this transition.
      is_paid: false,
      price: null,
      invite_code: inviteCode,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Auto-join creator as admin
  await supabase.from('group_memberships').insert({
    group_id: group.id,
    user_id: user.id,
    role: 'admin',
    is_active: true,
    last_activity: new Date().toISOString(),
  })

  // Create default channels
  await supabase.from('group_channels').insert([
    { group_id: group.id, name: 'general', channel_type: 'general', is_chapter_gated: false },
    { group_id: group.id, name: 'currently-reading', channel_type: 'currently_reading', is_chapter_gated: true },
  ])

  revalidatePath('/groups')
  return { groupId: group.id, wantsPremium: Boolean(formData.isPaid) }
}

// ── Resolve Invite Code ────────────────────────────────────────────────────

/**
 * Looks up the group behind an invite code. Deliberately does NOT join — the
 * caller sends the user to `/join/[groupId]`, which previews the group and
 * joins only on an explicit press. `alreadyMember` lets callers skip the
 * preview, though `/join/[groupId]` redirects members away anyway.
 */
export async function resolveInviteCode(code: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: group } = await supabase
    .from('reading_groups')
    .select('id')
    .eq('invite_code', code.trim().toUpperCase())
    .maybeSingle()

  if (!group) return { error: 'Invalid invite code. Please check and try again.' }

  const { data: existing } = await supabase
    .from('group_memberships')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  return { groupId: group.id, alreadyMember: Boolean(existing) }
}

// ── Leave Group ────────────────────────────────────────────────────────────

export async function leaveGroup(groupId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('group_memberships')
    .update({ is_active: false })
    .eq('group_id', groupId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/groups')
  return { success: true }
}

// ── Update Group Settings ──────────────────────────────────────────────────

export async function updateGroup(
  groupId: string,
  updates: {
    name?: string
    readingPace?: string
    isPublic?: boolean
    currentBookId?: string | null
  },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const payload: Record<string, any> = {}
  if (updates.name !== undefined) payload.name = updates.name.trim()
  if (updates.readingPace !== undefined) payload.reading_pace = updates.readingPace
  if (updates.isPublic !== undefined) payload.is_public = updates.isPublic
  if (updates.currentBookId !== undefined) payload.current_book_id = updates.currentBookId

  const { data, error } = await supabase
    .from('reading_groups')
    .update(payload)
    .eq('id', groupId)
    .eq('created_by', user.id)
    .select('id')

  if (error) return { error: error.message }
  // The `created_by` filter means a non-owner admin matches zero rows — surface
  // that instead of reporting a save that never happened.
  if (!data?.length) return { error: 'Only the group creator can change these settings.' }

  revalidatePath(`/groups/${groupId}`)
  revalidatePath(`/groups/${groupId}/manage`)
  revalidatePath('/groups')
  return { success: true }
}

/**
 * Set the group's current book from a catalog search result, registering the
 * book in `books` first if we've never seen that title/author before.
 */
export async function setGroupCurrentBook(
  groupId: string,
  book: { title: string; author: string | null; coverImageUrl: string | null },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const title = book.title.trim()
  if (!title) return { error: 'Book title is required' }
  const author = book.author?.trim() || null

  const lookup = supabase.from('books').select('id').eq('title', title).limit(1)
  const { data: existing } = await (author
    ? lookup.eq('author', author)
    : lookup.is('author', null)
  ).maybeSingle()

  let bookId = existing?.id
  if (!bookId) {
    const { data: created, error: insertError } = await supabase
      .from('books')
      .insert({ title, author, cover_image_url: book.coverImageUrl })
      .select('id')
      .single()
    if (insertError) return { error: insertError.message }
    bookId = created.id
  }

  return updateGroup(groupId, { currentBookId: bookId })
}

/**
 * Start reading the group's current book. Progress is one row per (user, book)
 * — shared with Home and Library — so this either revives an existing row or
 * creates a fresh one at chapter 0.
 *
 * `totalChapters` is the book's chapter count (asked only when we don't already
 * know it), not a starting position.
 */
export async function startReadingGroupBook(
  groupId: string,
  bookId: string,
  totalChapters?: number,
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: membership } = await supabase
    .from('group_memberships')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) return { error: 'Join this group before starting the book.' }

  if (totalChapters !== undefined) {
    if (!totalChapters || totalChapters <= 0 || totalChapters > 200) {
      return { error: 'Please enter a valid number of chapters (1-200)' }
    }
    await supabase.from('books').update({ total_chapters: totalChapters }).eq('id', bookId)
  }

  // Take the oldest row rather than `.maybeSingle()` — a user can legitimately
  // have more than one row for a book (e.g. a stale group-scoped row).
  const { data: existingRows } = await supabase
    .from('reading_progress')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('book_id', bookId)
    .order('created_at', { ascending: true })
    .limit(1)

  const existing = existingRows?.[0]

  if (existing) {
    // Already tracking it — just make sure it's active again.
    if (existing.status !== 'reading') {
      const { error } = await supabase
        .from('reading_progress')
        .update({ status: 'reading' })
        .eq('id', existing.id)
        .eq('user_id', user.id)
      if (error) return { error: error.message }
    }
  } else {
    const { error } = await supabase.from('reading_progress').insert({
      user_id: user.id,
      book_id: bookId,
      status: 'reading',
      current_chapter: 0,
      progress_percentage: 0,
      ...(totalChapters ? { total_chapters: totalChapters } : {}),
    })
    if (error) return { error: error.message }
  }

  revalidatePath(`/groups/${groupId}`)
  revalidatePath('/home')
  revalidatePath('/library')
  return { success: true }
}

// ── Channel Management ─────────────────────────────────────────────────────

export async function createChannel(
  groupId: string,
  name: string,
  isChapterGated: boolean,
  isPremium = false,
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('group_channels').insert({
    group_id: groupId,
    name: name.trim().toLowerCase().replace(/\s+/g, '-'),
    channel_type: 'custom',
    is_chapter_gated: isChapterGated,
    is_premium: isPremium,
  })

  if (error) return { error: error.message }
  revalidatePath(`/groups/${groupId}`)
  revalidatePath(`/groups/${groupId}/manage`)
  return { success: true }
}

/**
 * Toggle whether a channel sits behind the group's subscription.
 * RLS (`channels_manage`) restricts this to the group's creator.
 */
export async function setChannelPremium(
  channelId: string,
  groupId: string,
  isPremium: boolean,
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('group_channels')
    .update({ is_premium: isPremium })
    .eq('id', channelId)
    .eq('group_id', groupId)
    .select('id')

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Only the group creator can change channel access.' }

  revalidatePath(`/groups/${groupId}`)
  revalidatePath(`/groups/${groupId}/manage`)
  return { success: true }
}

export async function deleteChannel(channelId: string, groupId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('group_channels')
    .delete()
    .eq('id', channelId)

  if (error) return { error: error.message }
  revalidatePath(`/groups/${groupId}`)
  return { success: true }
}

// ── Send Message ───────────────────────────────────────────────────────────

export async function sendMessage(
  channelId: string,
  content: string,
  isSpoilerGated: boolean,
  chapterNumber: number | null,
  replyToMessageId: string | null = null,
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const insertData: any = {
    channel_id: channelId,
    user_id: user.id,
    content: content.trim(),
    is_spoiler_gated: isSpoilerGated,
    chapter_number: chapterNumber,
  }

  if (replyToMessageId) {
    insertData.reply_to_message_id = replyToMessageId
  }

  // Return the inserted row so the client can swap its optimistic placeholder
  // for the real message (real id + server timestamp) without a refetch.
  const { data, error } = await supabase
    .from('channel_messages')
    .insert(insertData)
    .select('id, content, is_spoiler_gated, chapter_number, created_at, user_id, reply_to_message_id')
    .single()

  if (error) return { error: error.message }
  return { success: true, message: data }
}

// ── Kick Member ────────────────────────────────────────────────────────────

export async function kickMember(groupId: string, targetUserId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('group_memberships')
    .update({ is_active: false })
    .eq('group_id', groupId)
    .eq('user_id', targetUserId)

  if (error) return { error: error.message }

  revalidatePath(`/groups/${groupId}/manage`)
  return { success: true }
}

// ── Start Checkout Session (Stripe) ───────────────────────────────────────

export async function startSubscribeCheckout(groupId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: group } = await supabase
    .from('reading_groups')
    .select('is_paid, stripe_price_id, created_by')
    .eq('id', groupId)
    .maybeSingle()

  if (!group?.is_paid || !group.stripe_price_id) {
    return { error: 'This group has not set up a paid plan yet' }
  }

  // Read the *owner's* payout account with the service-role client: RLS on
  // creator_payout_accounts is owner-only, so the subscriber's own client
  // would always see null here.
  const { data: payoutAccount } = await createAdminClient()
    .from('creator_payout_accounts')
    .select('stripe_account_id, onboarding_complete')
    .eq('user_id', group.created_by)
    .maybeSingle()

  if (!payoutAccount?.stripe_account_id || !payoutAccount.onboarding_complete) {
    return { error: 'The group owner has not finished connecting Stripe yet' }
  }

  let url: string
  try {
    const session = await createGroupCheckoutSession({
      groupId,
      userId: user.id,
      priceId: group.stripe_price_id,
      stripeAccountId: payoutAccount.stripe_account_id,
    })
    url = session.url
  } catch (err: any) {
    return { error: err.message }
  }

  // group_subscriptions / group_memberships are granted by the
  // checkout.session.completed webhook once payment succeeds — see
  // app/api/webhooks/stripe/route.ts.
  redirect(url)
}

/**
 * Resolves the caller's Stripe subscription for a group, together with the
 * connected account it lives on. Shared by the cancel/resume actions.
 */
async function loadOwnSubscription(groupId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }

  const { data: sub } = await supabase
    .from('group_subscribers')
    .select('stripe_subscription_id, status')
    .eq('subscriber_id', user.id)
    .eq('group_id', groupId)
    .maybeSingle()

  if (!sub?.stripe_subscription_id) {
    return { error: 'No active subscription found for this group' as const }
  }

  const admin = createAdminClient()
  const { data: group } = await admin
    .from('reading_groups')
    .select('created_by')
    .eq('id', groupId)
    .maybeSingle()
  if (!group) return { error: 'Group not found' as const }

  // The subscription lives on the creator's connected account, and RLS on
  // creator_payout_accounts is owner-only — read it with the service role.
  const { data: payoutAccount } = await admin
    .from('creator_payout_accounts')
    .select('stripe_account_id')
    .eq('user_id', group.created_by)
    .maybeSingle()

  if (!payoutAccount?.stripe_account_id) {
    return { error: 'This group is not connected to Stripe' as const }
  }

  return {
    subscriptionId: sub.stripe_subscription_id,
    stripeAccountId: payoutAccount.stripe_account_id,
  }
}

/**
 * Self-service cancellation, as promised on /refunds and the subscribe page:
 * stops future charges and leaves access in place until the paid-for period
 * ends. Access is revoked by the customer.subscription.deleted webhook.
 */
export async function cancelGroupSubscription(groupId: string) {
  const loaded = await loadOwnSubscription(groupId)
  if ('error' in loaded) return { error: loaded.error }

  try {
    const { currentPeriodEnd } = await cancelSubscriptionAtPeriodEnd(loaded)
    revalidatePath(`/groups/${groupId}`)
    revalidatePath(`/groups/${groupId}/subscribe`)
    return {
      success: true as const,
      accessEndsAt: currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000).toISOString()
        : null,
    }
  } catch (err: any) {
    return { error: err.message as string }
  }
}

/** Undoes a pending cancellation while the subscription is still active. */
export async function resumeGroupSubscription(groupId: string) {
  const loaded = await loadOwnSubscription(groupId)
  if ('error' in loaded) return { error: loaded.error }

  try {
    await resumeSubscription(loaded)
    revalidatePath(`/groups/${groupId}`)
    revalidatePath(`/groups/${groupId}/subscribe`)
    return { success: true as const }
  } catch (err: any) {
    return { error: err.message as string }
  }
}
