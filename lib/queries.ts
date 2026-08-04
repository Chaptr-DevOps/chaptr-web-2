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
