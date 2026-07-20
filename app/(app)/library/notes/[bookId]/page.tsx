import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/queries'
import { PageHeader } from '@/components/page-header'
import { NotesClient } from './notes-client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{
    bookId: string
  }>
}

export default async function NotesPage({ params }: PageProps) {
  const { bookId } = await params
  const supabase = await createClient()
  const profile = await getProfile()

  if (!profile) {
    redirect('/signin')
  }

  // 1. Fetch book details
  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('*')
    .eq('id', bookId)
    .maybeSingle()

  if (bookError || !book) {
    redirect('/library')
  }

  // 2. Fetch reading progress for this user + book
  const { data: progress } = await supabase
    .from('reading_progress')
    .select('id, current_chapter, progress_percentage, status')
    .eq('user_id', profile.id)
    .eq('book_id', bookId)
    .maybeSingle()

  // 3. Fetch chapter completions
  const { data: completions } = await supabase
    .from('chapter_completions')
    .select('id, chapter_number, reflection_text, completed_at')
    .eq('user_id', profile.id)
    .eq('book_id', bookId)
    .order('completed_at', { ascending: false })

  // 4. Fetch personal notes
  const { data: notes } = await supabase
    .from('personal_notes')
    .select('id, chapter_number, note_content, is_private, created_at, updated_at')
    .eq('user_id', profile.id)
    .eq('book_id', bookId)
    .order('updated_at', { ascending: false })

  // 5. Fetch notification count for header
  const { count: unread } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)

  return (
    <div className="pb-10">
      <PageHeader
        title={book.title}
        subtitle={book.author ? `by ${book.author}` : 'Personal notes and tracking'}
        unread={unread ?? 0}
      />
      <NotesClient
        book={book}
        progress={progress}
        completions={completions ?? []}
        notes={notes ?? []}
      />
    </div>
  )
}
