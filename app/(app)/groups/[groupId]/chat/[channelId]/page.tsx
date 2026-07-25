import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/queries'
import { ChatClient } from './chat-client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ groupId: string; channelId: string }>
}

export default async function ChatPage({ params }: PageProps) {
  const { groupId, channelId } = await params
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
    .select('name, current_book_id, created_by')
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

  // Fetch all channels in this group for sidebar
  const { data: allChannels } = await supabase
    .from('group_channels')
    .select('id, name, channel_type')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })

  // Fetch user's current chapter for this group's book
  const { data: myProgress } = group.current_book_id
    ? await supabase
        .from('reading_progress')
        .select('current_chapter')
        .eq('user_id', profile.id)
        .eq('book_id', group.current_book_id)
        .maybeSingle()
    : { data: null }

  const myCurrentChapter = myProgress?.current_chapter ?? 0

  // Fetch messages, chapter-gated logic applied server-side
  let messagesQuery = supabase
    .from('channel_messages')
    .select('id, content, is_spoiler_gated, chapter_number, created_at, user_id, parent_message_id')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true })
    .limit(100)

  // If chapter-gated, only show messages from chapters <= user's current chapter
  if (channel.is_chapter_gated) {
    messagesQuery = messagesQuery.or(
      `chapter_number.is.null,chapter_number.lte.${myCurrentChapter}`,
    )
  }

  let { data: rawMessages, error: queryError } = await messagesQuery

  // Fallback: if query fails (likely due to missing parent_message_id column if migration hasn't been run yet)
  if (queryError || !rawMessages) {
    let fallbackQuery = supabase
      .from('channel_messages')
      .select('id, content, is_spoiler_gated, chapter_number, created_at, user_id')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (channel.is_chapter_gated) {
      fallbackQuery = fallbackQuery.or(
        `chapter_number.is.null,chapter_number.lte.${myCurrentChapter}`,
      )
    }
    const fallbackResult = await fallbackQuery
    rawMessages = (fallbackResult.data ?? []).map((m) => ({
      ...m,
      parent_message_id: null,
    }))
  }

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
        .from('message_reactions')
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
      channels={allChannels ?? []}
      initialMessages={messages}
      myUserId={profile.id}
      myCurrentChapter={myCurrentChapter}
    />
  )
}
