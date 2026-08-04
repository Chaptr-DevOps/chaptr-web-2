import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/queries'
import { isUuid } from '@/lib/route-params'
import { PageHeader } from '@/components/page-header'
import { ManageClient } from './manage-client'

export const dynamic = 'force-dynamic'

const TABS = ['general', 'channels', 'members', 'monetization'] as const
type ManageTab = (typeof TABS)[number]

interface PageProps {
  params: Promise<{ groupId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function ManagePage({ params, searchParams }: PageProps) {
  const { groupId } = await params
  if (!isUuid(groupId)) redirect('/groups')
  const { tab } = await searchParams
  const initialTab: ManageTab = TABS.includes(tab as ManageTab)
    ? (tab as ManageTab)
    : 'general'
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
      .from('group_memberships')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', profile.id)
      .eq('is_active', true)
      .maybeSingle()

    if (membership?.role !== 'admin') redirect(`/groups/${groupId}`)
  }

  const { data: channels } = await supabase
    .from('group_channels')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })

  const { data: members } = await supabase
    .from('group_memberships')
    .select('role, user:users(id, username, display_name)')
    .eq('group_id', groupId)
    .eq('is_active', true)

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
        initialTab={initialTab}
        group={{
          name: group.name,
          reading_pace: group.reading_pace,
          is_public: group.is_public,
          invite_code: group.invite_code,
          current_book_id: group.current_book_id,
          is_paid: group.is_paid,
          price: group.price,
          banner_image_url: group.banner_image_url,
        }}
        isCreator={group.created_by === profile.id}
        channels={channels ?? []}
        members={(members ?? []) as any}
        currentBook={group.current_book as any}
      />
    </div>
  )
}
