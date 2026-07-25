'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/queries'

async function assertAdmin() {
  const profile = await getProfile()
  if (!profile?.is_admin) throw new Error('Unauthorized')
  return profile
}

export async function resolveReport(reportId: string, action: 'dismiss' | 'remove') {
  await assertAdmin()
  const supabase = await createClient()
  await supabase
    .from('reports')
    .update({ status: action === 'dismiss' ? 'dismissed' : 'resolved' })
    .eq('id', reportId)
  revalidatePath('/admin')
}

export async function suspendUser(userId: string) {
  await assertAdmin()
  const supabase = await createClient()
  await supabase.from('users').update({ status: 'suspended' }).eq('id', userId)
  revalidatePath('/admin')
}

export async function reinstateUser(userId: string) {
  await assertAdmin()
  const supabase = await createClient()
  await supabase.from('users').update({ status: 'active' }).eq('id', userId)
  revalidatePath('/admin')
}

export async function getAdminStats() {
  const profile = await assertAdmin()
  const supabase = await createClient()

  const [
    { count: totalUsers },
    { count: totalBooks },
    { count: totalGroups },
    { count: totalChapters },
    { data: reports },
    { data: suspended },
  ] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('books').select('id', { count: 'exact', head: true }),
    supabase.from('reading_groups').select('id', { count: 'exact', head: true }),
    supabase.from('chapter_completions').select('id', { count: 'exact', head: true }),
    supabase
      .from('reports')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('users')
      .select('id, username, display_name, status, created_at')
      .eq('status', 'suspended')
      .limit(10),
  ])

  return {
    stats: {
      totalUsers: totalUsers ?? 0,
      totalBooks: totalBooks ?? 0,
      totalGroups: totalGroups ?? 0,
      totalChapters: totalChapters ?? 0,
    },
    reports: reports ?? [],
    suspended: suspended ?? [],
  }
}
