'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function addComment(params: {
  discussionId: string
  content: string
  parentCommentId?: string | null
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const content = params.content.trim()
  if (!content) return { error: 'Comment content is required' }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      discussion_id: params.discussionId,
      user_id: user.id,
      parent_comment_id: params.parentCommentId ?? null,
      content,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/home/discussions/${params.discussionId}`)
  return { success: true, id: data.id }
}

export async function toggleReaction(params: {
  discussionId: string
  targetType: 'discussion' | 'comment'
  targetId: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: existing } = await supabase
    .from('reactions')
    .select('id')
    .eq('user_id', user.id)
    .eq('target_type', params.targetType)
    .eq('target_id', params.targetId)
    .eq('reaction_type', 'like')
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('reactions').delete().eq('id', existing.id)
    if (error) return { error: error.message }
    revalidatePath(`/home/discussions/${params.discussionId}`)
    return { success: true, reacted: false }
  }

  const { error } = await supabase.from('reactions').insert({
    user_id: user.id,
    target_type: params.targetType,
    target_id: params.targetId,
    reaction_type: 'like',
  })
  if (error) return { error: error.message }

  revalidatePath(`/home/discussions/${params.discussionId}`)
  return { success: true, reacted: true }
}
