'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/queries'
import { GENRES } from '@/lib/types'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }

  const display_name = formData.get('display_name') as string
  const bio = formData.get('bio') as string
  const username = formData.get('username') as string
  const yearly_reading_goal = parseInt(formData.get('yearly_reading_goal') as string) || null
  const average_reading_speed = parseInt(formData.get('average_reading_speed') as string) || null
  const preferred_genres = formData.getAll('preferred_genres') as string[]
  const favorite_genre = formData.get('favorite_genre') as string

  // Check username uniqueness if changed
  if (username && username !== profile.username) {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .neq('id', profile.id)
      .maybeSingle()

    if (existing) return { error: 'Username is already taken.' }
  }

  const { error } = await supabase
    .from('users')
    .update({
      display_name: display_name || null,
      bio: bio || null,
      username: username || profile.username,
      yearly_reading_goal,
      average_reading_speed,
      preferred_genres: preferred_genres.length ? preferred_genres : null,
      favorite_genre: favorite_genre || null,
    })
    .eq('id', profile.id)

  if (error) return { error: error.message }

  revalidatePath('/profile')
  revalidatePath('/settings')
  return { success: true }
}

export async function updateAvatar(url: string) {
  const supabase = await createClient()
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('users')
    .update({ avatar_url: url })
    .eq('id', profile.id)

  if (error) return { error: error.message }
  revalidatePath('/profile')
  revalidatePath('/settings')
  return { success: true }
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient()
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }

  const file = formData.get('avatar') as File
  if (!file || file.size === 0) return { error: 'No file selected' }
  if (file.size > 5 * 1024 * 1024) return { error: 'File must be under 5MB' }

  const ext = file.name.split('.').pop()
  const path = `${profile.id}/profile-${Date.now()}.${ext}`   // 👈 folder = user id, matches RLS + mobile

  const { error: uploadError } = await supabase.storage
    .from('profile-images')
    .upload(path, file, { upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { data: urlData } = supabase.storage.from('profile-images').getPublicUrl(path)
  return updateAvatar(urlData.publicUrl)
}