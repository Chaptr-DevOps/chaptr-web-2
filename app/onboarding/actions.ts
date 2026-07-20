'use server'

import { createClient } from '@/lib/supabase/server'

export async function checkUsername(username: string) {
  const clean = username.trim().toLowerCase()
  if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
    return { available: false, reason: 'invalid' as const }
  }
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('username', clean)
    .maybeSingle()
  return { available: !data, reason: data ? ('taken' as const) : null }
}

export async function saveUsername(username: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { error } = await supabase
    .from('users')
    .update({ username: username.trim().toLowerCase() })
    .eq('id', user.id)
  return { error: error?.message ?? null }
}

export async function registerBook(book: {
  title: string
  author?: string
  total_pages?: number
  total_chapters?: number
  cover_image_url?: string
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('books')
    .insert({
      title: book.title,
      author: book.author ?? null,
      total_pages: book.total_pages ?? null,
      total_chapters: book.total_chapters ?? null,
      cover_image_url: book.cover_image_url ?? null,
    })
    .select('id')
    .single()
  return { id: data?.id ?? null, error: error?.message ?? null }
}

export async function startReading(bookId: string, startingChapter: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { error } = await supabase.from('reading_progress').insert({
    user_id: user.id,
    book_id: bookId,
    current_chapter: startingChapter,
    status: 'reading',
    progress_percentage: 0,
  })
  return { error: error?.message ?? null }
}

export async function saveGenres(genres: string[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { error } = await supabase
    .from('users')
    .update({
      preferred_genres: genres,
      favorite_genre: genres[0] ?? null,
    })
    .eq('id', user.id)
  return { error: error?.message ?? null }
}

export async function saveGoal(pace: string, weeklyPages: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const yearly = Math.round((weeklyPages * 52) / 320) // rough books/yr estimate
  const { error } = await supabase
    .from('users')
    .update({
      yearly_reading_goal: yearly,
      average_reading_speed: weeklyPages,
    })
    .eq('id', user.id)
  return { error: error?.message ?? null }
}

export async function completeOnboarding() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { error } = await supabase
    .from('users')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', user.id)
  return { error: error?.message ?? null }
}
