import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, getProfile } from '@/lib/queries'
import { isUuid } from '@/lib/route-params'
import { GroupPreviewClient } from './preview-client'
import type { PreviewBook, PreviewChannel, PreviewMember } from './preview-client'

export const dynamic = 'force-dynamic'

/**
 * Group preview — the single landing spot before joining, reached from a
 * Discover card, an invite code/link, or a non-member hitting the group page
 * directly. This route used to auto-join on GET; the write now lives in
 * `joinGroupAction` and only fires from the Join button.
 */
/**
 * The unfurl is the first impression when a creator pastes this link into a bio,
 * so it carries the group's identity. Uses the session client deliberately: RLS
 * then gives an anonymous crawler exactly what an anonymous visitor may see, and
 * a private or missing group falls back to generic copy rather than leaking a name.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ groupId: string }>
}): Promise<Metadata> {
  const fallback: Metadata = { title: 'Join a reading group · Chaptr' }
  const { groupId } = await params
  if (!isUuid(groupId)) return fallback

  const supabase = await createClient()
  const { data: group } = await supabase
    .from('reading_groups')
    .select('name, description, banner_image_url')
    .eq('id', groupId)
    .maybeSingle()

  if (!group) return fallback

  const title = `Join ${group.name} · Chaptr`
  const description =
    group.description ?? `Read ${group.name} together on Chaptr.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: group.banner_image_url ? [group.banner_image_url] : undefined,
    },
    twitter: {
      card: group.banner_image_url ? 'summary_large_image' : 'summary',
      title,
      description,
      images: group.banner_image_url ? [group.banner_image_url] : undefined,
    },
  }
}

export default async function GroupPreviewPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params

  // A mistyped or stale invite link lands on the group list like any other
  // missing group, rather than failing the query outright. See isUuid.
  if (!isUuid(groupId)) redirect('/groups')

  const supabase = await createClient()
  const profile = await getProfile()
  const authUser = await getAuthUser()

  const { data: group } = await supabase
    .from('reading_groups')
    .select(
      'id, name, description, banner_image_url, is_public, is_paid, price, reading_pace, member_limit, current_book_target_end_date, created_by, current_book:books(title, author, cover_image_url, total_chapters, total_pages, description, genres, average_rating, total_ratings)',
    )
    .eq('id', groupId)
    .maybeSingle()

  if (!group) {
    // For an anonymous visitor a private group and a missing one are
    // indistinguishable — RLS returns nothing either way. Sign-in resolves it:
    // a member of a private group lands where they meant to, and a dead link
    // costs one redirect.
    if (!profile) redirect(`/signin?redirect=/join/${groupId}`)
    redirect('/groups')
  }

  // Members skip the preview entirely — invite links they already accepted
  // should drop them straight into the group.
  if (profile) {
    const { data: existing } = await supabase
      .from('group_memberships')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', profile.id)
      .eq('is_active', true)
      .maybeSingle()

    if (existing) redirect(`/groups/${groupId}`)
  }

  // Members joined a reading group; they did not agree to appear on a public
  // page a search engine can index. Anonymous visitors get the count plus the
  // host — the host is the group's creator promoting this link, so their name
  // is the pitch rather than a leak, and "Hosted by X" is much of why the page
  // is trusted. Ordinary members (and any non-creator admin) stay anonymous.
  // `created_by` is nullable, so a group with no recorded creator shows no
  // host rather than degrading to "any admin".
  const memberQuery = supabase
    .from('group_memberships')
    .select('role, user:users(id, username, display_name, avatar_url, profile_image_url)')
    .eq('group_id', groupId)
    .eq('is_active', true)

  let memberRows: Array<{ role: string; user: unknown }> | null = null
  if (profile) {
    ;({ data: memberRows } = await memberQuery.limit(8))
  } else if (group.created_by) {
    ;({ data: memberRows } = await memberQuery.eq('user_id', group.created_by).limit(1))
  }

  const { count: memberCount } = await supabase
    .from('group_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('is_active', true)

  const members: PreviewMember[] = (memberRows ?? [])
    .map((row) => {
      const u = row.user as any
      if (!u) return null
      return {
        id: u.id,
        name: u.display_name ?? u.username ?? 'Reader',
        avatarUrl: u.avatar_url ?? u.profile_image_url ?? null,
        // The anonymous branch fetched exactly one row and keyed it on
        // `created_by`, so that row IS the host by construction — reading the
        // role there would drop "Hosted by" for a creator who never got the
        // admin role. Signed-in visitors get every member, so the role is the
        // only thing that distinguishes the host among them.
        isHost: profile ? row.role === 'admin' : true,
      }
    })
    .filter(Boolean) as PreviewMember[]

  const { channels, weeklyMessages } = await getGroupActivity(groupId)

  const book = (group.current_book as any) ?? null

  return (
    <GroupPreviewClient
      group={{
        id: group.id,
        name: group.name,
        description: group.description,
        banner_image_url: group.banner_image_url,
        is_public: group.is_public ?? true,
        is_paid: group.is_paid ?? false,
        price: group.price,
        reading_pace: group.reading_pace,
        member_limit: group.member_limit,
        target_end_date: group.current_book_target_end_date,
      }}
      book={
        book
          ? ({
              ...book,
              genres: normaliseGenres(book.genres),
            } as PreviewBook)
          : null
      }
      channels={channels}
      members={members}
      memberCount={memberCount ?? 0}
      weeklyMessages={weeklyMessages}
      isSignedIn={Boolean(authUser)}
    />
  )
}

/** `books.genres` is jsonb — usually a string array, but don't trust it. */
function normaliseGenres(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((g): g is string => typeof g === 'string').slice(0, 4)
}

/**
 * The group's channels plus how many messages landed in them over the last 7
 * days — the "what's inside" list and the activity stat.
 *
 * Both `group_channels` and `channel_messages` are members-only under RLS, so
 * the session client sees nothing here: the whole point is showing a group to
 * someone who has *not* joined. The service-role client is used deliberately
 * and narrowly — channel names and a `head: true` count. No message content
 * crosses the boundary. Degrades to an empty list / null count if the group
 * has no channels or the service key isn't configured.
 */
async function getGroupActivity(
  groupId: string,
): Promise<{ channels: PreviewChannel[]; weeklyMessages: number | null }> {
  try {
    const admin = createAdminClient()

    const { data: channelRows } = await admin
      .from('group_channels')
      .select('id, name, description, is_premium, is_chapter_gated')
      .eq('group_id', groupId)
      .order('position', { ascending: true })

    const channels: PreviewChannel[] = (channelRows ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      isPremium: Boolean(c.is_premium),
      isChapterGated: Boolean(c.is_chapter_gated),
    }))

    if (!channels.length) return { channels: [], weeklyMessages: null }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { count } = await admin
      .from('channel_messages')
      .select('id', { count: 'exact', head: true })
      .in(
        'channel_id',
        channels.map((c) => c.id),
      )
      .gte('created_at', since)

    return { channels, weeklyMessages: count ?? 0 }
  } catch {
    return { channels: [], weeklyMessages: null }
  }
}
