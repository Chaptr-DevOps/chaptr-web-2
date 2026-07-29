'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logChapterCompletion } from '../library/actions'

/** Looks up the reading_progress row id for a (user, book, group) triple. */
async function findProgressId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  bookId: string,
  groupId?: string | null
) {
  let query = supabase
    .from('reading_progress')
    .select('id')
    .eq('user_id', userId)
    .eq('book_id', bookId)

  query = groupId ? query.eq('group_id', groupId) : query.is('group_id', null)

  const { data } = await query.maybeSingle()
  return data?.id ?? null
}

export async function addChapterNote(params: {
  bookId: string
  chapterNumber: number
  content: string
  groupId?: string | null
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const content = params.content.trim()
  if (!content) return { error: 'Note cannot be empty' }

  const readingProgressId = await findProgressId(
    supabase,
    user.id,
    params.bookId,
    params.groupId
  )

  const { data, error } = await supabase
    .from('personal_notes')
    .insert({
      user_id: user.id,
      book_id: params.bookId,
      reading_progress_id: readingProgressId,
      chapter_number: params.chapterNumber,
      note_content: content,
      note_type: 'snippet',
      is_private: true,
    })
    .select('id, created_at')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/library/notes/${params.bookId}`)
  return { success: true as const, id: data.id, createdAt: data.created_at }
}

export async function updateChapterNote(id: string, content: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const trimmed = content.trim()
  if (!trimmed) return { error: 'Note cannot be empty' }

  const { error } = await supabase
    .from('personal_notes')
    .update({ note_content: trimmed, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { success: true as const }
}

export async function deleteChapterNote(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('personal_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { success: true as const }
}

export async function completeChapterWithNotes(params: {
  progressId: string
  bookId: string
  chapterNumber: number
  groupId?: string | null
  noteIds: string[]
  noteContents: string[]
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Re-tag this chapter's snippets rather than merging and deleting them, so
  // revisiting the chapter still shows the individual bullets.
  if (params.noteIds.length > 0) {
    const { error: tagError } = await supabase
      .from('personal_notes')
      .update({ note_type: 'chapter_completion', updated_at: new Date().toISOString() })
      .in('id', params.noteIds)
      .eq('user_id', user.id)

    if (tagError) return { error: tagError.message }
  }

  const result = await logChapterCompletion(
    params.progressId,
    params.bookId,
    params.chapterNumber,
    {
      groupId: params.groupId ?? null,
      reflectionText: params.noteContents.join('\n\n'),
      clampProgress: true,
    }
  )

  if ('error' in result) return { error: result.error }

  revalidatePath('/home')
  revalidatePath('/library')
  revalidatePath(`/library/notes/${params.bookId}`)
  if (params.groupId) revalidatePath(`/groups/${params.groupId}`)

  return {
    success: true as const,
    isFinalChapter: result.isFinalChapter,
    progressPercentage: result.progressPercentage,
  }
}
