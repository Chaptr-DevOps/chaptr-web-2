import { getProfile } from '@/lib/queries'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { AddBookClient } from './add-book-client'

export const dynamic = 'force-dynamic'

export default async function AddBookPage() {
  const supabase = await createClient()
  const profile = await getProfile()

  const { count: unread } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)

  return (
    <div className="pb-10">
      <PageHeader
        title="Add Book"
        subtitle="Search or specify custom books to add to your library."
        unread={unread ?? 0}
      />
      <AddBookClient />
    </div>
  )
}
