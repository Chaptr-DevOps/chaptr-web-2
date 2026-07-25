import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/queries'
import { SettingsClient } from './settings-client'

export const metadata = {
  title: 'Settings – Chaptr',
  description: 'Manage your Chaptr profile and reading preferences.',
}

export default async function SettingsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/signin')

  return <SettingsClient profile={profile} />
}
