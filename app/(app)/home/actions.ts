'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function setCompletionTargetDate(progressId: string, targetDate: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('reading_progress')
    .update({ completion_target_date: targetDate.slice(0, 10) })
    .eq('id', progressId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/home')
  return { success: true }
}

export async function nudgeDeadlines(progressId: string, hours: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: progress, error: fetchError } = await supabase
    .from('reading_progress')
    .select('completion_target_date, chapter_deadlines')
    .eq('id', progressId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchError) return { error: fetchError.message }
  if (!progress) return { error: 'Reading progress not found' }

  const shiftMs = hours * 60 * 60 * 1000

  const nextTargetDate = progress.completion_target_date
    ? new Date(new Date(progress.completion_target_date).getTime() + shiftMs)
        .toISOString()
        .slice(0, 10)
    : null

  const deadlines = (progress.chapter_deadlines ?? []) as Array<{
    chapter_number: number
    deadline_at: string
  }>
  const nextDeadlines = deadlines.map((d) => ({
    ...d,
    deadline_at: new Date(new Date(d.deadline_at).getTime() + shiftMs).toISOString(),
  }))

  const { error } = await supabase
    .from('reading_progress')
    .update({
      completion_target_date: nextTargetDate,
      chapter_deadlines: nextDeadlines,
    })
    .eq('id', progressId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/home')
  return { success: true }
}

export async function updateBookTotalChapters(bookId: string, totalChapters: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (!totalChapters || totalChapters <= 0 || totalChapters > 200) {
    return { error: 'Please enter a valid number of chapters (1-200)' }
  }

  const { error } = await supabase
    .from('books')
    .update({ total_chapters: totalChapters })
    .eq('id', bookId)

  if (error) return { error: error.message }

  const { error: progressError } = await supabase
    .from('reading_progress')
    .update({ total_chapters: totalChapters })
    .eq('book_id', bookId)
    .eq('user_id', user.id)

  if (progressError) return { error: progressError.message }

  revalidatePath('/home')
  revalidatePath('/library')
  return { success: true }
}

export async function shelveBook(progressId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('reading_progress')
    .update({ status: 'abandoned' })
    .eq('id', progressId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/home')
  revalidatePath('/library')
  return { success: true }
}

export async function createDiscussion(params: {
  content: string
  bookId: string
  chapterNumber: number
  scopeType: 'general' | 'group'
  groupId?: string | null
  isSpoiler?: boolean
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const content = params.content.trim()
  if (!content) return { error: 'Discussion content is required' }

  const { data, error } = await supabase
    .from('discussions')
    .insert({
      user_id: user.id,
      book_id: params.bookId,
      chapter_number: params.chapterNumber,
      scope_type: params.scopeType,
      group_id: params.scopeType === 'group' ? params.groupId ?? null : null,
      content,
      is_spoiler: params.isSpoiler ?? false,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/home')
  return { success: true, id: data.id }
}
