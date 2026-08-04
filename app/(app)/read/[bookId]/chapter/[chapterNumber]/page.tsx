import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/queries'
import type { ChapterNote } from '@/components/chapter/types'
import { ChapterCompletionClient } from './chapter-completion-client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ bookId: string; chapterNumber: string }>
  searchParams: Promise<{ group?: string }>
}

export default async function ChapterCompletionPage({ params, searchParams }: PageProps) {
  const { bookId, chapterNumber: chapterParam } = await params
  const { group } = await searchParams
  const groupId = group ?? null

  const user = await getAuthUser()
  if (!user) redirect('/signin')

  const chapterNumber = Number(chapterParam)
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) notFound()

  const supabase = await createClient()

  const { data: book } = await supabase
    .from('books')
    .select('id, title, author, cover_image_url, total_chapters')
    .eq('id', bookId)
    .maybeSingle()

  if (!book) notFound()

  let progressQuery = supabase
    .from('reading_progress')
    .select(
      'id, current_chapter, completed_chapters, total_chapters, completion_target_date, started_at'
    )
    .eq('user_id', user.id)
    .eq('book_id', bookId)

  progressQuery = groupId
    ? progressQuery.eq('group_id', groupId)
    : progressQuery.is('group_id', null)

  const { data: progress } = await progressQuery.maybeSingle()

  // You cannot log a chapter for a book you are not reading.
  if (!progress) redirect('/library')

  const totalChapters = progress.total_chapters ?? book.total_chapters ?? 0
  if (totalChapters > 0 && chapterNumber > totalChapters) notFound()

  // Snippets only. Completing the chapter collapses these into a single
  // 'chapter_completion' note (see completeChapterWithNotes) — loading that
  // combined note back into the composer would show it as one giant bullet and
  // re-collapse it on the next completion. Earlier notes stay in the library.
  const { data: noteRows } = await supabase
    .from('personal_notes')
    .select('id, note_content')
    .eq('user_id', user.id)
    .eq('book_id', bookId)
    .eq('chapter_number', chapterNumber)
    .eq('note_type', 'snippet')
    .order('created_at', { ascending: true })

  const initialNotes: ChapterNote[] = (noteRows ?? [])
    .filter((n) => n.note_content)
    .map((n) => ({ id: n.id, content: n.note_content as string }))

  // Group-scoped deliberately: this array gates the Complete Chapter button, and
  // the server's duplicate guard in completeChapterWithNotes is group-scoped too.
  // Without the filter, logging a chapter solo would block logging it in a group
  // (and vice versa) — a case the server correctly allows.
  let completionsQuery = supabase
    .from('chapter_completions')
    .select('chapter_number, completed_at')
    .eq('user_id', user.id)
    .eq('book_id', bookId)

  completionsQuery = groupId
    ? completionsQuery.eq('group_id', groupId)
    : completionsQuery.is('group_id', null)

  const { data: completions } = await completionsQuery

  const completedChapterNumbers = [
    ...new Set((completions ?? []).map((c) => c.chapter_number)),
  ]

  // Feeds the pace stat on the success screen. `completed_at` is nullable in the
  // schema, so drop the rows that carry no timestamp rather than letting them
  // parse as Invalid Date.
  const completionDates = (completions ?? [])
    .map((c) => c.completed_at)
    .filter((t): t is string => Boolean(t))

  let groupColor: string | null = null
  if (groupId) {
    const { data: groupRow } = await supabase
      .from('reading_groups')
      .select('primary_color')
      .eq('id', groupId)
      .maybeSingle()
    groupColor = groupRow?.primary_color ?? null
  }

  return (
    // The key is load-bearing. The chapter picker navigates between chapters,
    // which re-renders this Server Component with fresh initialNotes — but the
    // client component sits at the same tree position, so React would preserve
    // its instance and `useState(props.initialNotes)` would keep showing the
    // PREVIOUS chapter's notes. Keying on the chapter forces a fresh instance.
    <ChapterCompletionClient
      key={`${book.id}:${chapterNumber}`}
      bookId={book.id}
      bookTitle={book.title}
      bookAuthor={book.author}
      coverImageUrl={book.cover_image_url}
      chapterNumber={chapterNumber}
      totalChapters={totalChapters}
      progressId={progress.id}
      groupId={groupId}
      groupColor={groupColor}
      completedChapterNumbers={completedChapterNumbers}
      completionDates={completionDates}
      completionTargetDate={progress.completion_target_date}
      startedAt={progress.started_at}
      initialNotes={initialNotes}
    />
  )
}
