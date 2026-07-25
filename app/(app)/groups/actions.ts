'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createGroupCheckoutSession } from '@/lib/stripe'
import { redirect } from 'next/navigation'

// ── Group Creation ─────────────────────────────────────────────────────────

export async function createGroup(formData: {
  name: string
  readingPace: string
  isPublic: boolean
  isPaid: boolean
  price: number | null
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
      is_paid: formData.isPaid,
      price: formData.isPaid ? formData.price : null,
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
  return { groupId: group.id }
}

// ── Join with Invite Code ──────────────────────────────────────────────────

export async function joinGroupWithCode(code: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: group } = await supabase
    .from('reading_groups')
    .select('id, is_paid')
    .eq('invite_code', code.trim().toUpperCase())
    .maybeSingle()

  if (!group) return { error: 'Invalid invite code. Please check and try again.' }

  // Check already a member
  const { data: existing } = await supabase
    .from('group_memberships')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (existing) return { groupId: group.id, alreadyMember: true }

  // For paid groups, redirect to subscribe page
  if (group.is_paid) {
    return { groupId: group.id, requiresSubscription: true }
  }

  // Join free group
  const { error } = await supabase.from('group_memberships').upsert(
    {
      group_id: group.id,
      user_id: user.id,
      role: 'member',
      is_active: true,
      last_activity: new Date().toISOString(),
    },
    { onConflict: 'group_id,user_id' }
  )

  if (error) return { error: error.message }

  revalidatePath('/groups')
  return { groupId: group.id }
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

  const { error } = await supabase
    .from('reading_groups')
    .update(payload)
    .eq('id', groupId)
    .eq('created_by', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/groups/${groupId}`)
  revalidatePath(`/groups/${groupId}/manage`)
  revalidatePath('/groups')
  return { success: true }
}

// ── Channel Management ─────────────────────────────────────────────────────

export async function createChannel(groupId: string, name: string, isChapterGated: boolean) {
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
  })

  if (error) return { error: error.message }
  revalidatePath(`/groups/${groupId}`)
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
  parentMessageId: string | null = null,
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

  if (parentMessageId) {
    insertData.parent_message_id = parentMessageId
  }

  const { error } = await supabase.from('channel_messages').insert(insertData)

  if (error) return { error: error.message }
  return { success: true }
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
    .select('stripe_price_id')
    .eq('id', groupId)
    .maybeSingle()

  const session = await createGroupCheckoutSession({
    groupId,
    priceId: group?.stripe_price_id ?? null,
    subscriberId: user.id,
  })

  // For the placeholder, record an active subscription directly
  const { error: subError } = await supabase.from('group_subscriptions').upsert(
    {
      subscriber_id: user.id,
      group_id: groupId,
      status: 'active',
      stripe_subscription_id: session.sessionId,
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: 'subscriber_id,group_id' },
  )

  if (subError) return { error: subError.message }

  // Also join group_memberships
  await supabase.from('group_memberships').upsert(
    {
      group_id: groupId,
      user_id: user.id,
      role: 'member',
      is_active: true,
      last_activity: new Date().toISOString(),
    },
    { onConflict: 'group_id,user_id' }
  )

  revalidatePath(`/groups/${groupId}`)
  revalidatePath('/groups')
  return { success: true, groupId }
}
