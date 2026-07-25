import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/queries'

export default async function JoinGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  const supabase = await createClient()
  const profile = await getProfile()

  // Must be signed in
  if (!profile) {
    redirect(`/signin?next=/join/${groupId}`)
  }

  // Validate group exists
  const { data: group } = await supabase
    .from('reading_groups')
    .select('id, name')
    .eq('id', groupId)
    .maybeSingle()

  if (!group) {
    redirect('/groups')
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('group_memberships')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', profile.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!existing) {
    // Auto-join
    await supabase.from('group_memberships').upsert(
      {
        group_id: groupId,
        user_id: profile.id,
        role: 'member',
        is_active: true,
        last_activity: new Date().toISOString(),
      },
      { onConflict: 'group_id,user_id' }
    )
  }

  redirect(`/groups/${groupId}`)
}
