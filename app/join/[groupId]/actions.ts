'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Joins the current user to a group. Split out of the old auto-joining
 * `/join/[groupId]` page so the route can render a preview first and only
 * write when the user actually presses Join.
 *
 * Idempotent: re-joining a group you left flips `is_active` back on rather
 * than erroring on the (group_id, user_id) unique constraint.
 */
export async function joinGroupAction(groupId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: group } = await supabase
    .from('reading_groups')
    .select('id')
    .eq('id', groupId)
    .maybeSingle()

  if (!group) return { error: 'This group no longer exists.' }

  // Paid groups are freemium: joining is free and a subscription unlocks the
  // channels the creator marked premium, so there is no paywall on this write.
  const { error } = await supabase.from('group_memberships').upsert(
    {
      group_id: groupId,
      user_id: user.id,
      role: 'member',
      is_active: true,
      last_activity: new Date().toISOString(),
    },
    { onConflict: 'group_id,user_id' },
  )

  if (error) return { error: error.message }

  revalidatePath('/groups')
  revalidatePath(`/groups/${groupId}`)
  return { success: true }
}
