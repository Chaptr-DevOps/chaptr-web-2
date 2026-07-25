import { redirect, notFound } from 'next/navigation'
import { getProfile } from '@/lib/queries'
import { getAdminStats } from './actions'
import { AdminClient } from './admin-client'

export const metadata = {
  title: 'Admin Dashboard – Chaptr',
  description: 'Platform management and moderation tools.',
}

export default async function AdminPage() {
  const profile = await getProfile()
  if (!profile) redirect('/signin')
  if (!profile.is_admin) notFound()

  const { stats, reports, suspended } = await getAdminStats()

  return <AdminClient stats={stats} reports={reports} suspended={suspended} />
}
