import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile, isSubscribedToGroup } from '@/lib/queries'
import { SubscribeClient } from './subscribe-client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ groupId: string }>
}

export default async function SubscribePage({ params }: PageProps) {
  const { groupId } = await params
  const supabase = await createClient()
  const profile = await getProfile()

  if (!profile) redirect('/signin')

  const { data: group } = await supabase
    .from('reading_groups')
    .select('*, current_book:books(*)')
    .eq('id', groupId)
    .maybeSingle()

  if (!group) redirect('/groups')
  if (!group.is_paid) redirect(`/groups/${groupId}`)

  const alreadySubscribed = await isSubscribedToGroup(groupId)

  const { count: memberCount } = await supabase
    .from('group_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('is_active', true)

  return (
    <SubscribeClient
      groupId={groupId}
      group={{
        name: group.name,
        reading_pace: group.reading_pace,
        is_public: group.is_public,
        price: group.price,
        invite_code: group.invite_code,
      }}
      currentBook={group.current_book as any}
      memberCount={memberCount ?? 0}
      alreadySubscribed={alreadySubscribed}
    />
  )
}
