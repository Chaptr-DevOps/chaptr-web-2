'use server'

import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/queries'
import type { UserProfile, ChapterCompletion, ReadingProgress, Book } from '@/lib/types'

export interface ProfileStats {
  profile: UserProfile
  totalChapters: number
  totalBooks: number
  currentStreak: number
  completions: (ChapterCompletion & { book: Book | null })[]
  reading: (ReadingProgress & { book: Book | null })[]
  badges: Badge[]
}

export interface Badge {
  id: string
  label: string
  description: string
  icon: string
  earned: boolean
}

function computeBadges(profile: UserProfile, totalChapters: number): Badge[] {
  return [
    {
      id: 'first_chapter',
      label: 'First Chapter',
      description: 'Log your very first chapter',
      icon: '📖',
      earned: totalChapters >= 1,
    },
    {
      id: 'bookworm',
      label: 'Bookworm',
      description: 'Complete 50 chapters',
      icon: '🪱',
      earned: totalChapters >= 50,
    },
    {
      id: 'streak_7',
      label: 'Week Warrior',
      description: 'Maintain a 7-day streak',
      icon: '🔥',
      earned: (profile.reading_streak ?? 0) >= 7,
    },
    {
      id: 'streak_30',
      label: 'Month Master',
      description: 'Maintain a 30-day streak',
      icon: '🏆',
      earned: (profile.reading_streak ?? 0) >= 30,
    },
    {
      id: 'first_book',
      label: 'Finisher',
      description: 'Complete your first book',
      icon: '✅',
      earned: (profile.total_books_completed ?? 0) >= 1,
    },
    {
      id: 'five_books',
      label: 'Bibliophile',
      description: 'Complete 5 books',
      icon: '📚',
      earned: (profile.total_books_completed ?? 0) >= 5,
    },
    {
      id: 'speed_reader',
      label: 'Speed Reader',
      description: 'Log 10 chapters in a single day',
      icon: '⚡',
      earned: totalChapters >= 100,
    },
    {
      id: 'night_owl',
      label: 'Night Owl',
      description: 'Log 200 total chapters',
      icon: '🦉',
      earned: totalChapters >= 200,
    },
  ]
}

export async function getProfileStats(): Promise<ProfileStats | null> {
  const supabase = await createClient()
  const profile = await getProfile()
  if (!profile) return null

  const [{ data: completions }, { data: progress }] = await Promise.all([
    supabase
      .from('chapter_completions')
      .select('*')
      .eq('user_id', profile.id)
      .order('completed_at', { ascending: false })
      .limit(20),
    supabase
      .from('reading_progress')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false }),
  ])

  const bookIds = Array.from(
    new Set([
      ...(completions ?? []).map((c) => c.book_id),
      ...(progress ?? []).map((p) => p.book_id),
    ]),
  )

  const { data: books } = bookIds.length
    ? await supabase.from('books').select('*').in('id', bookIds)
    : { data: [] as Book[] }

  const bookMap = new Map((books ?? []).map((b: Book) => [b.id, b]))

  const totalChapters = completions?.length ?? 0

  return {
    profile,
    totalChapters,
    totalBooks: profile.total_books_completed ?? 0,
    currentStreak: profile.reading_streak ?? 0,
    completions: (completions ?? []).map((c) => ({
      ...c,
      book: bookMap.get(c.book_id) ?? null,
    })),
    reading: (progress ?? []).map((p) => ({
      ...p,
      book: bookMap.get(p.book_id) ?? null,
    })),
    badges: computeBadges(profile, totalChapters),
  }
}

export async function getPublicProfile(userId: string): Promise<ProfileStats | null> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) return null

  const [{ data: completions }, { data: progress }] = await Promise.all([
    supabase
      .from('chapter_completions')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(10),
    supabase
      .from('reading_progress')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ])

  const bookIds = Array.from(
    new Set([
      ...(completions ?? []).map((c: ChapterCompletion) => c.book_id),
      ...(progress ?? []).map((p: ReadingProgress) => p.book_id),
    ]),
  )

  const { data: books } = bookIds.length
    ? await supabase.from('books').select('*').in('id', bookIds)
    : { data: [] as Book[] }

  const bookMap = new Map((books ?? []).map((b: Book) => [b.id, b]))
  const totalChapters = completions?.length ?? 0

  return {
    profile: profile as UserProfile,
    totalChapters,
    totalBooks: profile.total_books_completed ?? 0,
    currentStreak: profile.reading_streak ?? 0,
    completions: (completions ?? []).map((c: ChapterCompletion) => ({
      ...c,
      book: bookMap.get(c.book_id) ?? null,
    })),
    reading: (progress ?? []).map((p: ReadingProgress) => ({
      ...p,
      book: bookMap.get(p.book_id) ?? null,
    })),
    badges: computeBadges(profile as UserProfile, totalChapters),
  }
}
