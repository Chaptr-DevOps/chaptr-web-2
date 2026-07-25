import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/queries'
import { NotificationsClient } from './notifications-client'
import type { AppNotification } from '@/lib/types'

export const metadata = {
  title: 'Notifications – Chaptr',
  description: 'Your reading alerts, streaks, and group updates.',
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const profile = await getProfile()
  if (!profile) redirect('/signin')

  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const notifications = (data ?? []) as AppNotification[]
  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <NotificationsClient notifications={notifications} unreadCount={unreadCount} />
  )
}
