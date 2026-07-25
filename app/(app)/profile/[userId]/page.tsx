import { notFound } from 'next/navigation'
import { getProfile } from '@/lib/queries'
import { getPublicProfile } from '../actions'
import { ProfileClient } from '../profile-client'

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const [stats, me] = await Promise.all([getPublicProfile(userId), getProfile()])
  if (!stats) notFound()

  const isOwn = me?.id === userId

  return <ProfileClient stats={stats} isOwn={isOwn} />
}
