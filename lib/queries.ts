import { createClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/lib/types'

/** Returns the authenticated auth user, or null. */
export async function getAuthUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

/** Returns the public.users profile row for the current session, or null. */
export async function getProfile(): Promise<UserProfile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  return data as UserProfile | null
}

/** True if the current user has an active subscription to the given group. */
export async function isSubscribedToGroup(groupId: string): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase
    .from('group_subscribers')
    .select('id')
    .eq('subscriber_id', user.id)
    .eq('group_id', groupId)
    .eq('status', 'active')
    .maybeSingle()
  return Boolean(data)
}

/**
 * Subscription statuses that still grant premium access.
 *
 * The Stripe webhook writes Stripe's status verbatim, so a failed renewal
 * lands as `past_due` while dunning retries for ~2 weeks. That member is still
 * paying and has not cancelled, so they keep access; when Stripe gives up the
 * status becomes `unpaid` or `canceled` and access ends.
 *
 * Must match `status in (...)` in public.has_group_premium_access().
 */
const PREMIUM_ACCESS_STATUSES = ['active', 'trialing', 'past_due'] as const

/**
 * True if the current user may see this group's premium channels.
 *
 * Mirrors public.has_group_premium_access() in the database — if you change
 * one, change the other. RLS is the real gate (the restrictive policies added
 * by migration `premium_channel_rls`); this exists so server components can
 * decide what to render without discovering access by getting back no rows.
 *
 * Note this is deliberately broader than isSubscribedToGroup: an owner or an
 * admin/moderator has premium access without being a paying subscriber, and a
 * subscriber mid-dunning still has access. Use isSubscribedToGroup for billing
 * UI, where the strict 'active' distinction matters.
 */
export async function hasGroupPremiumAccess(groupId: string): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data: group } = await supabase
    .from('reading_groups')
    .select('created_by')
    .eq('id', groupId)
    .maybeSingle()
  if (group?.created_by === user.id) return true

  const { data: membership } = await supabase
    .from('group_memberships')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (membership?.role === 'admin' || membership?.role === 'moderator') return true

  const { data: subscription } = await supabase
    .from('group_subscribers')
    .select('id')
    .eq('subscriber_id', user.id)
    .eq('group_id', groupId)
    .in('status', PREMIUM_ACCESS_STATUSES as unknown as string[])
    .maybeSingle()
  return Boolean(subscription)
}
