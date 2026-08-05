import Link from 'next/link'
import { BookOpen, MessageSquare, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/queries'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { BookSwitcher, type BookSwitcherEntry } from '@/components/currently-reading/book-switcher'
import type { DiscussionWithUser } from '@/components/discussions/discussion-thread'
import type { Book, ChapterCompletion, ReadingProgress } from '@/lib/types'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// Supabase returns embedded to-one relations as an object, but occasionally
// as a one-element array depending on the inferred FK direction — normalize.
function single<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export default async function HomePage() {
  const supabase = await createClient()
  const profile = await getProfile()
  const userId = profile?.id ?? ''

  const [{ data: progress }, { data: completions }, { count: unread }] =
    await Promise.all([
      supabase
        .from('reading_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'reading')
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('chapter_completions')
        .select('*')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(8),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false),
    ])

  const reading = (progress ?? []) as ReadingProgress[]
  const activity = (completions ?? []) as ChapterCompletion[]

  const bookIds = Array.from(
    new Set([
      ...reading.map((p) => p.book_id),
      ...activity.map((c) => c.book_id),
    ]),
  )
  const groupIds = Array.from(
    new Set(reading.map((p) => p.group_id).filter((id): id is string => Boolean(id))),
  )

  const [{ data: books }, { data: groups }, { data: memberProgress }, { data: notes }, { data: discussionRows }] =
    await Promise.all([
      bookIds.length
        ? supabase.from('books').select('*').in('id', bookIds)
        : Promise.resolve({ data: [] as Book[] }),
      groupIds.length
        ? supabase.from('reading_groups').select('id, name').in('id', groupIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      groupIds.length && bookIds.length
        ? supabase
            .from('reading_progress')
            .select('user_id, group_id, book_id, completed_chapters, current_chapter')
            .in('group_id', groupIds)
            .in('book_id', bookIds)
        : Promise.resolve({ data: [] as Array<{ user_id: string; group_id: string; book_id: string; completed_chapters: number | null; current_chapter: number }> }),
      bookIds.length
        ? supabase
            .from('personal_notes')
            .select('book_id, note_content, created_at')
            .eq('user_id', userId)
            .in('book_id', bookIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as Array<{ book_id: string; note_content: string | null; created_at: string }> }),
      bookIds.length
        ? supabase
            .from('discussions')
            .select('*, user:users!discussions_user_id_fkey(display_name, username, avatar_url)')
            .in('book_id', bookIds)
            .eq('hidden_by_reports', false)
            .order('created_at', { ascending: false })
            .limit(60)
        : Promise.resolve({ data: [] as DiscussionWithUser[] }),
    ])

  const bookMap = new Map((books ?? []).map((b: Book) => [b.id, b]))
  const groupNameMap = new Map((groups ?? []).map((g) => [g.id, g.name]))

  const memberUserIds = Array.from(
    new Set((memberProgress ?? []).map((m) => m.user_id).filter((id) => id !== userId)),
  )
  const { data: memberUsers } = memberUserIds.length
    ? await supabase
        .from('users')
        .select('id, display_name, username, avatar_url')
        .in('id', memberUserIds)
    : { data: [] as Array<{ id: string; display_name: string | null; username: string | null; avatar_url: string | null }> }
  const memberUserMap = new Map((memberUsers ?? []).map((u) => [u.id, u]))

  const notesByBook = new Map<string, { content: string; createdAt: string }>()
  for (const n of notes ?? []) {
    if (!n.note_content || notesByBook.has(n.book_id)) continue
    notesByBook.set(n.book_id, { content: n.note_content, createdAt: n.created_at })
  }

  const discussionsByBook = new Map<string, DiscussionWithUser[]>()
  for (const row of (discussionRows ?? []) as DiscussionWithUser[]) {
    const normalized = { ...row, user: single(row.user) } as DiscussionWithUser
    const list = discussionsByBook.get(row.book_id!) ?? []
    list.push(normalized)
    discussionsByBook.set(row.book_id!, list)
  }

  const cards: BookSwitcherEntry[] = reading
    .map((p) => {
      const book = bookMap.get(p.book_id)
      if (!book) return null

      const membersForThisBook = (memberProgress ?? []).filter(
        (m) => m.book_id === p.book_id && m.group_id === p.group_id && m.user_id !== userId,
      )
      const readingWith = membersForThisBook
        .map((m) => {
          const u = memberUserMap.get(m.user_id)
          if (!u) return null
          return {
            userId: m.user_id,
            name: u.display_name || u.username || 'Reader',
            avatarUrl: u.avatar_url,
          }
        })
        .filter((u): u is { userId: string; name: string; avatarUrl: string | null } => u !== null)

      const completedValues = membersForThisBook.map(
        (m) => m.completed_chapters ?? Math.max(0, (m.current_chapter ?? 1) - 1),
      )
      const meanCompletedChapters = completedValues.length
        ? Math.round(completedValues.reduce((a, b) => a + b, 0) / completedValues.length)
        : null

      // Chapter gate, mirroring the `Reading progress based discussion
      // visibility` RLS policy: a thread stamped at chapter N is a spoiler
      // until you've reached N. RLS enforces this too — this is the second
      // layer, because the DB gate silently sat dead behind an over-permissive
      // policy for a long time and nothing here caught it.
      const scopedDiscussions = (discussionsByBook.get(p.book_id) ?? [])
        .filter((d) => d.scope_type === 'general' || (d.scope_type === 'group' && d.group_id === p.group_id))
        .filter((d) => typeof d.chapter_number === 'number' && d.chapter_number <= (p.current_chapter ?? 0))
        .slice(0, 10)

      const entry: BookSwitcherEntry = {
        progress: p,
        book,
        groupName: p.group_id ? groupNameMap.get(p.group_id) ?? null : null,
        readingWith,
        meanCompletedChapters,
        lastNote: notesByBook.get(p.book_id) ?? null,
        currentUser: {
          id: userId,
          name: profile?.display_name || profile?.username || 'You',
          avatarUrl: profile?.avatar_url ?? null,
        },
        discussions: scopedDiscussions,
      }
      return entry
    })
    .filter((c): c is BookSwitcherEntry => c !== null)

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PageHeader
        title={`Hi, ${profile?.display_name?.split(' ')[0] ?? 'reader'}`}
        subtitle="Here's what's happening with your reading."
        unread={unread ?? 0}
      />

      <div className="px-5 pb-4 md:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
        {/* Main column — currently reading + discussions */}
        <section className="min-w-0">
          <h2 className="mb-4 font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
            Currently reading
          </h2>
          {cards.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No active books"
              description="Add a book to your shelf and start tracking chapters."
              actionLabel="Browse library"
              actionHref="/library"
            />
          ) : (
            <BookSwitcher cards={cards} />
          )}
        </section>

        {/* Right rail — recent activity + groups shortcut */}
        <div className="mt-8 min-w-0 space-y-8 lg:mt-0">
          <section>
            <h2 className="mb-4 font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
              Recent activity
            </h2>
            {activity.length === 0 ? (
              <p className="text-[15px] text-[var(--text-secondary)]">
                Your chapter completions will show up here.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[var(--border-main)] bg-[var(--surface)]">
                {activity.map((c, i) => {
                  const book = bookMap.get(c.book_id)
                  return (
                    <div
                      key={c.id}
                      className={`flex items-start gap-3 p-3.5 ${
                        i > 0 ? 'border-t border-[var(--border-main)]' : ''
                      }`}
                    >
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--success)]/12 text-[var(--success)]">
                        <BookOpen className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] text-[var(--text-primary)]">
                          Finished chapter {c.chapter_number} of{' '}
                          <span className="font-medium">
                            {book?.title ?? 'a book'}
                          </span>
                        </p>
                        {c.reflection_text && (
                          <p className="mt-0.5 line-clamp-2 text-sm text-[var(--text-secondary)]">
                            &ldquo;{c.reflection_text}&rdquo;
                          </p>
                        )}
                        <span className="mt-1 block text-xs text-[var(--text-tertiary)]">
                          {timeAgo(c.completed_at)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Pinned threads / groups shortcut */}
          <section>
            <Link
              href="/groups"
              className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <MessageSquare className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-[var(--text-primary)]">
                    Reading groups
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Join the conversation with fellow readers.
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-[var(--text-tertiary)]" />
            </Link>
          </section>
        </div>
      </div>
    </div>
  )
}
