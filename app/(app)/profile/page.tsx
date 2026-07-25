import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/queries'
import { getProfileStats } from './actions'
import { ProfileClient } from './profile-client'

export const metadata = {
  title: 'My Profile – Chaptr',
  description: 'View your reading stats, badges, and activity log.',
}

export default async function ProfilePage() {
  const profile = await getProfile()
  if (!profile) redirect('/signin')

  const stats = await getProfileStats()
  if (!stats) redirect('/signin')

  return <ProfileClient stats={stats} isOwn={true} />
}
