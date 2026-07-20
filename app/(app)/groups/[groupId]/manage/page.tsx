import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/queries'
import { PageHeader } from '@/components/page-header'
import { ManageClient } from './manage-client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ groupId: string }>
}

export default async function ManagePage({ params }: PageProps) {
  const { groupId } = await params
  const supabase = await createClient()
  const profile = await getProfile()

  if (!profile) redirect('/signin')

  // Only admin / creator can access
  const { data: group } = await supabase
    .from('reading_groups')
    .select('*, current_book:books(*)')
    .eq('id', groupId)
    .maybeSingle()

  if (!group) redirect('/groups')
  if (group.created_by !== profile.id) {
    // Check if admin role
    const { data: membership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', profile.id)
      .maybeSingle()

    if (membership?.role !== 'admin') redirect(`/groups/${groupId}`)
  }

  const { data: channels } = await supabase
    .from('group_channels')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })

  const { data: members } = await supabase
    .from('group_members')
    .select('role, user:users(id, username, display_name)')
    .eq('group_id', groupId)

  const { count: unread } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)

  return (
    <div className="pb-10">
      <PageHeader
        title="Manage Group"
        subtitle={`Settings for ${group.name}`}
        unread={unread ?? 0}
      />
      <ManageClient
        groupId={groupId}
        group={{
          name: group.name,
          reading_pace: group.reading_pace,
          is_public: group.is_public,
          invite_code: group.invite_code,
          current_book_id: group.current_book_id,
        }}
        channels={channels ?? []}
        members={(members ?? []) as any}
        currentBook={group.current_book as any}
      />
    </div>
  )
}
