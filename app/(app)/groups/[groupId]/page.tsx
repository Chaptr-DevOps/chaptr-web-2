import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  BookOpen,
  Settings,
  Users,
  Hash,
  Sparkles,
  Globe,
  Lock,
  ChevronRight,
  Flame,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getProfile, isSubscribedToGroup } from '@/lib/queries'
import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookCover } from '@/components/book-cover'
import { Progress } from '@/components/ui/progress'
import { PaywallGate } from '@/components/paywall-gate'
import { formatPrice } from '@/lib/stripe'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GroupTabs } from './group-tabs'
import { getGroupAnnouncements, getGroupBookList } from './group-actions'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ groupId: string }>
}

export default async function GroupDetailPage({ params }: PageProps) {
  const { groupId } = await params
  const supabase = await createClient()
  const profile = await getProfile()

  if (!profile) redirect('/signin')

  // Fetch group
  const { data: group } = await supabase
    .from('reading_groups')
    .select('*, current_book:books(*)')
    .eq('id', groupId)
    .maybeSingle()

  if (!group) redirect('/groups')

  // Is user a member?
  const { data: membership } = await supabase
    .from('group_memberships')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', profile.id)
    .eq('is_active', true)
    .maybeSingle()

  const isMember = Boolean(membership)
  const isAdmin = membership?.role === 'admin'
  const isOwner = group.created_by === profile.id

  // Is subscribed (for paid groups)?
  const subscribed = group.is_paid ? await isSubscribedToGroup(groupId) : true
  const locked = group.is_paid && !subscribed

  // Fetch channels
  const { data: channels } = await supabase
    .from('group_channels')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })

  // Fetch members with profiles
  const { data: members } = await supabase
    .from('group_memberships')
    .select('role, user:users(id, username, display_name, avatar_url, reading_streak)')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .limit(12)

  // Fetch member count
  const { count: memberCount } = await supabase
    .from('group_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('is_active', true)

  // Fetch user's reading progress for current book
  const { data: myProgress } = group.current_book_id
    ? await supabase
        .from('reading_progress')
        .select('current_chapter, progress_percentage')
        .eq('user_id', profile.id)
        .eq('book_id', group.current_book_id)
        .maybeSingle()
    : { data: null }

  const { count: unread } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)

  const currentBook = group.current_book as any

  // Fetch announcements & booklist items
  const { data: initialAnnouncements } = await getGroupAnnouncements(groupId)
  const { data: initialBookList } = await getGroupBookList(groupId)

  return (
    <div className="pb-10">
      <PageHeader
        title={group.name}
        subtitle={`${memberCount ?? 0} members · ${group.reading_pace ?? 'no pace set'}`}
        unread={unread ?? 0}
        action={
          (isOwner || isAdmin) ? (
            <Link
              href={`/groups/${groupId}/manage`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Settings className="mr-1.5 h-4 w-4" /> Manage
            </Link>
          ) : undefined
        }
      />

      <div className="space-y-6 px-5 md:px-8">
        {/* Join / Subscribe prompt for non-members */}
        {!isMember && (
          <Card className="flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
            <div className="flex-1">
              <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">
                {group.is_paid ? 'Subscribe to join' : 'Join this group'}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {group.is_paid
                  ? `${formatPrice(group.price)}/month to access all channels and books.`
                  : 'This is a free group — join instantly.'}
              </p>
            </div>
            <Link
              href={group.is_paid ? `/groups/${groupId}/subscribe` : `/groups/${groupId}/join`}
              className={buttonVariants({ size: 'sm' })}
            >
              {group.is_paid ? (
                <>
                  <Sparkles className="mr-1.5 h-4 w-4" /> Subscribe {formatPrice(group.price)}/mo
                </>
              ) : (
                'Join Group'
              )}
            </Link>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column: book + channels */}
          <div className="space-y-6 lg:col-span-2">
            {/* Current Book */}
            {currentBook ? (
              <PaywallGate locked={locked} groupId={groupId} label="Subscribe to see current book">
                <Card className="p-5">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    Currently Reading
                  </p>
                  <div className="flex gap-4">
                    <div className="w-20 shrink-0">
                      <BookCover
                        title={currentBook.title}
                        author={currentBook.author}
                        src={currentBook.cover_image_url}
                      />
                    </div>
                    <div className="flex flex-1 flex-col justify-between min-w-0">
                      <div>
                        <h3 className="font-serif text-xl font-bold text-[var(--text-primary)] line-clamp-2">
                          {currentBook.title}
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {currentBook.author}
                        </p>
                      </div>
                      {myProgress && (
                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between text-xs text-[var(--text-tertiary)]">
                            <span>Your progress · Ch. {myProgress.current_chapter}</span>
                            <span>{Math.round(myProgress.progress_percentage)}%</span>
                          </div>
                          <Progress value={myProgress.progress_percentage} className="h-1.5" />
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </PaywallGate>
            ) : (
              <Card className="flex items-center gap-4 p-5 border-dashed">
                <BookOpen className="h-8 w-8 text-[var(--text-tertiary)]" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">No book selected yet</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {isOwner ? 'Set a current book in group settings.' : 'Waiting for the host to pick a book.'}
                  </p>
                </div>
              </Card>
            )}

            {!locked && (
              <div className="mt-6 border-t border-[var(--border-main)] pt-6">
                <GroupTabs
                  groupId={groupId}
                  userId={profile.id}
                  isAdmin={isAdmin}
                  isOwner={isOwner}
                  isMember={isMember}
                  initialAnnouncements={initialAnnouncements ?? []}
                  initialBookList={initialBookList ?? []}
                />
              </div>
            )}
          </div>

          {/* Right column: Channels & Members */}
          <div className="space-y-6">
            {/* Channels */}
            <div>
              <h2 className="mb-3 font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
                Channels
              </h2>
              {(channels ?? []).length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No channels yet.</p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[var(--border-main)] bg-[var(--surface)]">
                  {(channels ?? []).map((ch: any, i: number) => {
                    const isPremiumChannel = ch.is_premium
                    const channelLocked = locked || (isPremiumChannel && !subscribed)
                    return (
                      <div key={ch.id}>
                        {i > 0 && <div className="mx-4 h-px bg-[var(--border-main)]" />}
                        {channelLocked ? (
                          <div className="flex items-center gap-3 px-4 py-3 text-[var(--text-tertiary)] cursor-not-allowed">
                            <Hash className="h-4 w-4 shrink-0" />
                            <span className="text-sm line-through">{ch.name}</span>
                            <Badge variant="paid" className="ml-auto text-[10px]">Premium</Badge>
                          </div>
                        ) : (
                          <Link
                            href={`/groups/${groupId}/chat/${ch.id}`}
                            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-elevated)] group"
                          >
                            <Hash className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
                            <span className="text-sm font-medium text-[var(--text-primary)]">
                              {ch.name}
                            </span>
                            {ch.is_chapter_gated && (
                              <Badge variant="neutral" className="text-[10px]">Chapter-gated</Badge>
                            )}
                            <ChevronRight className="ml-auto h-4 w-4 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Members */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
                  Members
                </h2>
                {(isOwner || isAdmin) && (
                  <Link
                    href={`/groups/${groupId}/manage`}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Manage
                  </Link>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-[var(--border-main)] bg-[var(--surface)]">
                {(members ?? []).map((m: any, i: number) => {
                  const u = m.user
                  if (!u) return null
                  return (
                    <div key={u.id}>
                      {i > 0 && <div className="mx-4 h-px bg-[var(--border-main)]" />}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                          {(u.display_name ?? u.username ?? '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                            {u.display_name ?? u.username}
                          </p>
                          <p className="text-xs text-[var(--text-tertiary)]">@{u.username}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {m.role === 'admin' && (
                            <Badge variant="primary" className="text-[10px]">Admin</Badge>
                          )}
                          {u.reading_streak > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-[var(--text-tertiary)]">
                              <Flame className="h-3 w-3 text-orange-400" />
                              {u.reading_streak}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {(memberCount ?? 0) > 12 && (
                  <div className="border-t border-[var(--border-main)] px-4 py-3 text-center text-xs text-[var(--text-tertiary)]">
                    +{(memberCount ?? 0) - 12} more members
                  </div>
                )}
              </div>
            </div>

            {/* Group meta */}
            <Card className="p-4 space-y-3 bg-[var(--surface-elevated)]/40">
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                {group.is_public ? (
                  <Globe className="h-4 w-4 shrink-0" />
                ) : (
                  <Lock className="h-4 w-4 shrink-0" />
                )}
                <span>{group.is_public ? 'Public group' : 'Private group'}</span>
              </div>
              {group.invite_code && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Hash className="h-4 w-4 shrink-0" />
                  <span>
                    Invite code:{' '}
                    <span className="font-mono font-bold text-[var(--text-primary)]">
                      {group.invite_code}
                    </span>
                  </span>
                </div>
              )}
              {group.is_paid && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>
                    {formatPrice(group.price)}/month subscription
                  </span>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
