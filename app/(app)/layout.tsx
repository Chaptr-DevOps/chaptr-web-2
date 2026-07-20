import { redirect } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { getAuthUser, getProfile } from '@/lib/queries'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthUser()
  if (!user) redirect('/signin')

  const profile = await getProfile()

  // If they haven't finished onboarding, send them there (unless no username yet)
  if (profile && !profile.onboarding_completed_at && !profile.username) {
    redirect('/onboarding/username')
  }

  return <AppShell profile={profile}>{children}</AppShell>
}
