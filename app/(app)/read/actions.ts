'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logChapterCompletion } from '../library/actions'

/**
 * Every action below carries an EXPLICIT return-type annotation, and that is
 * load-bearing. Without one, TypeScript infers each return branch separately and
 * back-fills the other branch's keys as optional — so at the call site
 * `if ('error' in res)` fails to narrow and `res.error` comes out
 * `string | undefined`. Callers then need `res.error ?? null` band-aids. With the
 * annotation, `in` narrowing works and callers can use `res.error` directly.
 */
type ActionResult<T = unknown> = { error: string } | ({ success: true } & T)

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
}): Promise<ActionResult<{ id: string; createdAt: string }>> {
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

export async function updateChapterNote(id: string, content: string): Promise<ActionResult> {
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

export async function deleteChapterNote(id: string): Promise<ActionResult> {
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
}): Promise<ActionResult<{ isFinalChapter: boolean; progressPercentage: number }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // A caller-supplied groupId must not let someone tag a group they are not a
  // member of — chapter_completions rows are readable by that group.
  if (params.groupId) {
    const { data: membership } = await supabase
      .from('group_memberships')
      .select('id')
      .eq('group_id', params.groupId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!membership) return { error: 'You are not a member of this group' }
  }

  // Log the completion FIRST. If it fails, the notes stay tagged 'snippet' and
  // nothing has been recorded — there is no transaction across these two calls.
  //
  // NOTE: reflectionText is deliberately NOT passed. chapter_completions has an
  // RLS policy granting SELECT to every active member of the row's group, so
  // anything in reflection_text on a group-scoped completion is visible to the
  // whole group. Bullet notes are private (personal_notes is owner-only) and
  // must never be copied there. Sharing is an explicit user action via the
  // discussion modal, never a side effect of completing a chapter.
  const result = await logChapterCompletion(
    params.progressId,
    params.bookId,
    params.chapterNumber,
    {
      groupId: params.groupId ?? null,
      clampProgress: true,
    }
  )

  if ('error' in result) return { error: result.error }

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
