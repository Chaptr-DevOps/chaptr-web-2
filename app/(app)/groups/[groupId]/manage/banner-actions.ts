'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'group-banners'

type ActionResult = { error: string; success?: undefined } | { success: true; error?: undefined }

/**
 * The file itself is uploaded from the browser (see banner-card.tsx) so we never
 * push a 5 MB body through a Server Action. These actions own the parts that must
 * be trusted: the creator check, the row update, and cleaning up the old object.
 */
async function requireGroupCreator(groupId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: group } = await supabase
    .from('reading_groups')
    .select('id, created_by, banner_image_url')
    .eq('id', groupId)
    .maybeSingle()

  if (!group || group.created_by !== user.id) {
    throw new Error('Only the group creator can change the banner image')
  }

  return { supabase, group }
}

/**
 * Storage path behind a public banner URL, or null if the URL isn't an object in
 * this group's own folder — keeps the column from being pointed at anything else.
 */
function bannerPath(url: string, groupId: string): string | null {
  const parts = url.split(`/${BUCKET}/`)
  if (parts.length !== 2) return null
  const path = decodeURIComponent(parts[1])
  return path.startsWith(`${groupId}/`) ? path : null
}

function revalidateGroup(groupId: string) {
  revalidatePath(`/groups/${groupId}/manage`)
  revalidatePath(`/groups/${groupId}`)
  revalidatePath(`/groups/${groupId}/subscribe`)
  revalidatePath('/groups')
}

/** Point the group at an already-uploaded banner and drop the previous file. */
export async function setGroupBanner(
  groupId: string,
  publicUrl: string,
): Promise<ActionResult> {
  try {
    const { supabase, group } = await requireGroupCreator(groupId)

    const newPath = bannerPath(publicUrl, groupId)
    if (!newPath) return { error: 'That image does not belong to this group' }

    const { error } = await supabase
      .from('reading_groups')
      .update({ banner_image_url: publicUrl })
      .eq('id', groupId)

    if (error) return { error: error.message }

    const oldPath = group.banner_image_url ? bannerPath(group.banner_image_url, groupId) : null
    if (oldPath && oldPath !== newPath) {
      await supabase.storage.from(BUCKET).remove([oldPath])
    }

    revalidateGroup(groupId)
    return { success: true }
  } catch (err: any) {
    return { error: err?.message || 'Failed to update banner image' }
  }
}

export async function removeGroupBanner(groupId: string): Promise<ActionResult> {
  try {
    const { supabase, group } = await requireGroupCreator(groupId)

    if (!group.banner_image_url) return { success: true }

    const { error } = await supabase
      .from('reading_groups')
      .update({ banner_image_url: null })
      .eq('id', groupId)

    if (error) return { error: error.message }

    const path = bannerPath(group.banner_image_url, groupId)
    if (path) await supabase.storage.from(BUCKET).remove([path])

    revalidateGroup(groupId)
    return { success: true }
  } catch (err: any) {
    return { error: err?.message || 'Failed to remove banner image' }
  }
}
