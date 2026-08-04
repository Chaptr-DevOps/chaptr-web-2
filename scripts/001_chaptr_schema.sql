-- ============================================================================
-- Chaptr schema — REFERENCE MIRROR OF THE LIVE DATABASE
--
-- This is documentation, NOT a provisioning script. Do not run it.
--
-- The live Postgres schema is owned by the Chaptr mobile backend. This file is
-- a faithful dump of the tables the *web* app reads/writes, so that TypeScript
-- interfaces in lib/types.ts and every supabase.from(...) call can be checked
-- against real column names, types, defaults and RLS.
--
-- Scope: the 24 public tables this repo queries. The live database has 47
-- public tables; mobile-only ones (achievements, badges, user_follows,
-- parental_consent, magic_tokens, group_messages, …) are intentionally omitted.
--
-- Generated from project ayaihmsohyniodvxfjqx on 2026-07-29.
-- Re-dump after any migration. See "KNOWN TRAPS" at the bottom of this file.
-- ============================================================================


-- ============================================================================
-- Enum types
--
-- Several columns are real Postgres enums, not text. Inserting a value outside
-- these lists fails with 22P02 rather than silently storing it.
-- ============================================================================
create type public.group_role         as enum ('admin', 'moderator', 'member');
create type public.notification_type  as enum ('discussion', 'progress', 'club', 'milestone', 'reminder');
create type public.reaction_type      as enum ('like', 'love', 'laugh', 'insightful');
create type public.reading_status     as enum ('reading', 'completed', 'paused', 'abandoned');
create type public.reflection_type    as enum ('text', 'audio', 'skipped');
create type public.report_status      as enum ('pending', 'reviewing', 'resolved', 'dismissed');
create type public.report_target_type as enum ('discussion', 'comment', 'user', 'group_message');
create type public.report_type        as enum ('spam', 'harassment', 'inappropriate_content', 'spoilers', 'hate_speech', 'other');
create type public.shelf_type         as enum ('tbr', 'reading', 'completed', 'shelved', 'wishlist');
create type public.user_status        as enum ('active', 'inactive', 'suspended');


-- ============================================================================
-- USERS
--
-- Public profile table. NOTE: there is NO foreign key to auth.users — the rows
-- are kept in sync only by the on_auth_user_created trigger (see bottom).
-- username is NOT NULL and unique; the trigger derives it from the email local
-- part when signup metadata omits it.
-- ============================================================================
create table public.users (
  id uuid primary key,
  username varchar not null unique,
  display_name varchar,
  bio text,
  avatar_url text,
  member_since timestamptz default now(),
  status public.user_status default 'active',
  reading_streak integer default 0,
  current_streak_start date,
  last_active timestamptz default now(),
  total_books_completed integer default 0,
  total_discussions_started integer default 0,
  total_comments integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  profile_image_url text,
  followers_count integer default 0,
  following_count integer default 0,
  total_pages_read bigint default 0,
  average_reading_speed integer,
  favorite_genre varchar,
  yearly_reading_goal integer default 0,
  yearly_books_completed integer default 0,
  current_year integer,
  profile_visibility varchar default 'public',
  show_reading_activity boolean default true,
  show_reading_stats boolean default true,
  show_achievements boolean default true,
  onboarding_state jsonb default '{
    "completed_intro": false,
    "completed_onboarding": false,
    "completed_first_chapter": false,
    "seen_chapter_unlock_demo": false,
    "seen_progress_bar_tooltip": false,
    "seen_reading_pace_tooltip": false,
    "seen_start_reading_button": false,
    "dismissed_group_suggestion": false,
    "seen_chapter_setup_tooltip": false,
    "seen_book_selection_tooltip": false,
    "seen_library_search_tooltip": false,
    "seen_first_unlocked_discussion": false,
    "seen_locked_discussion_tooltip": false,
    "seen_discussions_section_tooltip": false,
    "seen_reading_with_others_tooltip": false,
    "seen_reflection_requirement_tooltip": false
  }'::jsonb,
  is_admin boolean default false,
  age integer,
  date_of_birth date,
  personalized_onboarding_data jsonb,
  personalized_onboarding_completed boolean default false,
  preferred_genres text[] default '{}',
  reading_goal_type text,
  onboarding_completed_at timestamptz,
  terms_accepted_at timestamptz,
  privacy_policy_accepted_at timestamptz,
  total_xp integer default 0,
  default_pace_hours integer default 48,
  target_pace_ppw integer default 150,
  actual_velocity_ppw integer default 0,
  constraint users_age_check check (age > 0 and age <= 120),
  constraint users_average_reading_speed_check check (average_reading_speed is null or average_reading_speed > 0),
  constraint users_followers_count_check check (followers_count >= 0),
  constraint users_following_count_check check (following_count >= 0),
  constraint users_profile_visibility_check check (profile_visibility in ('public', 'followers', 'private')),
  constraint users_reading_goal_type_check check (reading_goal_type in ('chapter_week', 'book_month', 'just_fun')),
  constraint users_total_pages_read_check check (total_pages_read >= 0),
  constraint users_yearly_books_completed_check check (yearly_books_completed >= 0),
  constraint users_yearly_reading_goal_check check (yearly_reading_goal >= 0)
);
create index idx_users_age on public.users (age) where age is not null;
create index idx_users_date_of_birth on public.users (date_of_birth);
create index idx_users_favorite_genre on public.users (favorite_genre) where favorite_genre is not null;
create index idx_users_is_admin on public.users (is_admin) where is_admin = true;
create index idx_users_onboarding_state on public.users using gin (onboarding_state);
create index idx_users_personalized_onboarding_completed on public.users (personalized_onboarding_completed);
create index idx_users_reading_streak on public.users (reading_streak desc);
create index idx_users_status on public.users (status);
create index idx_users_total_xp on public.users (total_xp);
create index idx_users_username on public.users (username);
create index idx_users_visibility on public.users (profile_visibility) where profile_visibility = 'public';


-- ============================================================================
-- BOOKS
-- ============================================================================
create table public.books (
  id uuid primary key default uuid_generate_v4(),
  title varchar not null,
  author varchar not null,
  isbn varchar,
  description text,
  total_pages integer,
  total_chapters integer,
  publication_year integer,
  cover_image_url text,
  genres jsonb,
  average_rating numeric default 0.0,
  total_ratings integer default 0,
  is_featured boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  ol_id text unique,                       -- Open Library id
  user_submitted_chapters boolean default false,
  contributed_by_user_id uuid references auth.users(id),
  chapter_count_source text,
  constraint books_chapter_count_source_check
    check (chapter_count_source in ('google_books', 'user_contributed', 'default'))
);
create index idx_books_author on public.books (author);
create index idx_books_featured on public.books (is_featured) where is_featured = true;
create index idx_books_genres on public.books using gin (genres);
create index idx_books_ol_id on public.books (ol_id);
create index idx_books_rating on public.books (average_rating desc);
create index idx_books_user_contributions on public.books (contributed_by_user_id) where user_submitted_chapters = true;


-- ============================================================================
-- READING GROUPS
--
-- The paid layer (is_paid, price, stripe_price_id, stripe_account_id) sits on
-- this table. Per-group pricing tiers live in public.group_subscriptions (the
-- mobile backend's catalog table — not mirrored here, and NOT the table that
-- records who has paid; that is public.group_subscribers).
-- ============================================================================
create table public.reading_groups (
  id uuid primary key default uuid_generate_v4(),
  name varchar not null,
  description text,
  banner_gradient jsonb,
  current_book_id uuid references public.books(id),
  created_by uuid references public.users(id) on delete set null,
  member_limit integer default 50,
  is_public boolean default true,
  reading_pace varchar default 'moderate',
  total_members integer default 0,
  active_days integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  onboarding_completed boolean default false,
  allow_banner_change boolean default true,
  banner_image_url text,
  required_pace_ppw integer default 150,
  stripe_account_id text,
  primary_color text,
  current_book_target_start_date date,
  current_book_target_end_date date,
  invite_code text unique,
  is_paid boolean default false,
  price numeric,
  stripe_price_id text
);
create index idx_reading_groups_created_by on public.reading_groups (created_by);
create index idx_reading_groups_public on public.reading_groups (is_public) where is_public = true;


-- ============================================================================
-- GROUP MEMBERSHIPS
--
-- role is the group_role enum. The join timestamp is joined_at (there is no
-- created_at column on this table).
-- ============================================================================
create table public.group_memberships (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references public.reading_groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.group_role default 'member',
  joined_at timestamptz default now(),
  last_activity timestamptz default now(),
  is_active boolean default true,
  unique (group_id, user_id)
);
create index idx_group_memberships_active on public.group_memberships (group_id, is_active) where is_active = true;
create index idx_group_memberships_group on public.group_memberships (group_id);
create index idx_group_memberships_user on public.group_memberships (user_id);


-- ============================================================================
-- GROUP CHANNELS (chapter-gated and/or premium-gated)
--
-- channel_type is constrained to three values — 'text' is NOT one of them.
-- is_premium was added by the web app (2026-07-28); everything else on this
-- table comes from the mobile backend.
-- ============================================================================
create table public.group_channels (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references public.reading_groups(id) on delete cascade,
  name varchar not null,
  description text,
  channel_type varchar not null default 'custom',
  is_chapter_gated boolean not null default false,
  position integer not null default 0,
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_premium boolean not null default false,
  unique (group_id, name),
  constraint group_channels_channel_type_check
    check (channel_type in ('currently_reading', 'general', 'custom'))
);
create index idx_group_channels_group_id on public.group_channels (group_id);
create index idx_group_channels_position on public.group_channels (group_id, "position");


-- ============================================================================
-- CHANNEL MESSAGES
--
-- Threading column is reply_to_message_id (not parent_message_id). Reactions
-- are denormalised into the reactions jsonb column and counted in
-- reaction_count; the normalised table is channel_message_reactions.
-- ============================================================================
create table public.channel_messages (
  id uuid primary key default uuid_generate_v4(),
  channel_id uuid not null references public.group_channels(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  chapter_number integer,
  message_type varchar default 'text',
  reply_to_message_id uuid references public.channel_messages(id) on delete cascade,
  is_edited boolean default false,
  is_spoiler_gated boolean default false,
  is_chapter_gated boolean default false,
  reaction_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  old_message_id uuid,                     -- migration artifact from group_messages
  reactions jsonb default '{}'::jsonb,
  constraint channel_messages_check
    check (is_chapter_gated = false or (is_chapter_gated = true and chapter_number is not null))
);
create index idx_channel_messages_channel_id on public.channel_messages (channel_id, created_at desc);
create index idx_channel_messages_chapter on public.channel_messages (channel_id, chapter_number);
create index idx_channel_messages_old_id on public.channel_messages (old_message_id);
create index idx_channel_messages_reactions on public.channel_messages using gin (reactions);
create index idx_channel_messages_reply_to on public.channel_messages (reply_to_message_id);
create index idx_channel_messages_user_id on public.channel_messages (user_id);


-- ============================================================================
-- GROUP BOOK LIST
--
-- This is the live equivalent of what older docs called "group_books".
-- There is no is_premium column here — premium gating currently exists only on
-- group_channels.
-- ============================================================================
create table public.group_book_list (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references public.reading_groups(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  added_by uuid references public.users(id) on delete set null,
  status varchar default 'upcoming',
  position integer default 0,
  note text,
  added_at timestamptz default now(),
  unique (group_id, book_id),
  constraint group_book_list_status_check
    check (status in ('reading', 'completed', 'upcoming'))
);


-- ============================================================================
-- GROUP ANNOUNCEMENTS + COMMENTS
-- ============================================================================
create table public.group_announcements (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references public.reading_groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title text,
  content text not null,
  allow_comments boolean default false,
  comment_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_group_announcements_created_at on public.group_announcements (created_at desc);
create index idx_group_announcements_group_id on public.group_announcements (group_id);

create table public.announcement_comments (
  id uuid primary key default uuid_generate_v4(),
  announcement_id uuid not null references public.group_announcements(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_announcement_comments_announcement_id on public.announcement_comments (announcement_id);
create index idx_announcement_comments_created_at on public.announcement_comments (created_at desc);


-- ============================================================================
-- GROUP SUBSCRIBERS (paid layer: who has paid for which group)
--
-- Writes are service-role only — they belong to the Stripe webhook.
-- Do NOT confuse with public.group_subscriptions, which is the mobile
-- backend's per-group pricing-tier catalog (group_id, stripe_price_id, name,
-- description, price_amount, currency, is_active).
-- ============================================================================
create table public.group_subscribers (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.users(id) on delete cascade,
  group_id uuid not null references public.reading_groups(id) on delete cascade,
  status text not null default 'active',
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscriber_id, group_id)
);
create index group_subscribers_group_id_idx on public.group_subscribers (group_id);
create index group_subscribers_stripe_subscription_id_idx on public.group_subscribers (stripe_subscription_id);


-- ============================================================================
-- READING PROGRESS
--
-- current_chapter defaults to 1 (not 0). status is the reading_status enum.
-- Unique on (user_id, book_id, group_id) — a user has one row per book per
-- group, plus a separate row with group_id null for solo reading.
-- ============================================================================
create table public.reading_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  group_id uuid references public.reading_groups(id) on delete cascade,
  current_chapter integer default 1,
  progress_percentage numeric default 0.0,
  status public.reading_status default 'reading',
  reading_velocity integer default 0,
  total_reading_time integer default 0,
  started_at timestamptz default now(),
  completed_at timestamptz,
  last_read_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  goal_pace_hours integer,
  completion_target_date date,
  chapter_deadlines jsonb,
  completed_chapters integer default 0,
  total_chapters integer,
  unique (user_id, book_id, group_id)
);
create index idx_reading_progress_book on public.reading_progress (book_id);
create index idx_reading_progress_group on public.reading_progress (group_id);
create index idx_reading_progress_status on public.reading_progress (status);
create index idx_reading_progress_user on public.reading_progress (user_id);


-- ============================================================================
-- CHAPTER COMPLETIONS
--
-- No created_at — the timestamp is completed_at. No FK on book_id.
-- ============================================================================
create table public.chapter_completions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  group_id uuid references public.reading_groups(id) on delete cascade,
  completed_at timestamptz default now(),
  reading_time_minutes integer,
  reflection_text text,
  reflection_audio_url text,
  reflection_type public.reflection_type default 'text',
  chapter_number integer not null,
  book_id uuid not null
);
create index idx_chapter_completions_completed_at on public.chapter_completions (completed_at) where completed_at is not null;
create index idx_chapter_completions_group on public.chapter_completions (group_id);
create index idx_chapter_completions_user on public.chapter_completions (user_id);
create index idx_chapter_completions_user_date on public.chapter_completions (user_id, completed_at desc);
create index idx_completions_user_date on public.chapter_completions (user_id, completed_at);


-- ============================================================================
-- PERSONAL NOTES
--
-- chapter_number and note_content are both NOT NULL.
-- ============================================================================
create table public.personal_notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  reading_progress_id uuid references public.reading_progress(id) on delete cascade,
  chapter_number integer not null,
  note_content text not null,
  note_type varchar default 'general',
  is_private boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_personal_notes_chapter on public.personal_notes (book_id, chapter_number);
create index idx_personal_notes_reading_progress on public.personal_notes (reading_progress_id);
create index idx_personal_notes_user_book on public.personal_notes (user_id, book_id);


-- ============================================================================
-- USER LIBRARY (the shelf system)
--
-- This — not reading_progress — is what "TBR / Reading / Finished" means. A book
-- on a shelf need not have any reading_progress row at all; that is the whole
-- point of tbr/wishlist.
--
-- NOTE the unique key includes shelf_type, so the same book may legitimately
-- appear on more than one shelf. Moving between shelves must handle the case
-- where the destination row already exists.
--
-- Only 'tbr', 'shelved' and 'completed' are actually maintained. The enum also
-- contains 'reading' and 'wishlist', but no client writes them — "reading" is
-- reading_progress.status, not a shelf. The 7 legacy 'reading' rows were
-- migrated to 'shelved' on 2026-07-29.
-- ============================================================================
create table public.user_library (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  shelf_type public.shelf_type not null,
  priority varchar,
  notes text,
  rating integer,
  review text,
  added_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, book_id, shelf_type),
  constraint priority_check check (priority is null or priority in ('high', 'medium', 'low', 'none')),
  constraint user_library_rating_check check (rating >= 1 and rating <= 5)
);
create index idx_user_library_user on public.user_library (user_id);
create index idx_user_library_book on public.user_library (book_id);
create index idx_user_library_shelf on public.user_library (user_id, shelf_type);


-- ============================================================================
-- CUSTOM SHELVES + SHELF BOOKS (user-named collections)
-- ============================================================================
create table public.custom_shelves (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  name varchar not null,
  description text,
  is_public boolean default false,
  created_at timestamptz default now()
);
create index idx_custom_shelves_user on public.custom_shelves (user_id);

create table public.shelf_books (
  shelf_id uuid not null references public.custom_shelves(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  added_at timestamptz default now(),
  primary key (shelf_id, book_id)
);


-- ============================================================================
-- DISCUSSIONS + COMMENTS
--
-- chapter_number is NOT NULL default 1 and drives the spoiler/progress gating
-- in the RLS policies below. group_id null == a general (non-group) discussion.
-- ============================================================================
create table public.discussions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  group_id uuid references public.reading_groups(id) on delete cascade,
  title varchar,
  content text not null,
  discussion_type varchar default 'general',
  is_spoiler boolean default false,
  is_pinned boolean default false,
  reaction_count integer default 0,
  comment_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  scope_type varchar not null default 'general',
  book_id uuid references public.books(id),
  chapter_number integer not null default 1,
  report_count integer default 0,
  hidden_by_reports boolean default false,
  hidden_at timestamptz,
  reviewed_by_admin uuid references public.users(id),
  review_status text,
  constraint discussions_report_count_check check (report_count >= 0),
  constraint discussions_review_status_check check (review_status in ('pending', 'approved', 'removed')),
  constraint discussions_scope_type_check check (scope_type in ('group', 'general'))
);
create index idx_discussions_book_updated on public.discussions (book_id, updated_at desc);
create index idx_discussions_created_at on public.discussions (created_at desc);
create index idx_discussions_group on public.discussions (group_id);
create index idx_discussions_hidden on public.discussions (hidden_by_reports);
create index idx_discussions_pinned on public.discussions (group_id, is_pinned) where is_pinned = true;
create index idx_discussions_report_count on public.discussions (report_count) where report_count > 0;
create index idx_discussions_user on public.discussions (user_id);
create index idx_discussions_user_completed on public.discussions (user_id, book_id, updated_at desc);

create table public.comments (
  id uuid primary key default uuid_generate_v4(),
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  content text not null,
  reaction_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_spoiler_gated boolean default false,
  report_count integer default 0,
  hidden_by_reports boolean default false,
  hidden_at timestamptz,
  reviewed_by_admin uuid references public.users(id),
  review_status text,
  constraint comments_report_count_check check (report_count >= 0),
  constraint comments_review_status_check check (review_status in ('pending', 'approved', 'removed'))
);
create index idx_comments_created_at on public.comments (created_at desc);
create index idx_comments_discussion on public.comments (discussion_id);
create index idx_comments_hidden on public.comments (hidden_by_reports);
create index idx_comments_parent on public.comments (parent_comment_id);
create index idx_comments_report_count on public.comments (report_count) where report_count > 0;
create index idx_comments_user on public.comments (user_id);


-- ============================================================================
-- REACTIONS (polymorphic — discussions, comments, …)
-- ============================================================================
create table public.reactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  target_type varchar not null,
  target_id uuid not null,
  reaction_type public.reaction_type default 'like',
  created_at timestamptz default now(),
  unique (user_id, target_type, target_id, reaction_type)
);
create index idx_reactions_target on public.reactions (target_type, target_id);
create index idx_reactions_user on public.reactions (user_id);


-- ============================================================================
-- CHANNEL MESSAGE REACTIONS
--
-- Reactions on channel_messages. This is the table the channel chat should use.
-- NOTE the unique key is (message_id, user_id) — WITHOUT reaction_type — so a
-- user holds at most ONE reaction per message. Switching emoji means delete
-- then insert: there is no UPDATE policy on this table.
-- reaction_type is a plain varchar here (no enum, no check), so arbitrary emoji
-- are valid — unlike message_reactions below, which is enum-constrained.
-- ============================================================================
create table public.channel_message_reactions (
  id uuid primary key default uuid_generate_v4(),
  message_id uuid not null references public.channel_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  reaction_type varchar not null default 'like',
  created_at timestamptz default now(),
  unique (message_id, user_id)
);
create index idx_channel_message_reactions_message_id on public.channel_message_reactions (message_id);
create index idx_channel_message_reactions_user_id on public.channel_message_reactions (user_id);


-- ============================================================================
-- MESSAGE REACTIONS
--
-- WARNING: message_id references public.group_messages(id) — the legacy
-- group-level message table — NOT channel_messages. Reactions on channel
-- messages belong in public.channel_message_reactions (same shape, FK to
-- channel_messages) or in channel_messages.reactions jsonb.
-- See KNOWN TRAPS below.
-- ============================================================================
create table public.message_reactions (
  id uuid primary key default uuid_generate_v4(),
  message_id uuid not null references public.group_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  reaction_type public.reaction_type not null default 'like',
  created_at timestamptz default now(),
  unique (message_id, user_id, reaction_type)
);
create index idx_message_reactions_message on public.message_reactions (message_id);


-- ============================================================================
-- NOTIFICATIONS
--
-- Body column is `message` (not `body`), title is NOT NULL, and `type` is the
-- notification_type enum — only the five listed values are accepted.
-- ============================================================================
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  type public.notification_type not null,
  title varchar not null,
  message text,
  related_user_id uuid references public.users(id) on delete set null,
  related_group_id uuid references public.reading_groups(id) on delete set null,
  related_discussion_id uuid references public.discussions(id) on delete set null,
  is_read boolean default false,
  created_at timestamptz default now()
);
create index idx_notifications_created_at on public.notifications (created_at desc);
create index idx_notifications_unread on public.notifications (user_id, is_read) where is_read = false;
create index idx_notifications_user on public.notifications (user_id);


-- ============================================================================
-- REPORTS (moderation queue)
--
-- Three enum columns. The free-text field is `description` (not `reason`), and
-- status defaults to 'pending' (not 'open').
-- ============================================================================
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  target_type public.report_target_type not null,
  target_id uuid not null,
  report_type public.report_type not null,
  description text,
  status public.report_status default 'pending',
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint unique_report unique (reporter_id, target_type, target_id)
);
create index idx_reports_created on public.reports (created_at desc);
create index idx_reports_reporter on public.reports (reporter_id);
create index idx_reports_status on public.reports (status);
create index idx_reports_status_type on public.reports (status, report_type);
create index idx_reports_target on public.reports (target_type, target_id);


-- ============================================================================
-- CREATOR PAYOUT ACCOUNTS
-- One Stripe Connect (Express) account per creator. Group pricing lives on
-- reading_groups.stripe_price_id / stripe_account_id.
-- ============================================================================
create table public.creator_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  stripe_account_id text,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index creator_payout_accounts_stripe_account_id_idx on public.creator_payout_accounts (stripe_account_id);


-- ============================================================================
-- Functions & triggers
-- ============================================================================

-- Mirrors a new auth.users row into public.users. Note it supplies username
-- (NOT NULL) from signup metadata or the email local part, and has no
-- `on conflict do nothing` — a duplicate username will fail signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Forces the counter/visibility defaults on every insert into public.users.
create or replace function public.initialize_user_profile()
returns trigger
language plpgsql
as $$
begin
  new.current_year := extract(year from now());
  new.followers_count := 0;
  new.following_count := 0;
  new.total_pages_read := 0;
  new.yearly_books_completed := 0;
  new.profile_visibility := 'public';
  new.show_reading_activity := true;
  new.show_reading_stats := true;
  new.show_achievements := true;
  return new;
end;
$$;

create trigger initialize_user_profile_trigger
  before insert on public.users
  for each row execute function public.initialize_user_profile();

create trigger update_users_updated_at
  before update on public.users
  for each row execute function public.update_updated_at_column();

-- Helper used by the group_announcements insert policy.
create or replace function public.is_group_admin(p_group_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from group_memberships
    where group_id = p_group_id
      and user_id = p_user_id
      and role = 'admin'
      and is_active = true
  );
end;
$$;


-- ============================================================================
-- Row Level Security
--
-- RLS is enabled on all 24 tables. Policies below are the live ones, verbatim.
-- Multiple SELECT policies on one table are OR'd together.
-- ============================================================================
alter table public.users enable row level security;
alter table public.books enable row level security;
alter table public.reading_groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.group_channels enable row level security;
alter table public.channel_messages enable row level security;
alter table public.group_book_list enable row level security;
alter table public.group_announcements enable row level security;
alter table public.announcement_comments enable row level security;
alter table public.group_subscribers enable row level security;
alter table public.reading_progress enable row level security;
alter table public.chapter_completions enable row level security;
alter table public.personal_notes enable row level security;
alter table public.user_library enable row level security;
alter table public.custom_shelves enable row level security;
alter table public.shelf_books enable row level security;
alter table public.discussions enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.channel_message_reactions enable row level security;
alter table public.message_reactions enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.creator_payout_accounts enable row level security;

-- ---------------------------------------------------------------- users -----
-- Suspended/inactive profiles are invisible to everyone, including themselves.
create policy "Public user profiles are viewable by everyone" on public.users
  for select using (status = 'active'::user_status);
create policy "Users can insert own profile during signup" on public.users
  for insert with check (auth.uid() = id or (auth.uid() is not null and id = auth.uid()));
create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);
create policy "Users can delete own profile" on public.users
  for delete using (auth.uid() = id);

-- ---------------------------------------------------------------- books -----
create policy "Books are publicly readable" on public.books
  for select using (true);
create policy "Authenticated users can insert books" on public.books
  for insert to authenticated with check (true);
create policy "Anyone can update books" on public.books
  for update using (true) with check (true);

-- ------------------------------------------------------- reading_groups -----
-- Note: "Authenticated users can view all groups" makes every group readable
-- to any signed-in user, so the is_public policy is effectively redundant.
create policy "Authenticated users can view all groups" on public.reading_groups
  for select using (auth.uid() is not null);
create policy "Anyone can view public groups" on public.reading_groups
  for select using (is_public = true);
create policy "Authenticated users can create groups" on public.reading_groups
  for insert with check (auth.uid() = created_by);
create policy "Group creators can manage their groups" on public.reading_groups
  for all using (auth.uid() = created_by);

-- --------------------------------------------------- group_memberships -----
-- No DELETE policy exists: leaving a group must be done by setting
-- is_active = false, not by deleting the row.
create policy "Users can view their own memberships" on public.group_memberships
  for select using (auth.uid() = user_id);
create policy "Users can view public group memberships" on public.group_memberships
  for select using (
    exists (select 1 from reading_groups rg where rg.id = group_memberships.group_id and rg.is_public = true)
  );
create policy "Users can join groups" on public.group_memberships
  for insert with check (auth.uid() = user_id);
create policy "Users can manage own membership" on public.group_memberships
  for update using (auth.uid() = user_id);

-- ------------------------------------------------------- group_channels -----
-- Writes require an admin/moderator group_membership row — being
-- reading_groups.created_by is NOT sufficient on its own.
create policy "Users can view channels in their groups" on public.group_channels
  for select using (
    exists (
      select 1 from group_memberships
      where group_memberships.group_id = group_channels.group_id
        and group_memberships.user_id = auth.uid()
    )
  );
create policy "Admins can create channels" on public.group_channels
  for insert with check (
    exists (
      select 1 from group_memberships
      where group_memberships.group_id = group_channels.group_id
        and group_memberships.user_id = auth.uid()
        and group_memberships.role = any (array['admin'::group_role, 'moderator'::group_role])
    )
  );
create policy "Admins can update channels" on public.group_channels
  for update using (
    exists (
      select 1 from group_memberships
      where group_memberships.group_id = group_channels.group_id
        and group_memberships.user_id = auth.uid()
        and group_memberships.role = any (array['admin'::group_role, 'moderator'::group_role])
    )
  );
create policy "Admins can delete custom channels" on public.group_channels
  for delete using (
    channel_type = 'custom'
    and exists (
      select 1 from group_memberships
      where group_memberships.group_id = group_channels.group_id
        and group_memberships.user_id = auth.uid()
        and group_memberships.role = any (array['admin'::group_role, 'moderator'::group_role])
    )
  );

-- ----------------------------------------------------- channel_messages -----
create policy "Users can view messages in their group channels" on public.channel_messages
  for select using (
    exists (
      select 1 from group_channels gc
      join group_memberships gm on gm.group_id = gc.group_id
      where gc.id = channel_messages.channel_id and gm.user_id = auth.uid()
    )
  );
create policy "Users can send messages to their group channels" on public.channel_messages
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from group_channels gc
      join group_memberships gm on gm.group_id = gc.group_id
      where gc.id = channel_messages.channel_id and gm.user_id = auth.uid()
    )
  );
create policy "Users can update their own messages" on public.channel_messages
  for update using (user_id = auth.uid());
create policy "Users can delete their own messages or admins can delete any" on public.channel_messages
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from group_channels gc
      join group_memberships gm on gm.group_id = gc.group_id
      where gc.id = channel_messages.channel_id
        and gm.user_id = auth.uid()
        and gm.role = any (array['admin'::group_role, 'moderator'::group_role])
    )
  );

-- ------------------------------------------------------ group_book_list -----
create policy "group_members_can_read_book_list" on public.group_book_list
  for select using (
    exists (
      select 1 from group_memberships
      where group_memberships.group_id = group_book_list.group_id
        and group_memberships.user_id = auth.uid()
        and group_memberships.is_active = true
    )
  );
create policy "group_admins_can_manage_book_list" on public.group_book_list
  for all using (
    exists (
      select 1 from group_memberships
      where group_memberships.group_id = group_book_list.group_id
        and group_memberships.user_id = auth.uid()
        and group_memberships.role = 'admin'::group_role
        and group_memberships.is_active = true
    )
  );

-- -------------------------------------------------- group_announcements -----
create policy "Group members can read announcements" on public.group_announcements
  for select using (
    exists (
      select 1 from group_memberships
      where group_memberships.group_id = group_announcements.group_id
        and group_memberships.user_id = auth.uid()
        and group_memberships.is_active = true
    )
  );
create policy "Group admins can create announcements" on public.group_announcements
  for insert to authenticated with check (is_group_admin(group_id, auth.uid()));
create policy "Group admins can update announcements" on public.group_announcements
  for update using (
    exists (
      select 1 from group_memberships
      where group_memberships.group_id = group_announcements.group_id
        and group_memberships.user_id = auth.uid()
        and group_memberships.role = 'admin'::group_role
        and group_memberships.is_active = true
    )
  );
create policy "Group admins can delete announcements" on public.group_announcements
  for delete using (
    exists (
      select 1 from group_memberships
      where group_memberships.group_id = group_announcements.group_id
        and group_memberships.user_id = auth.uid()
        and group_memberships.role = 'admin'::group_role
        and group_memberships.is_active = true
    )
  );

-- ------------------------------------------------ announcement_comments -----
create policy "Group members can read announcement comments" on public.announcement_comments
  for select using (
    exists (
      select 1 from group_announcements ga
      join group_memberships gm on gm.group_id = ga.group_id
      where ga.id = announcement_comments.announcement_id and gm.user_id = auth.uid()
    )
  );
create policy "Group members can create announcement comments" on public.announcement_comments
  for insert with check (
    exists (
      select 1 from group_announcements ga
      join group_memberships gm on gm.group_id = ga.group_id
      where ga.id = announcement_comments.announcement_id
        and gm.user_id = auth.uid()
        and ga.allow_comments = true
    )
  );
create policy "Users can manage their own announcement comments" on public.announcement_comments
  for update using (user_id = auth.uid());
create policy "Users can delete their own announcement comments" on public.announcement_comments
  for delete using (user_id = auth.uid());
create policy "Group admins can delete any announcement comment" on public.announcement_comments
  for delete using (
    exists (
      select 1 from group_announcements ga
      join group_memberships gm on gm.group_id = ga.group_id
      where ga.id = announcement_comments.announcement_id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'::group_role
    )
  );

-- ---------------------------------------------------- group_subscribers -----
-- Read-only to end users; inserts/updates go through the service-role client.
create policy "group_subscribers_select_own" on public.group_subscribers
  for select using (subscriber_id = auth.uid());
create policy "group_subscribers_select_as_owner" on public.group_subscribers
  for select using (
    exists (select 1 from reading_groups g where g.id = group_subscribers.group_id and g.created_by = auth.uid())
  );

-- ------------------------------------------------------ reading_progress ----
create policy "Users can view own reading progress" on public.reading_progress
  for select using (auth.uid() = user_id);
create policy "Group members can view reading progress" on public.reading_progress
  for select using (
    auth.uid() = user_id
    or (group_id is not null and auth.uid() in (
      select group_memberships.user_id from group_memberships
      where group_memberships.group_id = reading_progress.group_id
        and group_memberships.is_active = true
    ))
  );
create policy "Users can insert own reading progress" on public.reading_progress
  for insert with check (auth.uid() = user_id);
create policy "Users can update own reading progress" on public.reading_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own reading progress" on public.reading_progress
  for delete using (auth.uid() = user_id);

-- --------------------------------------------------- chapter_completions ----
create policy "Users can manage own chapter completions" on public.chapter_completions
  for all using (auth.uid() = user_id);
create policy "Users can view relevant chapter completions" on public.chapter_completions
  for select using (
    auth.uid() = user_id
    or (group_id is not null and auth.uid() in (
      select group_memberships.user_id from group_memberships
      where group_memberships.group_id = chapter_completions.group_id
        and group_memberships.is_active = true
    ))
  );

-- --------------------------------------------------------- personal_notes ---
create policy "Users can manage their own notes" on public.personal_notes
  for all using (auth.uid() = user_id);

-- ---------------------------------------------------------- user_library ---
create policy "Users can view own library" on public.user_library
  for select using (auth.uid() = user_id);
create policy "Users can manage own library" on public.user_library
  for all using (auth.uid() = user_id);

-- ------------------------------------------- custom_shelves / shelf_books ---
create policy "Users can view own custom shelves" on public.custom_shelves
  for select using (auth.uid() = user_id or is_public = true);
create policy "Users can manage own custom shelves" on public.custom_shelves
  for all using (auth.uid() = user_id);

create policy "Users can view accessible shelf books" on public.shelf_books
  for select using (
    shelf_id in (select custom_shelves.id from custom_shelves
                 where custom_shelves.user_id = auth.uid() or custom_shelves.is_public = true)
  );
create policy "Users can manage own shelf books" on public.shelf_books
  for all using (
    shelf_id in (select custom_shelves.id from custom_shelves where custom_shelves.user_id = auth.uid())
  );

-- ----------------------------------------------------------- discussions ----
-- Spoiler gating is enforced in the database: a discussion tied to a chapter is
-- invisible until the reader's reading_progress.current_chapter reaches it.
create policy "Reading progress based discussion visibility" on public.discussions
  for select using (
    auth.uid() is not null
    and (group_id is null or auth.uid() in (
      select gm.user_id from group_memberships gm
      where gm.group_id = discussions.group_id and gm.is_active = true
    ))
    and (chapter_number is null or exists (
      select 1 from reading_progress rp
      where rp.book_id = discussions.book_id
        and rp.user_id = auth.uid()
        and rp.current_chapter >= discussions.chapter_number
    ))
  );
create policy "Users can view non-hidden discussions" on public.discussions
  for select to authenticated using (
    hidden_by_reports = false or hidden_by_reports is null or user_id = auth.uid()
    or exists (select 1 from users where users.id = auth.uid() and users.is_admin = true)
  );
create policy "Authenticated users can create discussions" on public.discussions
  for insert with check (auth.uid() = user_id);
create policy "Authors can update own discussions" on public.discussions
  for update using (auth.uid() = user_id);
create policy "Admins can update discussion review status" on public.discussions
  for update to authenticated
  using (exists (select 1 from users where users.id = auth.uid() and users.is_admin = true))
  with check (exists (select 1 from users where users.id = auth.uid() and users.is_admin = true));
create policy "Authors and moderators can delete discussions" on public.discussions
  for delete using (
    auth.uid() = user_id
    or auth.uid() in (
      select group_memberships.user_id from group_memberships
      where group_memberships.group_id = discussions.group_id
        and group_memberships.role = any (array['admin'::group_role, 'moderator'::group_role])
        and group_memberships.is_active = true
    )
  );

-- -------------------------------------------------------------- comments ----
create policy "Users can view comments based on reading progress" on public.comments
  for select using (
    auth.uid() is not null
    and (is_spoiler_gated = false or is_spoiler_gated is null or exists (
      select 1 from discussions d
      left join reading_progress rp on rp.book_id = d.book_id
      where d.id = comments.discussion_id
        and rp.user_id = auth.uid()
        and rp.current_chapter >= d.chapter_number
    ))
  );
create policy "Users can view comments on accessible discussions" on public.comments
  for select using (
    discussion_id in (
      select d.id from discussions d
      left join group_memberships gm on d.group_id = gm.group_id
      where (d.group_id is null or (gm.user_id = auth.uid() and gm.is_active = true))
        and (d.chapter_number is null or auth.uid() in (
          select cc.user_id from chapter_completions cc
          where cc.chapter_number = d.chapter_number
            and cc.book_id = d.book_id
            and (cc.group_id = d.group_id or cc.group_id is null)
        ))
    )
  );
create policy "Users can view non-hidden comments" on public.comments
  for select to authenticated using (
    hidden_by_reports = false or hidden_by_reports is null or user_id = auth.uid()
    or exists (select 1 from users where users.id = auth.uid() and users.is_admin = true)
  );
create policy "Authenticated users can create comments" on public.comments
  for insert with check (auth.uid() is not null);
create policy "Users can comment on accessible discussions" on public.comments
  for insert with check (
    discussion_id in (
      select discussions.id from discussions
      where auth.uid() in (
        select group_memberships.user_id from group_memberships
        where group_memberships.group_id = discussions.group_id
          and group_memberships.is_active = true
      )
    )
  );
create policy "Users can update own comments" on public.comments
  for update using (auth.uid() = user_id);
create policy "Authors can update own comments" on public.comments
  for update using (auth.uid() = user_id);
create policy "Admins can update comment review status" on public.comments
  for update to authenticated
  using (exists (select 1 from users where users.id = auth.uid() and users.is_admin = true))
  with check (exists (select 1 from users where users.id = auth.uid() and users.is_admin = true));
create policy "Users can delete own comments" on public.comments
  for delete using (auth.uid() = user_id);
create policy "Authors and moderators can delete comments" on public.comments
  for delete using (
    auth.uid() = user_id
    or auth.uid() in (
      select gm.user_id from group_memberships gm
      join discussions d on d.group_id = gm.group_id
      where d.id = comments.discussion_id
        and gm.role = any (array['admin'::group_role, 'moderator'::group_role])
        and gm.is_active = true
    )
  );

-- ------------------------------------------------------------- reactions ----
create policy "Users can view reactions on accessible content" on public.reactions
  for select using (true);
create policy "Authenticated users can react to content" on public.reactions
  for insert with check (auth.uid() = user_id);
create policy "Users can manage own reactions" on public.reactions
  for delete using (auth.uid() = user_id);

-- --------------------------------------------- channel_message_reactions ----
-- Note there is no UPDATE policy — changing a reaction requires delete+insert.
create policy "Users can view reactions in their group channels" on public.channel_message_reactions
  for select using (
    exists (
      select 1 from channel_messages cm
      join group_channels gc on gc.id = cm.channel_id
      join group_memberships gm on gm.group_id = gc.group_id
      where cm.id = channel_message_reactions.message_id and gm.user_id = auth.uid()
    )
  );
create policy "Users can add reactions to messages" on public.channel_message_reactions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from channel_messages cm
      join group_channels gc on gc.id = cm.channel_id
      join group_memberships gm on gm.group_id = gc.group_id
      where cm.id = channel_message_reactions.message_id and gm.user_id = auth.uid()
    )
  );
create policy "Users can remove their own reactions" on public.channel_message_reactions
  for delete using (user_id = auth.uid());

-- ----------------------------------------------------- message_reactions ----
-- The SELECT policy joins through group_messages, so rows whose message_id
-- points at a channel_messages id are never visible.
create policy "Users can view reactions on accessible messages" on public.message_reactions
  for select using (
    exists (
      select 1 from group_messages gm
      join group_memberships gmb on gm.group_id = gmb.group_id
      where gm.id = message_reactions.message_id
        and gmb.user_id = auth.uid()
        and gmb.is_active = true
    )
  );
create policy "Users can manage their own reactions" on public.message_reactions
  for all using (user_id = auth.uid());

-- --------------------------------------------------------- notifications ----
-- No INSERT policy: notifications must be written with the service-role client.
create policy "Users can view own notifications" on public.notifications
  for select using (auth.uid() = user_id);
create policy "Users can update own notifications" on public.notifications
  for update using (auth.uid() = user_id);

-- --------------------------------------------------------------- reports ----
-- Reporters see only their own reports. The admin-read path does not exist as a
-- policy — "Admins can update reports" is `using (false)`, i.e. a no-op — so the
-- admin queue has to use the service-role client.
create policy "Users can view their own reports" on public.reports
  for select using (auth.uid() = reporter_id);
create policy "Users can create reports" on public.reports
  for insert with check (auth.uid() = reporter_id);
create policy "Admins can update reports" on public.reports
  for update using (false);

-- ------------------------------------------- creator_payout_accounts --------
create policy "payout_account_select_own" on public.creator_payout_accounts
  for select using (user_id = auth.uid());
create policy "payout_account_insert_own" on public.creator_payout_accounts
  for insert with check (user_id = auth.uid());
create policy "payout_account_update_own" on public.creator_payout_accounts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ============================================================================
-- KNOWN TRAPS
--
-- 1. public.group_books does not exist. The live table is group_book_list, and
--    it has no is_premium column — premium gating exists only on
--    group_channels.is_premium.
--
-- 2. message_reactions.message_id FKs to group_messages, not channel_messages.
--    Any web code writing message_reactions for a channel message will fail the
--    FK; and its SELECT policy joins group_messages, so such rows would be
--    invisible anyway. Use channel_message_reactions or the
--    channel_messages.reactions jsonb column instead.
--
-- 3. Enum columns reject unknown values at write time: users.status,
--    reading_progress.status, group_memberships.role, notifications.type,
--    reports.target_type / report_type / status, chapter_completions.
--    reflection_type, reactions.reaction_type, message_reactions.reaction_type.
--
-- 4. Column-name mismatches that older web code got wrong:
--    notifications.message (not body), reports.description (not reason),
--    group_memberships.joined_at (not created_at),
--    channel_messages.reply_to_message_id (not parent_message_id),
--    users.profile_image_url exists alongside avatar_url.
--
-- 5. public.users has no FK to auth.users. Deleting an auth user leaves an
--    orphan profile row.
--
-- 6. group_channels writes require an admin/moderator group_memberships row.
--    Being reading_groups.created_by does not by itself grant channel writes.
--
-- 7. notifications and reports have no usable admin/insert policies — those
--    paths need the service-role client (lib/supabase/admin.ts).
--
-- 8. reading_progress.current_chapter defaults to 1, and chapter_completions
--    has no created_at (use completed_at).
--
-- 9. Realtime is opt-in per table. The supabase_realtime publication was empty
--    until 2026-08-02, so every .on('postgres_changes', ...) subscription
--    silently never fired. Currently published: channel_messages,
--    channel_message_reactions. Any other table you subscribe to needs
--    `alter publication supabase_realtime add table public.<t>;` first.
--    Replica identity is default (PK only), so DELETE payloads carry just id.
--
-- 10. Chapter gating is a WRITE-TIME stamp, not a read-time rule. Both apps set
--     channel_messages.chapter_number on insert when the channel
--     is_chapter_gated: a top-level message gets the sender's chapter, a reply
--     inherits its PARENT's chapter (never the replier's), an ungated channel
--     gets null. Reads filter with a plain `.lte('chapter_number', gate)` where
--     gate = current_chapter - 1 (chapters *completed*). NULL fails that
--     comparison, so an unstamped row is invisible in a gated channel. Nothing
--     in RLS enforces the stamp — it is a client-side contract both apps keep,
--     and Realtime subscribers must re-apply the check by hand.
--
-- 11. channel_messages.reply_to_message_id is ON DELETE CASCADE as of
--     2026-08-02 (was SET NULL, which silently promoted a deleted thread's
--     replies to top-level messages in the channel feed). Deleting a message
--     now deletes its whole thread — confirm with the user before deleting a
--     message that has replies.
--
-- 12. shelf_books has NO id column — its primary key is (shelf_id, book_id).
--    Selecting `id` makes PostgREST reject the whole query (42703), which
--    silently empties the library's collections view. Same for message
--    ordering keys generally: check the PK before assuming a surrogate id.
--
-- 13. Storage buckets are NOT dumped in this file. Two exist, both public with a
--     5 MB limit: profile-images (jpeg/png/webp) and group-banners
--     (jpeg/jpg/png/webp). group-banners objects are keyed
--     `<group_id>/<timestamp>.<ext>`, and reading_groups.banner_image_url holds
--     the resulting public URL.
--     Its write policies were rewritten 2026-08-02: insert used to allow ANY
--     authenticated user into ANY group's folder, and update/delete compared
--     reading_groups.id against storage.foldername(reading_groups.NAME) — the
--     group's name, not the object's — so they never matched and every banner
--     change orphaned the old file. All three now key on
--     (storage.foldername(objects.name))[1] = a group the caller created.
--     Beware that ambiguity: storage.objects.name and reading_groups.name are
--     both `name`, so always qualify as objects.name inside these policies.
-- ============================================================================
