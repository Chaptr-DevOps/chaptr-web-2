import Link from 'next/link'
import { Flame, BookOpen, MessageSquare, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/queries'
import { PageHeader } from '@/components/page-header'
import { BookCover } from '@/components/book-cover'
import { Progress } from '@/components/ui/progress'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
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

export default async function HomePage() {
  const supabase = await createClient()
  const profile = await getProfile()

  const [{ data: progress }, { data: completions }, { count: unread }] =
    await Promise.all([
      supabase
        .from('reading_progress')
        .select('*')
        .eq('user_id', profile?.id ?? '')
        .eq('status', 'reading')
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('chapter_completions')
        .select('*')
        .eq('user_id', profile?.id ?? '')
        .order('completed_at', { ascending: false })
        .limit(8),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false),
    ])

  const bookIds = Array.from(
    new Set([
      ...(progress ?? []).map((p) => p.book_id),
      ...(completions ?? []).map((c) => c.book_id),
    ]),
  )
  const { data: books } = bookIds.length
    ? await supabase.from('books').select('*').in('id', bookIds)
    : { data: [] as Book[] }
  const bookMap = new Map((books ?? []).map((b: Book) => [b.id, b]))

  const reading = (progress ?? []) as ReadingProgress[]
  const activity = (completions ?? []) as ChapterCompletion[]

  return (
    <div>
      <PageHeader
        title={`Hi, ${profile?.display_name?.split(' ')[0] ?? 'reader'}`}
        subtitle="Here's what's happening with your reading."
        unread={unread ?? 0}
      />

      <div className="space-y-8 px-5 md:px-8">
        {/* Streak banner */}
        <Card
          elevated
          className="flex items-center gap-4 border-primary/30 bg-primary/8 p-5"
        >
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-[var(--interactive-primary-foreground)]">
            <Flame className="h-7 w-7" />
          </span>
          <div>
            <p className="font-serif text-[34px] leading-9 tracking-[-0.7px] text-[var(--text-primary)]">
              {profile?.reading_streak ?? 0}-day streak
            </p>
            <p className="text-[15px] text-[var(--text-secondary)]">
              {profile?.reading_streak
                ? 'Keep it going — read a chapter today!'
                : 'Log a chapter to start your streak.'}
            </p>
          </div>
        </Card>

        {/* Currently reading */}
        <section>
          <h2 className="mb-4 font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
            Currently reading
          </h2>
          {reading.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No active books"
              description="Add a book to your shelf and start tracking chapters."
              actionLabel="Browse library"
              actionHref="/library"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {reading.map((p) => {
                const book = bookMap.get(p.book_id)
                if (!book) return null
                return (
                  <Link
                    key={p.id}
                    href={`/library/notes/${book.id}`}
                    className="flex gap-4 rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-4 transition-colors hover:border-primary/50"
                  >
                    <div className="w-16 shrink-0">
                      <BookCover
                        title={book.title}
                        author={book.author}
                        src={book.cover_image_url}
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="truncate font-medium text-[var(--text-primary)]">
                        {book.title}
                      </p>
                      <p className="truncate text-sm text-[var(--text-secondary)]">
                        {book.author}
                      </p>
                      <div className="mt-auto">
                        <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                          <span>Chapter {p.current_chapter}</span>
                          <span>{Math.round(p.progress_percentage)}%</span>
                        </div>
                        <Progress value={p.progress_percentage} />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Recent activity */}
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
                    className={`flex items-start gap-3 p-4 ${
                      i > 0 ? 'border-t border-[var(--border-main)]' : ''
                    }`}
                  >
                    <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--success)]/12 text-[var(--success)]">
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
                    </div>
                    <span className="shrink-0 text-xs text-[var(--text-tertiary)]">
                      {timeAgo(c.completed_at)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Pinned threads / groups shortcut */}
        <section className="pb-4">
          <Link
            href="/groups"
            className="flex items-center justify-between rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-5 transition-colors hover:border-primary/50"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <MessageSquare className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium text-[var(--text-primary)]">
                  Reading groups
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  Join the conversation with fellow readers.
                </p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-[var(--text-tertiary)]" />
          </Link>
        </section>
      </div>
    </div>
  )
}
