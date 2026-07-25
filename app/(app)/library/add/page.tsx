import { getProfile } from '@/lib/queries'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { AddBookClient } from './add-book-client'
import type { CustomShelf } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function AddBookPage() {
  const supabase = await createClient()
  const profile = await getProfile()

  const { count: unread } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)

  const { data: shelvesData } = await supabase
    .from('custom_shelves')
    .select(`*, book_count:shelf_books(count)`)
    .eq('user_id', profile?.id ?? '')
    .order('created_at', { ascending: false })

  const shelves: CustomShelf[] = (shelvesData ?? []).map((s: any) => ({
    ...s,
    book_count: s.book_count?.[0]?.count ?? 0,
  }))

  return (
    <div className="pb-10">
      <PageHeader
        title="Add Book"
        subtitle="Search or specify custom books to add to your library."
        unread={unread ?? 0}
      />
      <AddBookClient initialShelves={shelves} />
    </div>
  )
}