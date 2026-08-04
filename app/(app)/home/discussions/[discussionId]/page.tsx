import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/queries'
import { isUuid } from '@/lib/route-params'
import { DiscussionDetailClient } from '@/components/discussions/discussion-detail-client'
import type { DiscussionWithUser } from '@/components/discussions/discussion-thread'
import type { CommentWithUser } from '@/components/discussions/discussion-detail-client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{
    discussionId: string
  }>
}

export default async function DiscussionDetailPage({ params }: PageProps) {
  const { discussionId } = await params
  if (!isUuid(discussionId)) redirect('/home')
  const supabase = await createClient()
  const profile = await getProfile()

  if (!profile) {
    redirect('/signin')
  }

  const { data: discussion, error: discussionError } = await supabase
    .from('discussions')
    .select('*, user:users!discussions_user_id_fkey(display_name, username, avatar_url)')
    .eq('id', discussionId)
    .maybeSingle()

  if (discussionError) {
    console.error('Failed to load discussion', discussionId, discussionError)
  }

  if (discussionError || !discussion) {
    redirect('/home')
  }

  const [{ data: book }, { data: comments, error: commentsError }] = await Promise.all([
    discussion.book_id
      ? supabase.from('books').select('title').eq('id', discussion.book_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('comments')
      .select('*, user:users!comments_user_id_fkey(display_name, username, avatar_url)')
      .eq('discussion_id', discussionId)
      .order('created_at', { ascending: true }),
  ])

  if (commentsError) {
    console.error('Failed to load comments for discussion', discussionId, commentsError)
  }

  const commentIds = (comments ?? []).map((c) => c.id)
  const { data: reactions } = await supabase
    .from('reactions')
    .select('target_type, target_id, user_id')
    .eq('reaction_type', 'like')
    .in('target_type', ['discussion', 'comment'])
    .in('target_id', [discussionId, ...commentIds])

  const reactionsByTarget = new Map<string, { count: number; likedByMe: boolean }>()
  for (const r of reactions ?? []) {
    const entry = reactionsByTarget.get(r.target_id) ?? { count: 0, likedByMe: false }
    entry.count += 1
    if (r.user_id === profile.id) entry.likedByMe = true
    reactionsByTarget.set(r.target_id, entry)
  }

  return (
    <DiscussionDetailClient
      discussion={discussion as DiscussionWithUser}
      bookTitle={book?.title ?? null}
      comments={(comments ?? []) as CommentWithUser[]}
      reactionsByTarget={Object.fromEntries(reactionsByTarget)}
      currentUserId={profile.id}
    />
  )
}
