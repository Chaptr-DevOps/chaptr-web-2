'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateBookShelf(progressId: string, status: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // If status is 'finished', progress_percentage should be 100
  const updateData: Record<string, any> = { status }
  if (status === 'finished') {
    updateData.progress_percentage = 100
  }

  const { error } = await supabase
    .from('reading_progress')
    .update(updateData)
    .eq('id', progressId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  // If it's finished, let's increment the user's total completed books count
  if (status === 'finished') {
    const { data: profile } = await supabase
      .from('users')
      .select('total_books_completed')
      .eq('id', user.id)
      .maybeSingle()

    const currentCount = profile?.total_books_completed ?? 0
    await supabase
      .from('users')
      .update({ total_books_completed: currentCount + 1 })
      .eq('id', user.id)
  }

  revalidatePath('/library')
  revalidatePath('/home')
  return { success: true }
}

export async function removeBookFromLibrary(progressId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('reading_progress')
    .delete()
    .eq('id', progressId)
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
  status: string
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

  // Check if user already has this book in progress
  const { data: existingProgress } = await supabase
    .from('reading_progress')
    .select('id')
    .eq('user_id', user.id)
    .eq('book_id', bookId)
    .maybeSingle()

  if (existingProgress) {
    // Update existing progress status
    const { error: updateError } = await supabase
      .from('reading_progress')
      .update({ status })
      .eq('id', existingProgress.id)

    if (updateError) return { error: updateError.message }
  } else {
    // Insert progress
    const { error: progressError } = await supabase.from('reading_progress').insert({
      user_id: user.id,
      book_id: bookId,
      status,
      current_chapter: 0,
      progress_percentage: status === 'finished' ? 100 : 0,
    })

    if (progressError) return { error: progressError.message }
  }

  revalidatePath('/library')
  revalidatePath('/home')
  return { success: true, bookId }
}

export async function logChapterCompletion(
  progressId: string,
  bookId: string,
  chapterNumber: number,
  reflectionText?: string
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // 1. Log the chapter completion
  const { error: completionError } = await supabase.from('chapter_completions').insert({
    user_id: user.id,
    book_id: bookId,
    chapter_number: chapterNumber,
    reflection_text: reflectionText?.trim() || null,
  })

  if (completionError) return { error: completionError.message }

  // 2. Fetch the book to get total chapters
  const { data: book } = await supabase
    .from('books')
    .select('total_chapters, total_pages')
    .eq('id', bookId)
    .single()

  // Calculate percentage
  let progress_percentage = 0
  let isFinished = false
  if (book?.total_chapters) {
    progress_percentage = Math.min(100, Math.max(0, (chapterNumber / book.total_chapters) * 100))
    if (chapterNumber >= book.total_chapters) {
      isFinished = true
    }
  }

  // 3. Update the reading progress
  const updatePayload: Record<string, any> = {
    current_chapter: chapterNumber,
    progress_percentage,
  }
  if (isFinished) {
    updatePayload.status = 'finished'
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
  return { success: true }
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