'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface GroupAnnouncement {
  id: string
  group_id: string
  user_id: string
  title?: string
  content: string
  allow_comments: boolean
  comment_count: number
  created_at: string
  updated_at: string
  user: {
    id: string
    username: string
    display_name?: string
    avatar_url?: string
    profile_image_url?: string // for compatibility
  }
}

export interface AnnouncementComment {
  id: string
  announcement_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
  user: {
    id: string
    username: string
    display_name?: string
    avatar_url?: string
    profile_image_url?: string // for compatibility
  }
}

export interface GroupBookListItem {
  id: string
  group_id: string
  book_id: string
  status: 'reading' | 'completed' | 'upcoming'
  position: number
  note?: string
  added_at: string
  book: {
    id: string
    title: string
    author: string
    cover_image_url?: string
    total_chapters: number
    description?: string
  }
}

function mapUserAvatar<T extends { user: any }>(item: T | null): T | null {
  if (!item || !item.user) return item
  return {
    ...item,
    user: {
      ...item.user,
      profile_image_url: item.user.avatar_url ?? undefined,
    },
  }
}

function mapUserAvatars<T extends { user: any }>(items: T[] | null): T[] | null {
  if (!items) return null
  return items.map(mapUserAvatar) as T[]
}

/**
 * Get all announcements for a group
 */
export async function getGroupAnnouncements(
  groupId: string,
  limit: number = 20
): Promise<{ data: GroupAnnouncement[] | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('group_announcements')
      .select(`
        *,
        user:users!user_id(id, username, display_name, avatar_url)
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return { data: mapUserAvatars(data) as GroupAnnouncement[], error: null }
  } catch (error: any) {
    console.error('getGroupAnnouncements error:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Create a new announcement
 */
export async function createGroupAnnouncement(params: {
  groupId: string
  userId: string
  title?: string
  content: string
  allowComments: boolean
}): Promise<{ data: GroupAnnouncement | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) throw new Error('Not authenticated')

    if (params.userId !== authUser.id) {
      throw new Error('Cannot create announcement as another user')
    }

    const { data, error } = await supabase
      .from('group_announcements')
      .insert({
        group_id: params.groupId,
        user_id: params.userId,
        title: params.title || null,
        content: params.content,
        allow_comments: params.allowComments,
      })
      .select(`
        *,
        user:users!user_id(id, username, display_name, avatar_url)
      `)
      .single()

    if (error) throw error

    revalidatePath(`/groups/${params.groupId}`)
    return { data: mapUserAvatar(data) as GroupAnnouncement, error: null }
  } catch (error: any) {
    console.error('createGroupAnnouncement error:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Update an existing announcement
 */
export async function updateGroupAnnouncementContent(
  announcementId: string,
  title: string | null,
  content: string,
  allowComments: boolean,
  groupId: string
): Promise<{ data: GroupAnnouncement | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('group_announcements')
      .update({
        title,
        content,
        allow_comments: allowComments,
        updated_at: new Date().toISOString(),
      })
      .eq('id', announcementId)
      .select(`
        *,
        user:users!user_id(id, username, display_name, avatar_url)
      `)
      .single()

    if (error) throw error

    revalidatePath(`/groups/${groupId}`)
    return { data: mapUserAvatar(data) as GroupAnnouncement, error: null }
  } catch (error: any) {
    console.error('updateGroupAnnouncementContent error:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Delete an announcement
 */
export async function deleteGroupAnnouncement(
  announcementId: string,
  groupId: string
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('group_announcements')
      .delete()
      .eq('id', announcementId)

    if (error) throw error

    revalidatePath(`/groups/${groupId}`)
    return { error: null }
  } catch (error: any) {
    console.error('deleteGroupAnnouncement error:', error)
    return { error: error.message }
  }
}

/**
 * Get comments for an announcement
 */
export async function getAnnouncementComments(
  announcementId: string,
  limit: number = 50
): Promise<{ data: AnnouncementComment[] | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('announcement_comments')
      .select(`
        *,
        user:users!user_id(id, username, display_name, avatar_url)
      `)
      .eq('announcement_id', announcementId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw error

    return { data: mapUserAvatars(data) as AnnouncementComment[], error: null }
  } catch (error: any) {
    console.error('getAnnouncementComments error:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Add a comment to an announcement
 */
export async function addAnnouncementComment(params: {
  announcementId: string
  userId: string
  content: string
  groupId: string
}): Promise<{ data: AnnouncementComment | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) throw new Error('Not authenticated')

    if (params.userId !== authUser.id) {
      throw new Error('Cannot create comment as another user')
    }

    const { data, error } = await supabase
      .from('announcement_comments')
      .insert({
        announcement_id: params.announcementId,
        user_id: params.userId,
        content: params.content,
      })
      .select(`
        *,
        user:users!user_id(id, username, display_name, avatar_url)
      `)
      .single()

    if (error) throw error

    revalidatePath(`/groups/${params.groupId}`)
    return { data: mapUserAvatar(data) as AnnouncementComment, error: null }
  } catch (error: any) {
    console.error('addAnnouncementComment error:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Delete a comment
 */
export async function deleteAnnouncementComment(
  commentId: string,
  groupId: string
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('announcement_comments')
      .delete()
      .eq('id', commentId)

    if (error) throw error

    revalidatePath(`/groups/${groupId}`)
    return { error: null }
  } catch (error: any) {
    console.error('deleteAnnouncementComment error:', error)
    return { error: error.message }
  }
}

/**
 * Get group book list
 */
export async function getGroupBookList(
  groupId: string
): Promise<{ data: GroupBookListItem[] | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('group_book_list')
      .select(`
        *,
        book:books(id, title, author, cover_image_url, total_chapters, description)
      `)
      .eq('group_id', groupId)
      .order('position', { ascending: true })
      .order('added_at', { ascending: false })

    if (error) throw error

    return { data: data as GroupBookListItem[], error: null }
  } catch (error: any) {
    console.error('getGroupBookList error:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Find or insert book, then add to group book list
 */
export async function addGroupBookListItem(params: {
  group_id: string
  book: {
    title: string
    author?: string
    total_pages?: number
    total_chapters?: number
    cover_image_url?: string
    description?: string
  }
  status?: string
  note?: string
}): Promise<{ data: GroupBookListItem | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) throw new Error('Not authenticated')

    // Find or insert the book in public.books first
    let bookId: string | null = null
    const { data: existingBook } = await supabase
      .from('books')
      .select('id')
      .eq('title', params.book.title.trim())
      .eq('author', params.book.author?.trim() ?? '')
      .maybeSingle()

    if (existingBook) {
      bookId = existingBook.id
    } else {
      const { data: newBook, error: bookError } = await supabase
        .from('books')
        .insert({
          title: params.book.title.trim(),
          author: params.book.author?.trim() ?? null,
          total_pages: params.book.total_pages ?? null,
          total_chapters: params.book.total_chapters ?? null,
          cover_image_url: params.book.cover_image_url ?? null,
          description: params.book.description ?? null,
        })
        .select('id')
        .single()

      if (bookError) throw bookError
      bookId = newBook.id
    }

    // Now insert to group_book_list
    const { data, error } = await supabase
      .from('group_book_list')
      .insert({
        group_id: params.group_id,
        book_id: bookId,
        added_by: authUser.id,
        status: params.status || 'upcoming',
        note: params.note || null,
      })
      .select(`
        *,
        book:books(id, title, author, cover_image_url, total_chapters, description)
      `)
      .single()

    if (error) throw error

    revalidatePath(`/groups/${params.group_id}`)
    return { data: data as GroupBookListItem, error: null }
  } catch (error: any) {
    console.error('addGroupBookListItem error:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Remove an item from the group book list
 */
export async function removeGroupBookListItem(
  itemId: string,
  groupId: string
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('group_book_list')
      .delete()
      .eq('id', itemId)

    if (error) throw error

    revalidatePath(`/groups/${groupId}`)
    return { error: null }
  } catch (error: any) {
    console.error('removeGroupBookListItem error:', error)
    return { error: error.message }
  }
}

/**
 * Update an item on the group book list
 */
export async function updateGroupBookListItem(
  itemId: string,
  // note is nullable in group_book_list — pass null to clear it, undefined to leave it
  updates: { status?: string; note?: string | null; position?: number },
  groupId: string
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('group_book_list')
      .update(updates)
      .eq('id', itemId)

    if (error) throw error

    revalidatePath(`/groups/${groupId}`)
    return { error: null }
  } catch (error: any) {
    console.error('updateGroupBookListItem error:', error)
    return { error: error.message }
  }
}
