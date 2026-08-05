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

  // Onboarding is gated on state, not on which door someone came through.
  //
  // The `!profile.username` half of this check used to be here too, and it made
  // the whole condition dead: `handle_new_user` inserts the profile row with
  // `username` already filled in (from user metadata, falling back to the email
  // local-part), so it is never null for anyone. /signup only reached onboarding
  // because it pushes there itself — anyone arriving any other way, notably an
  // OAuth user returning through /auth/callback, walked straight into the app
  // with an auto-generated username they never chose.
  if (profile && !profile.onboarding_completed_at) {
    redirect('/onboarding/username')
  }

  return <AppShell profile={profile}>{children}</AppShell>
}
