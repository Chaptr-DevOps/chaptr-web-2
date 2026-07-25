-- ============================================================================
-- Chaptr schema. Run this against your Supabase project (SQL editor) to
-- provision every table the web app reads/writes. Safe to re-run.
-- ============================================================================

-- USERS (public profile mirror of auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  bio text,
  avatar_url text,
  favorite_genre text,
  preferred_genres text[] default '{}',
  reading_streak integer default 0,
  current_streak_start date,
  average_reading_speed numeric,
  yearly_reading_goal integer,
  total_books_completed integer default 0,
  total_pages_read integer default 0,
  onboarding_completed_at timestamptz,
  is_admin boolean default false,
  status text default 'active',
  created_at timestamptz default now()
);

-- BOOKS
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  total_pages integer,
  total_chapters integer,
  cover_image_url text,
  created_at timestamptz default now()
);

-- READING GROUPS (with paid subscription layer)
create table if not exists public.reading_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.users(id) on delete set null,
  current_book_id uuid references public.books(id) on delete set null,
  reading_pace text,
  is_public boolean default true,
  invite_code text unique,
  is_paid boolean default false,
  price numeric,
  stripe_price_id text,
  created_at timestamptz default now()
);

-- READING PROGRESS
create table if not exists public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  group_id uuid references public.reading_groups(id) on delete set null,
  current_chapter integer default 0,
  progress_percentage numeric default 0,
  status text default 'reading',
  created_at timestamptz default now()
);

-- CHAPTER COMPLETIONS
create table if not exists public.chapter_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  group_id uuid references public.reading_groups(id) on delete set null,
  chapter_number integer not null,
  reflection_text text,
  completed_at timestamptz default now()
);

-- PERSONAL NOTES
create table if not exists public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_number integer,
  note_content text,
  is_private boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- GROUP CHANNELS (chapter-gated and/or premium-gated)
create table if not exists public.group_channels (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.reading_groups(id) on delete cascade,
  name text not null,
  channel_type text default 'text',
  is_chapter_gated boolean default false,
  is_premium boolean default false,
  created_at timestamptz default now()
);

-- CHANNEL MESSAGES
create table if not exists public.channel_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.group_channels(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text,
  chapter_number integer,
  is_spoiler_gated boolean default false,
  parent_message_id uuid references public.channel_messages(id) on delete cascade,
  created_at timestamptz default now()
);

-- GROUP SUBSCRIPTIONS (paid layer)
create table if not exists public.group_subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.users(id) on delete cascade,
  group_id uuid not null references public.reading_groups(id) on delete cascade,
  status text default 'active',
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  unique (subscriber_id, group_id)
);

-- GROUP BOOKS (free + premium/bonus books per group)
create table if not exists public.group_books (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.reading_groups(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  is_premium boolean default false,
  created_at timestamptz default now(),
  unique (group_id, book_id)
);

-- GROUP MEMBERSHIPS
create table if not exists public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.reading_groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text default 'member',
  is_active boolean default true,
  last_activity timestamptz default now(),
  created_at timestamptz default now(),
  unique (group_id, user_id)
);

-- CREATOR PAYOUT ACCOUNTS (Stripe Connect placeholder)
create table if not exists public.creator_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade unique,
  stripe_account_id text,
  onboarding_complete boolean default false,
  created_at timestamptz default now()
);

-- NOTIFICATIONS
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text,
  title text,
  body text,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- REPORTS (admin queue)
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users(id) on delete set null,
  target_type text,
  target_id uuid,
  reason text,
  status text default 'open',
  created_at timestamptz default now()
);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.users enable row level security;
alter table public.books enable row level security;
alter table public.reading_groups enable row level security;
alter table public.reading_progress enable row level security;
alter table public.chapter_completions enable row level security;
alter table public.personal_notes enable row level security;
alter table public.group_channels enable row level security;
alter table public.channel_messages enable row level security;
alter table public.group_subscriptions enable row level security;
alter table public.group_books enable row level security;
alter table public.group_memberships enable row level security;
alter table public.creator_payout_accounts enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;

-- users: anyone signed in can read profiles; you can only write your own
drop policy if exists "users_select_all" on public.users;
create policy "users_select_all" on public.users for select using (true);
drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own" on public.users for insert with check (auth.uid() = id);
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users for update using (auth.uid() = id);

-- books: readable by all authenticated, insertable by any authenticated user
drop policy if exists "books_select_all" on public.books;
create policy "books_select_all" on public.books for select using (true);
drop policy if exists "books_insert_auth" on public.books;
create policy "books_insert_auth" on public.books for insert with check (auth.uid() is not null);

-- reading_groups: public groups visible to all; writes by creator
drop policy if exists "groups_select" on public.reading_groups;
create policy "groups_select" on public.reading_groups for select using (
  is_public
  or created_by = auth.uid()
  or exists (
    select 1 from public.group_memberships
    where group_memberships.group_id = reading_groups.id
    and group_memberships.user_id = auth.uid()
    and group_memberships.is_active = true
  )
);
drop policy if exists "groups_insert_own" on public.reading_groups;
create policy "groups_insert_own" on public.reading_groups for insert with check (created_by = auth.uid());
drop policy if exists "groups_update_own" on public.reading_groups;
create policy "groups_update_own" on public.reading_groups for update using (created_by = auth.uid());

-- Generic owner policies for per-user tables
drop policy if exists "progress_own" on public.reading_progress;
create policy "progress_own" on public.reading_progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "completions_own" on public.chapter_completions;
create policy "completions_own" on public.chapter_completions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "completions_select_all" on public.chapter_completions;
create policy "completions_select_all" on public.chapter_completions for select using (true);

drop policy if exists "notes_own" on public.personal_notes;
create policy "notes_own" on public.personal_notes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "channels_select_all" on public.group_channels;
create policy "channels_select_all" on public.group_channels for select using (true);
drop policy if exists "channels_manage" on public.group_channels;
create policy "channels_manage" on public.group_channels for all
  using (exists (select 1 from public.reading_groups g where g.id = group_id and g.created_by = auth.uid()))
  with check (exists (select 1 from public.reading_groups g where g.id = group_id and g.created_by = auth.uid()));

drop policy if exists "messages_select_all" on public.channel_messages;
create policy "messages_select_all" on public.channel_messages for select using (true);
drop policy if exists "messages_insert_own" on public.channel_messages;
create policy "messages_insert_own" on public.channel_messages for insert with check (user_id = auth.uid());

drop policy if exists "subs_own" on public.group_subscriptions;
create policy "subs_own" on public.group_subscriptions for all using (subscriber_id = auth.uid()) with check (subscriber_id = auth.uid());

drop policy if exists "group_books_select_all" on public.group_books;
create policy "group_books_select_all" on public.group_books for select using (true);
drop policy if exists "group_books_manage" on public.group_books;
create policy "group_books_manage" on public.group_books for all
  using (exists (select 1 from public.reading_groups g where g.id = group_id and g.created_by = auth.uid()))
  with check (exists (select 1 from public.reading_groups g where g.id = group_id and g.created_by = auth.uid()));

drop policy if exists "memberships_select_all" on public.group_memberships;
create policy "memberships_select_all" on public.group_memberships for select using (true);
drop policy if exists "memberships_own" on public.group_memberships;
create policy "memberships_own" on public.group_memberships for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "payout_own" on public.creator_payout_accounts;
create policy "payout_own" on public.creator_payout_accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notifications_own" on public.notifications;
create policy "notifications_own" on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert" on public.reports for insert with check (reporter_id = auth.uid());
drop policy if exists "reports_admin_read" on public.reports;
create policy "reports_admin_read" on public.reports for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin));

-- ============================================================================
-- Auto-create a public.users row when someone signs up
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- MESSAGE REACTIONS
-- ============================================================================
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.channel_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  reaction_type text not null,
  created_at timestamptz default now(),
  unique (message_id, user_id, reaction_type)
);

alter table public.message_reactions enable row level security;

drop policy if exists "reactions_select_all" on public.message_reactions;
create policy "reactions_select_all" on public.message_reactions for select using (true);

drop policy if exists "reactions_insert_own" on public.message_reactions;
create policy "reactions_insert_own" on public.message_reactions for insert with check (user_id = auth.uid());

drop policy if exists "reactions_delete_own" on public.message_reactions;
create policy "reactions_delete_own" on public.message_reactions for delete using (user_id = auth.uid());

