import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/queries'
import { PageHeader } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
import { LibraryClient } from './library-client'

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
      <LibraryClient initialItems={items} />
    </div>
  )
}
