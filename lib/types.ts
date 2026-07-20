// Shared domain types mirroring the Supabase schema.

export interface UserProfile {
  id: string
  username: string | null
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  favorite_genre: string | null
  preferred_genres: string[] | null
  reading_streak: number
  current_streak_start: string | null
  average_reading_speed: number | null
  yearly_reading_goal: number | null
  total_books_completed: number
  total_pages_read: number
  onboarding_completed_at: string | null
  is_admin: boolean
  status: string
  created_at: string
}

export interface Book {
  id: string
  title: string
  author: string | null
  total_pages: number | null
  total_chapters: number | null
  cover_image_url: string | null
  created_at?: string
}

export interface ReadingGroup {
  id: string
  name: string
  created_by: string | null
  current_book_id: string | null
  reading_pace: string | null
  is_public: boolean
  invite_code: string | null
  is_paid: boolean
  price: number | null
  stripe_price_id: string | null
  created_at: string
}

export interface ReadingProgress {
  id: string
  user_id: string
  book_id: string
  group_id: string | null
  current_chapter: number
  progress_percentage: number
  status: 'tbr' | 'reading' | 'finished' | 'dnf' | string
  created_at: string
}

export interface ChapterCompletion {
  id: string
  user_id: string
  book_id: string
  group_id: string | null
  chapter_number: number
  reflection_text: string | null
  completed_at: string
}

export interface PersonalNote {
  id: string
  user_id: string
  book_id: string
  chapter_number: number | null
  note_content: string | null
  is_private: boolean
  created_at: string
  updated_at: string
}

export interface GroupChannel {
  id: string
  group_id: string
  name: string
  channel_type: string
  is_chapter_gated: boolean
  is_premium: boolean
  created_at: string
}

export interface ChannelMessage {
  id: string
  channel_id: string
  user_id: string
  content: string | null
  chapter_number: number | null
  is_spoiler_gated: boolean
  created_at: string
}

export interface GroupSubscription {
  id: string
  subscriber_id: string
  group_id: string
  status: 'active' | 'canceled' | 'past_due' | string
  stripe_subscription_id: string | null
  current_period_end: string | null
  created_at: string
}

export interface GroupBook {
  id: string
  group_id: string
  book_id: string
  is_premium: boolean
  created_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  role: string
  created_at: string
}

export interface CreatorPayoutAccount {
  id: string
  user_id: string
  stripe_account_id: string | null
  onboarding_complete: boolean
  created_at: string
}

export interface AppNotification {
  id: string
  user_id: string
  type: string | null
  title: string | null
  body: string | null
  is_read: boolean
  created_at: string
}

export interface Report {
  id: string
  reporter_id: string | null
  target_type: string | null
  target_id: string | null
  reason: string | null
  status: string
  created_at: string
}

export const GENRES = [
  'Fantasy',
  'Science Fiction',
  'Mystery',
  'Thriller',
  'Romance',
  'Historical',
  'Literary Fiction',
  'Horror',
  'Biography',
  'Memoir',
  'Self-Help',
  'Business',
  'Poetry',
  'Young Adult',
  'Nonfiction',
  'Philosophy',
  'Classics',
  'Adventure',
] as const

export const SHELF_TABS = [
  { key: 'tbr', label: 'TBR' },
  { key: 'reading', label: 'Reading' },
  { key: 'finished', label: 'Finished' },
  { key: 'dnf', label: 'DNF' },
] as const
