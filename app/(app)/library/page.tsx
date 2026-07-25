import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/queries'
import { PageHeader } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
import { LibraryClient } from './library-client'
import type { CustomShelf, ShelfBookWithBook } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function LibraryPage() {
  const supabase = await createClient()
  const profile = await getProfile()

  // Fetch unread notification counts
  const { count: unread } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)

  // Fetch reading progress records joined with books
  const { data: progressItems } = await supabase
    .from('reading_progress')
    .select(`
      id,
      user_id,
      book_id,
      group_id,
      current_chapter,
      progress_percentage,
      status,
      created_at,
      book:books(
        id,
        title,
        author,
        total_pages,
        total_chapters,
        cover_image_url
      )
    `)
    .eq('user_id', profile?.id ?? '')
    .order('created_at', { ascending: false })

  const items = (progressItems ?? []) as any[]

  // Fetch the user's custom shelves (collections) with a book count each
  const { data: shelvesData } = await supabase
    .from('custom_shelves')
    .select(`*, book_count:shelf_books(count)`)
    .eq('user_id', profile?.id ?? '')
    .order('created_at', { ascending: false })

  const shelves: CustomShelf[] = (shelvesData ?? []).map((s: any) => ({
    ...s,
    book_count: s.book_count?.[0]?.count ?? 0,
  }))

  // Fetch every book on any of those shelves in one go, then group by shelf
  const shelfIds = shelves.map((s) => s.id)
  const { data: shelfBooksData } = shelfIds.length
    ? await supabase
        .from('shelf_books')
        .select(`
          id,
          shelf_id,
          book_id,
          added_at,
          book:books(id, title, author, cover_image_url)
        `)
        .in('shelf_id', shelfIds)
        .order('added_at', { ascending: false })
    : { data: [] as ShelfBookWithBook[] }

  const shelfBooksByShelf: Record<string, ShelfBookWithBook[]> = {}
  for (const sb of (shelfBooksData ?? []) as unknown as ShelfBookWithBook[]) {
    if (!shelfBooksByShelf[sb.shelf_id]) shelfBooksByShelf[sb.shelf_id] = []
    shelfBooksByShelf[sb.shelf_id].push(sb)
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="Library"
        subtitle="Manage your book shelves, tracking progress, and logs."
        unread={unread ?? 0}
        action={
          <Link href="/library/add" className={buttonVariants({ size: 'sm' })}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Book
          </Link>
        }
      />
      <LibraryClient
        initialItems={items}
        initialShelves={shelves}
        initialShelfBooksByShelf={shelfBooksByShelf}
      />
    </div>
  )
}