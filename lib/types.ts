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

// Which shelf a book sits on. Mirrors the Postgres `shelf_type` enum.
export type ShelfType = 'tbr' | 'reading' | 'completed' | 'shelved' | 'wishlist'

// A book's place in the user's library. This — not reading_progress — is what
// the shelf tabs are built from, matching the mobile app.
//
// NOTE: unique on (user_id, book_id, shelf_type), NOT (user_id, book_id), so the
// same book can legitimately sit on more than one shelf.
export interface UserLibraryItem {
  id: string
  user_id: string
  book_id: string
  shelf_type: ShelfType
  priority: 'high' | 'medium' | 'low' | 'none' | null
  notes: string | null
  rating: number | null
  review: string | null
  added_at: string
  updated_at: string
}

export interface UserLibraryItemWithBook extends UserLibraryItem {
  book: Pick<
    Book,
    'id' | 'title' | 'author' | 'total_pages' | 'total_chapters' | 'cover_image_url'
  >
}

// User-created collections. The shelf tabs above are a separate concept and are
// not rows in this table.
export interface CustomShelf {
  id: string
  user_id: string
  name: string
  description: string | null
  is_public: boolean
  created_at: string
  // Aggregated by the library query (`book_count:shelf_books(count)`),
  // not a column on custom_shelves.
  book_count?: number
}

// A row of shelf_books joined to its book. NOTE: shelf_books has a composite
// primary key (shelf_id, book_id) and no `id` column — identify a row by the
// pair, not by a single id.
export interface ShelfBookWithBook {
  shelf_id: string
  book_id: string
  added_at: string
  book: Pick<Book, 'id' | 'title' | 'author' | 'cover_image_url'>
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
  status: 'reading' | 'completed' | 'paused' | 'abandoned' | string
  created_at: string
  goal_pace_hours: number | null
  completion_target_date: string | null
  chapter_deadlines: { chapter_number: number; deadline_at: string }[] | null
  completed_chapters: number | null
  total_chapters: number | null
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
  reading_progress_id: string | null
  chapter_number: number | null
  note_content: string | null
  note_type: string | null
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

/** Row in `group_subscribers` — one paid membership per (user, group). */
export interface GroupSubscriber {
  id: string
  subscriber_id: string
  group_id: string
  status: 'active' | 'canceled' | 'past_due' | string
  stripe_subscription_id: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

/**
 * Row in `group_subscriptions` — the per-group pricing-tier catalog, owned by
 * the mobile backend. This is NOT a user's subscription; see GroupSubscriber.
 */
export interface GroupSubscriptionTier {
  id: string
  group_id: string
  stripe_price_id: string
  name: string
  description: string | null
  /** Cents. */
  price_amount: number
  currency: string
  is_active: boolean
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

export interface Discussion {
  id: string
  user_id: string
  group_id: string | null
  title: string | null
  content: string
  discussion_type: string
  is_spoiler: boolean
  is_pinned: boolean
  reaction_count: number
  comment_count: number
  created_at: string
  updated_at: string
  scope_type: 'general' | 'group' | string
  book_id: string | null
  chapter_number: number
  hidden_by_reports: boolean
}

export interface Comment {
  id: string
  discussion_id: string
  user_id: string
  parent_comment_id: string | null
  content: string
  reaction_count: number
  created_at: string
  updated_at: string
  is_spoiler_gated: boolean
  hidden_by_reports: boolean
}

export interface Reaction {
  id: string
  user_id: string
  target_type: 'discussion' | 'comment' | string
  target_id: string
  reaction_type: string
  created_at: string
}

/** One Stripe Connect (Express) account per creator. Pricing lives on the group. */
export interface CreatorPayoutAccount {
  id: string
  user_id: string
  stripe_account_id: string | null
  onboarding_complete: boolean
  created_at: string
  updated_at: string
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

// Shelves a user can actually put a book on. These are the only shelf_type
// values the mobile app maintains — 'reading' and 'wishlist' exist in the enum
// but nothing writes them, so they are not offered.
export const SHELF_OPTIONS = [
  { key: 'tbr', label: 'TBR' },
  { key: 'shelved', label: 'Shelved' },
  { key: 'completed', label: 'Finished' },
] as const satisfies ReadonlyArray<{ key: ShelfType; label: string }>

// Library tabs. 'reading' is NOT a shelf — it is derived from
// reading_progress.status, because "reading" is a state you are in, not a
// shelf you curate. Everything else filters on user_library.shelf_type.
export const LIBRARY_TABS = [
  { key: 'tbr', label: 'TBR' },
  { key: 'reading', label: 'Reading' },
  { key: 'shelved', label: 'Shelved' },
  { key: 'completed', label: 'Finished' },
] as const
