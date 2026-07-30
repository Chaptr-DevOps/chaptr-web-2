'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ShelfType } from '@/lib/types'

// Put a book on a shelf, moving it off any other shelf. Keyed by book_id rather
// than by a user_library row id, because a book can appear in the library UI via
// reading_progress alone (the derived "Reading" tab) with no shelf row yet.
export async function setBookShelf(bookId: string, shelfType: ShelfType) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: existing } = await supabase
    .from('user_library')
    .select('id, shelf_type')
    .eq('user_id', user.id)
    .eq('book_id', bookId)

  const rows = existing ?? []
  const alreadyOnTarget = rows.some((r) => r.shelf_type === shelfType)
  const staleIds = rows.filter((r) => r.shelf_type !== shelfType).map((r) => r.id)

  // The UI treats shelves as single-select ("Change Shelf"), so moving clears
  // the others even though the table would allow a book on several at once.
  if (staleIds.length) {
    const { error } = await supabase
      .from('user_library')
      .delete()
      .in('id', staleIds)
      .eq('user_id', user.id)
    if (error) return { error: error.message }
  }

  if (!alreadyOnTarget) {
    const { error } = await supabase
      .from('user_library')
      .insert({ user_id: user.id, book_id: bookId, shelf_type: shelfType })
    if (error) return { error: error.message }
  }

  // Mirror completion onto reading_progress so Home and stats agree. Only counts
  // the book once — when it was not already marked completed.
  if (shelfType === 'completed') {
    const { data: progress } = await supabase
      .from('reading_progress')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .maybeSingle()

    if (progress && progress.status !== 'completed') {
      await supabase
        .from('reading_progress')
        .update({ status: 'completed', progress_percentage: 100 })
        .eq('id', progress.id)

      const { data: profile } = await supabase
        .from('users')
        .select('total_books_completed')
        .eq('id', user.id)
        .maybeSingle()

      await supabase
        .from('users')
        .update({ total_books_completed: (profile?.total_books_completed ?? 0) + 1 })
        .eq('id', user.id)
    }
  }

  revalidatePath('/library')
  revalidatePath('/home')
  return { success: true }
}

// Takes the book off every shelf. Reading progress and notes are deliberately
// left alone — they are separate records, and mobile behaves the same way.
export async function removeBookFromLibrary(bookId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('user_library')
    .delete()
    .eq('book_id', bookId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/library')
  revalidatePath('/home')
  return { success: true }
}

export async function addBookToShelf(
  book: {
    title: string
    author?: string
    total_pages?: number
    total_chapters?: number
    cover_image_url?: string
  },
  shelfType: ShelfType
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // Check if book already exists in public.books by matching title and author
  let bookId: string | null = null
  const { data: existingBook } = await supabase
    .from('books')
    .select('id')
    .eq('title', book.title.trim())
    .eq('author', book.author?.trim() ?? '')
    .maybeSingle()

  if (existingBook) {
    bookId = existingBook.id
  } else {
    // Insert new book
    const { data: newBook, error: bookError } = await supabase
      .from('books')
      .insert({
        title: book.title.trim(),
        author: book.author?.trim() ?? null,
        total_pages: book.total_pages ?? null,
        total_chapters: book.total_chapters ?? null,
        cover_image_url: book.cover_image_url ?? null,
      })
      .select('id')
      .single()

    if (bookError) return { error: bookError.message }
    bookId = newBook.id
  }

  // 'reading' is a state, not a shelf: it means start tracking the book, and
  // creates a reading_progress row instead of a user_library row. Every other
  // target is a real shelf and creates no progress — a TBR book you have not
  // opened has nothing to track, which is the point.
  if (shelfType === 'reading') {
    const { data: existingProgress } = await supabase
      .from('reading_progress')
      .select('id')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .maybeSingle()

    if (!existingProgress) {
      const { error: progressError } = await supabase.from('reading_progress').insert({
        user_id: user.id,
        book_id: bookId,
        status: 'reading',
        current_chapter: 1,
        progress_percentage: 0,
      })

      if (progressError) return { error: progressError.message }
    }
  } else {
    // Unique on (user_id, book_id, shelf_type), so re-adding is a no-op.
    const { error: libraryError } = await supabase
      .from('user_library')
      .upsert(
        { user_id: user.id, book_id: bookId, shelf_type: shelfType },
        { onConflict: 'user_id,book_id,shelf_type', ignoreDuplicates: true },
      )

    if (libraryError) return { error: libraryError.message }
  }

  revalidatePath('/library')
  revalidatePath('/home')
  return { success: true, bookId }
}

export async function logChapterCompletion(
  progressId: string,
  bookId: string,
  chapterNumber: number,
  options?: {
    groupId?: string | null
    reflectionText?: string
    clampProgress?: boolean
  }
): Promise<
  { error: string } | { success: true; isFinalChapter: boolean; progressPercentage: number }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // 1. Log the chapter completion
  const { error: completionError } = await supabase.from('chapter_completions').insert({
    user_id: user.id,
    book_id: bookId,
    group_id: options?.groupId ?? null,
    chapter_number: chapterNumber,
    reflection_text: options?.reflectionText?.trim() || null,
  })

  if (completionError) return { error: completionError.message }

  // When clamping, progress may only move forward. Without this, using the
  // chapter picker to log an earlier chapter would drag the reader backwards.
  let effectiveChapter = chapterNumber
  if (options?.clampProgress) {
    const { data: existing } = await supabase
      .from('reading_progress')
      .select('current_chapter, completed_chapters')
      .eq('id', progressId)
      .eq('user_id', user.id)
      .maybeSingle()

    effectiveChapter = Math.max(
      chapterNumber,
      existing?.current_chapter ?? 0,
      existing?.completed_chapters ?? 0
    )
  }

  // Fetch the book to get total chapters
  const { data: book } = await supabase
    .from('books')
    .select('total_chapters, total_pages')
    .eq('id', bookId)
    .single()

  let progress_percentage = 0
  let isFinished = false
  if (book?.total_chapters) {
    progress_percentage = Math.min(
      100,
      Math.max(0, (effectiveChapter / book.total_chapters) * 100)
    )
    if (effectiveChapter >= book.total_chapters) {
      isFinished = true
    }
  }

  const updatePayload: Record<string, any> = {
    current_chapter: effectiveChapter,
    progress_percentage,
    completed_chapters: effectiveChapter,
    total_chapters: book?.total_chapters ?? null,
    last_read_at: new Date().toISOString(),
  }
  if (isFinished) {
    updatePayload.status = 'completed'
    updatePayload.completed_at = new Date().toISOString()
  }

  const { error: progressError } = await supabase
    .from('reading_progress')
    .update(updatePayload)
    .eq('id', progressId)
    .eq('user_id', user.id)

  if (progressError) return { error: progressError.message }

  // 4. Update user streak
  const { data: profile } = await supabase
    .from('users')
    .select('reading_streak, current_streak_start, total_pages_read, total_books_completed')
    .eq('id', user.id)
    .maybeSingle()

  if (profile) {
    const todayStr = new Date().toISOString().split('T')[0]
    let newStreak = profile.reading_streak
    let streakUpdated = false

    if (!profile.current_streak_start) {
      newStreak = 1
      streakUpdated = true
    } else {
      const lastStreakDate = new Date(profile.current_streak_start)
      const todayDate = new Date(todayStr)
      const diffTime = Math.abs(todayDate.getTime() - lastStreakDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays === 1) {
        newStreak += 1
        streakUpdated = true
      } else if (diffDays > 1) {
        newStreak = 1
        streakUpdated = true
      }
    }

    const pagesPerChapter = book?.total_pages && book.total_chapters
      ? Math.round(book.total_pages / book.total_chapters)
      : 15 // average pages per chapter if unspecified

    const userUpdate: Record<string, any> = {
      total_pages_read: (profile.total_pages_read ?? 0) + pagesPerChapter,
    }

    if (streakUpdated) {
      userUpdate.reading_streak = newStreak
      userUpdate.current_streak_start = todayStr
    }

    if (isFinished) {
      userUpdate.total_books_completed = (profile.total_books_completed ?? 0) + 1
    }

    await supabase.from('users').update(userUpdate).eq('id', user.id)
  }

  revalidatePath('/library')
  revalidatePath('/home')
  return { success: true, isFinalChapter: isFinished, progressPercentage: progress_percentage }
}

export async function saveNote(note: {
  id?: string
  bookId: string
  chapterNumber: number | null
  content: string
  isPrivate: boolean
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  if (note.id) {
    // Update existing note
    const { error } = await supabase
      .from('personal_notes')
      .update({
        chapter_number: note.chapterNumber,
        note_content: note.content,
        is_private: note.isPrivate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', note.id)
      .eq('user_id', user.id)

    if (error) return { error: error.message }
  } else {
    // Insert new note
    const { error } = await supabase.from('personal_notes').insert({
      user_id: user.id,
      book_id: note.bookId,
      chapter_number: note.chapterNumber,
      note_content: note.content,
      is_private: note.isPrivate,
    })

    if (error) return { error: error.message }
  }

  revalidatePath(`/library/notes/${note.bookId}`)
  return { success: true }
}

export async function deleteNote(noteId: string, bookId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('personal_notes')
    .delete()
    .eq('id', noteId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/library/notes/${bookId}`)
  return { success: true }
}

// ============================================================================
// CUSTOM SHELVES (COLLECTIONS)
// ============================================================================
// Note: these are user-defined collections (e.g. "Favorites", "Book Club"),
// distinct from the fixed TBR/Reading/Finished/DNF status shelves above.

export async function createShelf(params: {
  name: string
  description?: string
  isPublic?: boolean
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const name = params.name.trim()
  if (!name) return { error: 'Shelf name is required' }

  const { data, error } = await supabase
    .from('custom_shelves')
    .insert({
      user_id: user.id,
      name,
      description: params.description?.trim() || null,
      is_public: params.isPublic ?? false,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/library')
  revalidatePath('/library/add')
  return { success: true, shelf: { ...data, book_count: 0 } }
}

export async function updateShelf(
  shelfId: string,
  updates: { name?: string; description?: string | null; is_public?: boolean }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const payload: Record<string, any> = {}
  if (updates.name !== undefined) {
    const trimmed = updates.name.trim()
    if (!trimmed) return { error: 'Shelf name is required' }
    payload.name = trimmed
  }
  if (updates.description !== undefined) {
    payload.description = updates.description?.trim() || null
  }
  if (updates.is_public !== undefined) {
    payload.is_public = updates.is_public
  }

  const { error } = await supabase
    .from('custom_shelves')
    .update(payload)
    .eq('id', shelfId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/library')
  revalidatePath('/library/add')
  return { success: true }
}

export async function deleteShelf(shelfId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // Clear membership rows first in case the DB doesn't cascade-delete them.
  const { error: shelfBooksError } = await supabase
    .from('shelf_books')
    .delete()
    .eq('shelf_id', shelfId)

  if (shelfBooksError) return { error: shelfBooksError.message }

  const { error } = await supabase
    .from('custom_shelves')
    .delete()
    .eq('id', shelfId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/library')
  revalidatePath('/library/add')
  return { success: true }
}

export async function addBookToCustomShelf(shelfId: string, bookId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // Confirm the shelf actually belongs to this user before writing to it,
  // since shelf_books itself has no user_id column to check against.
  const { data: shelf } = await supabase
    .from('custom_shelves')
    .select('id')
    .eq('id', shelfId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!shelf) return { error: 'Shelf not found' }

  const { data: existing } = await supabase
    .from('shelf_books')
    .select('id')
    .eq('shelf_id', shelfId)
    .eq('book_id', bookId)
    .maybeSingle()

  if (!existing) {
    const { error } = await supabase.from('shelf_books').insert({
      shelf_id: shelfId,
      book_id: bookId,
    })

    if (error) return { error: error.message }
  }

  revalidatePath('/library')
  revalidatePath('/library/add')
  return { success: true }
}

export async function removeBookFromCustomShelf(shelfId: string, bookId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: shelf } = await supabase
    .from('custom_shelves')
    .select('id')
    .eq('id', shelfId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!shelf) return { error: 'Shelf not found' }

  const { error } = await supabase
    .from('shelf_books')
    .delete()
    .eq('shelf_id', shelfId)
    .eq('book_id', bookId)

  if (error) return { error: error.message }

  revalidatePath('/library')
  revalidatePath('/library/add')
  return { success: true }
}