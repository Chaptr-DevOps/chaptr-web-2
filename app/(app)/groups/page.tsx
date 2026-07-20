import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/queries'
import { PageHeader } from '@/components/page-header'
import { GroupsClient } from './groups-client'
import type { ReadingGroup } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function GroupsPage() {
  const supabase = await createClient()
  const profile = await getProfile()

  const { count: unread } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)

  // Fetch groups the user is a member of
  const { data: memberRows } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', profile?.id ?? '')

  const myGroupIds = (memberRows ?? []).map((r) => r.group_id)

  // Fetch those groups with member counts and current book
  const { data: myGroupsRaw } = myGroupIds.length
    ? await supabase
        .from('reading_groups')
        .select('*, current_book:books(title)')
        .in('id', myGroupIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  // Fetch public groups not already joined
  const { data: publicGroupsRaw } = await supabase
    .from('reading_groups')
    .select('*, current_book:books(title)')
    .eq('is_public', true)
    .not('id', 'in', myGroupIds.length ? `(${myGroupIds.join(',')})` : '(null)')
    .order('created_at', { ascending: false })
    .limit(30)

  // Fetch member counts for all relevant groups
  const allGroupIds = [
    ...(myGroupsRaw ?? []).map((g) => g.id),
    ...(publicGroupsRaw ?? []).map((g) => g.id),
  ]

  const { data: memberCounts } = allGroupIds.length
    ? await supabase
        .from('group_members')
        .select('group_id')
        .in('group_id', allGroupIds)
    : { data: [] }

  const countMap = new Map<string, number>()
  for (const row of memberCounts ?? []) {
    countMap.set(row.group_id, (countMap.get(row.group_id) ?? 0) + 1)
  }

  function enrichGroup(g: any) {
    return {
      ...g,
      memberCount: countMap.get(g.id) ?? 0,
      bookTitle: g.current_book?.title ?? null,
    }
  }

  const myGroups = (myGroupsRaw ?? []).map(enrichGroup)
  const publicGroups = (publicGroupsRaw ?? []).map(enrichGroup)

  return (
    <div className="pb-10">
      <PageHeader
        title="Groups"
        subtitle="Join a reading club or create your own."
        unread={unread ?? 0}
      />
      <GroupsClient myGroups={myGroups} publicGroups={publicGroups} />
    </div>
  )
}
