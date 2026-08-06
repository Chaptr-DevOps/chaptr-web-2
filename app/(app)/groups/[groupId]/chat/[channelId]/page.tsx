import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile, hasGroupPremiumAccess } from '@/lib/queries'
import { isUuid } from '@/lib/route-params'
import { ChatClient } from './chat-client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ groupId: string; channelId: string }>
}

export default async function ChatPage({ params }: PageProps) {
  const { groupId, channelId } = await params
  if (!isUuid(groupId)) redirect('/groups')
  if (!isUuid(channelId)) redirect(`/groups/${groupId}`)
  const supabase = await createClient()
  const profile = await getProfile()

  if (!profile) redirect('/signin')

  // Verify membership
  const { data: membership } = await supabase
    .from('group_memberships')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', profile.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) redirect(`/groups/${groupId}`)

  // Fetch the group
  const { data: group } = await supabase
    .from('reading_groups')
    .select('name, current_book_id, created_by, is_paid')
    .eq('id', groupId)
    .maybeSingle()

  if (!group) redirect('/groups')

  // Fetch channel info
  const { data: channel } = await supabase
    .from('group_channels')
    .select('*')
    .eq('id', channelId)
    .eq('group_id', groupId)
    .maybeSingle()

  if (!channel) redirect(`/groups/${groupId}`)

  // Premium gate — enforced here, not just in the group page's channel list,
  // so a premium channel can't be reached by deep-linking to its URL. The same
  // predicate is enforced in the database by the restrictive RLS policies from
  // migration `premium_channel_rls`; this check produces the redirect rather
  // than an empty page.
  const hasPremiumAccess = await hasGroupPremiumAccess(groupId)

  if (channel.is_premium && !hasPremiumAccess) {
    redirect(`/groups/${groupId}/subscribe`)
  }

  // Fetch all channels in this group for sidebar
  const { data: rawChannels } = await supabase
    .from('group_channels')
    .select('id, name, channel_type, is_premium')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })

  // Don't advertise channels the viewer can't open
  const allChannels = (rawChannels ?? []).filter((c) => hasPremiumAccess || !c.is_premium)

  // Fetch user's current chapter for this group's book
  const { data: myProgress } = group.current_book_id
    ? await supabase
        .from('reading_progress')
        .select('current_chapter')
        .eq('user_id', profile.id)
        .eq('book_id', group.current_book_id)
        .maybeSingle()
    : { data: null }

  // Chapters *completed*, not the chapter in progress — matches the mobile app
  // (GroupChatScreen.tsx: `Math.max((currentChapter ?? 1) - 1, 0)`). Reading
  // chapter 5 means you've finished 4, so chapter-5 talk is still a spoiler.
  const myCurrentChapter = Math.max((myProgress?.current_chapter ?? 1) - 1, 0)

  // Fetch messages, chapter-gated logic applied server-side
  let messagesQuery = supabase
    .from('channel_messages')
    .select('id, content, is_spoiler_gated, chapter_number, created_at, user_id, reply_to_message_id')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true })
    .limit(100)

  // If chapter-gated, only show messages at or below the user's progress.
  // Deliberately a plain .lte, matching mobile's getChannelMessages: an unstamped
  // (null) message is NOT visible here. The old `chapter_number.is.null` escape
  // hatch let every web-written message bypass the gate entirely.
  if (channel.is_chapter_gated) {
    messagesQuery = messagesQuery.lte('chapter_number', myCurrentChapter)
  }

  const { data: rawMessages } = await messagesQuery

  // Fetch author profiles for all unique user_ids in messages
  const userIds = [...new Set((rawMessages ?? []).map((m) => m.user_id))]
  const { data: authors } = userIds.length
    ? await supabase
        .from('users')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds)
    : { data: [] }

  // Fetch membership roles for these users in this group
  const { data: memberships } = userIds.length
    ? await supabase
        .from('group_memberships')
        .select('user_id, role')
        .eq('group_id', groupId)
        .in('user_id', userIds)
    : { data: [] }

  // Fetch reactions for these messages
  const messageIds = (rawMessages ?? []).map((m) => m.id)
  const { data: rawReactions } = messageIds.length
    ? await supabase
        .from('channel_message_reactions')
        .select('message_id, reaction_type, user_id')
        .in('message_id', messageIds)
    : { data: null } // using null or empty array safely

  const reactionMap = new Map<string, Array<{ reaction_type: string; user_id: string }>>()
  if (rawReactions) {
    for (const r of rawReactions) {
      if (!reactionMap.has(r.message_id)) {
        reactionMap.set(r.message_id, [])
      }
      reactionMap.get(r.message_id)!.push({
        reaction_type: r.reaction_type,
        user_id: r.user_id,
      })
    }
  }

  const membershipMap = new Map((memberships ?? []).map((m) => [m.user_id, m.role]))
  const authorMap = new Map((authors ?? []).map((a) => [a.id, a]))
  const messages = (rawMessages ?? []).map((m) => ({
    ...m,
    author: authorMap.get(m.user_id)
      ? {
          ...authorMap.get(m.user_id)!,
          role: membershipMap.get(m.user_id) || 'member',
          is_creator: group?.created_by === m.user_id,
        }
      : undefined,
    reactions: reactionMap.get(m.id) || [],
  }))

  return (
    <ChatClient
      groupId={groupId}
      groupName={group.name}
      channel={channel}
      channels={allChannels}
      initialMessages={messages}
      myUserId={profile.id}
      myCurrentChapter={myCurrentChapter}
    />
  )
}
