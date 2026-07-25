'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/queries'

export async function markAllRead() {
  const supabase = await createClient()
  const profile = await getProfile()
  if (!profile) return

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', profile.id)
    .eq('is_read', false)

  revalidatePath('/notifications')
}

export async function markOneRead(id: string) {
  const supabase = await createClient()
  await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  revalidatePath('/notifications')
}
