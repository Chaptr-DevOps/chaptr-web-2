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
    .select('id, current_chapter, completed_chapters, total_chapters')
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

  const { data: noteRows } = await supabase
    .from('personal_notes')
    .select('id, note_content')
    .eq('user_id', user.id)
    .eq('book_id', bookId)
    .eq('chapter_number', chapterNumber)
    .order('created_at', { ascending: true })

  const initialNotes: ChapterNote[] = (noteRows ?? [])
    .filter((n) => n.note_content)
    .map((n) => ({ id: n.id, content: n.note_content as string }))

  const { data: completions } = await supabase
    .from('chapter_completions')
    .select('chapter_number')
    .eq('user_id', user.id)
    .eq('book_id', bookId)

  const completedChapterNumbers = [
    ...new Set((completions ?? []).map((c) => c.chapter_number)),
  ]

  let groupName: string | null = null
  let groupColor: string | null = null
  if (groupId) {
    const { data: groupRow } = await supabase
      .from('reading_groups')
      .select('name, primary_color')
      .eq('id', groupId)
      .maybeSingle()
    groupName = groupRow?.name ?? null
    groupColor = groupRow?.primary_color ?? null
  }

  return (
    <ChapterCompletionClient
      bookId={book.id}
      bookTitle={book.title}
      chapterNumber={chapterNumber}
      totalChapters={totalChapters}
      progressId={progress.id}
      groupId={groupId}
      groupColor={groupColor}
      groupName={groupName}
      completedChapterNumbers={completedChapterNumbers}
      initialNotes={initialNotes}
    />
  )
}
