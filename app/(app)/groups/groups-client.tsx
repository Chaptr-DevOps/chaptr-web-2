'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Plus,
  Hash,
  Users,
  Sparkles,
  Globe,
  Lock,
  Loader2,
  BookOpen,
  LogIn,
} from 'lucide-react'
import { GroupCard } from '@/components/group-card'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { createGroup, resolveInviteCode } from './actions'
import type { ReadingGroup } from '@/lib/types'
import { cn } from '@/lib/utils'

type EnrichedGroup = ReadingGroup & {
  memberCount: number
  bookTitle: string | null
  isOwner: boolean
}

interface GroupsClientProps {
  myGroups: EnrichedGroup[]
  publicGroups: Array<ReadingGroup & { memberCount: number; bookTitle: string | null }>
}

type Modal = 'none' | 'join' | 'create'

const PACES = ['relaxed', 'moderate', 'fast'] as const

const PACE_DESCRIPTIONS = {
  relaxed: '<1 book/month',
  moderate: '1–2 books/month',
  fast: '3+ books/month',
}

function GroupSection({
  title,
  groups,
  showHeader,
}: {
  title: string
  groups: EnrichedGroup[]
  showHeader: boolean
}) {
  return (
    <div>
      {showHeader && (
        <div className="mb-3 flex items-center">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
          <span className="ml-2 rounded-full bg-[var(--surface-elevated)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
            {groups.length}
          </span>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <GroupCard
            key={g.id}
            group={g}
            memberCount={g.memberCount}
            bookTitle={g.bookTitle}
          />
        ))}
      </div>
    </div>
  )
}

export function GroupsClient({ myGroups, publicGroups }: GroupsClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [modal, setModal] = useState<Modal>('none')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'my-groups' | 'discover'>('my-groups')

  // Join via code
  const [code, setCode] = useState('')
  const [joinError, setJoinError] = useState('')

  // Create group
  const [cName, setCName] = useState('')
  const [cPace, setCPace] = useState<string>('moderate')
  const [cPublic, setCPublic] = useState(true)
  const [cPaid, setCPaid] = useState(false)
  const [createError, setCreateError] = useState('')

  const filteredMyGroups = myGroups.filter(
    (g) =>
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      (g.bookTitle ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  const ownedGroups = filteredMyGroups.filter((g) => g.isOwner)
  const joinedGroups = filteredMyGroups.filter((g) => !g.isOwner)

  const filteredPublic = publicGroups.filter(
    (g) =>
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      (g.bookTitle ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  function closeModal() {
    setModal('none')
    setCode('')
    setJoinError('')
    setCName('')
    setCPace('moderate')
    setCPublic(true)
    setCPaid(false)
    setCreateError('')
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setJoinError('')
    startTransition(async () => {
      const res = await resolveInviteCode(code)
      if (res.error) {
        setJoinError(res.error)
      } else {
        // The code only identifies the group — joining happens on the preview
        // page, so every route into a group goes through the same screen.
        closeModal()
        // No router.refresh(): resolveInviteCode only reads, so there is
        // nothing to invalidate, and refresh() can race the push away.
        router.push(res.alreadyMember ? `/groups/${res.groupId}` : `/join/${res.groupId}`)
      }
    })
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!cName.trim()) return
    setCreateError('')
    startTransition(async () => {
      const res = await createGroup({
        name: cName,
        readingPace: cPace,
        isPublic: cPublic,
        isPaid: cPaid,
      })
      if (res.error) {
        setCreateError(res.error)
      } else {
        closeModal()
        // A creator who asked for a premium tier lands on Manage, where Connect
        // onboarding and setGroupPaid actually enable it. Sending them to the
        // group instead would strand the intent with no path to finish it.
        router.push(
          res.wantsPremium
            ? `/groups/${res.groupId}/manage`
            : `/groups/${res.groupId}`,
        )
        router.refresh()
      }
    })
  }

  return (
    <>
      <div className="space-y-6 px-5 md:px-8">
        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--border-main)] gap-6">
          <button
            onClick={() => {
              setActiveTab('my-groups')
              setSearch('')
            }}
            className={cn(
              "pb-3 text-sm font-semibold transition-all relative flex items-center border-b-2 cursor-pointer",
              activeTab === 'my-groups'
                ? "text-primary border-primary"
                : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]"
            )}
          >
            My Groups
            <span className={cn(
              "ml-2 rounded-full px-2 py-0.5 text-xs font-medium",
              activeTab === 'my-groups'
                ? "bg-primary/10 text-primary"
                : "bg-[var(--surface-elevated)] text-[var(--text-secondary)]"
            )}>
              {myGroups.length}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab('discover')
              setSearch('')
            }}
            className={cn(
              "pb-3 text-sm font-semibold transition-all relative flex items-center border-b-2 cursor-pointer",
              activeTab === 'discover'
                ? "text-primary border-primary"
                : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]"
            )}
          >
            Discover
            <span className={cn(
              "ml-2 rounded-full px-2 py-0.5 text-xs font-medium",
              activeTab === 'discover'
                ? "bg-primary/10 text-primary"
                : "bg-[var(--surface-elevated)] text-[var(--text-secondary)]"
            )}>
              {publicGroups.length}
            </span>
          </button>
        </div>

        {/* Action bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="text"
              placeholder={activeTab === 'my-groups' ? "Search my groups..." : "Search public groups..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-main)] bg-[var(--surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--text-primary)] focus:border-primary/50 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setModal('join')}>
              <LogIn className="mr-1.5 h-4 w-4" /> Join with Code
            </Button>
            <Button size="sm" onClick={() => setModal('create')}>
              <Plus className="mr-1.5 h-4 w-4" /> Create Group
            </Button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'my-groups' ? (
          <section className="pb-6">
            {filteredMyGroups.length === 0 ? (
              <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
                <Users className="h-8 w-8 text-[var(--text-tertiary)] mb-3" />
                <h3 className="font-serif text-lg font-medium text-[var(--text-primary)] mb-1">
                  {search ? 'No groups found' : "You haven't joined any groups"}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-5 max-w-xl">
                  {search
                    ? 'Try a different search term.'
                    : 'Join a reading club to discuss books, track your reading progress, and more.'}
                </p>
                <div className="flex gap-3">
                  {!search && (
                    <Button size="sm" onClick={() => setActiveTab('discover')}>
                      <Sparkles className="mr-1.5 h-4 w-4" /> Discover Groups
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setModal('create')}>
                    <Plus className="mr-1.5 h-4 w-4" /> Create Group
                  </Button>
                </div>
              </Card>
            ) : (
              // Only label the sections when there is something to tell apart —
              // with just one bucket the heading is noise.
              <div className="space-y-8">
                {ownedGroups.length > 0 && (
                  <GroupSection
                    title="Groups You Own"
                    groups={ownedGroups}
                    showHeader={joinedGroups.length > 0}
                  />
                )}
                {joinedGroups.length > 0 && (
                  <GroupSection
                    title="Groups You've Joined"
                    groups={joinedGroups}
                    showHeader={ownedGroups.length > 0}
                  />
                )}
              </div>
            )}
          </section>
        ) : (
          <section className="pb-6">
            {filteredPublic.length === 0 ? (
              <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
                <Users className="h-8 w-8 text-[var(--text-tertiary)] mb-3" />
                <h3 className="font-serif text-lg font-medium text-[var(--text-primary)] mb-1">
                  {search ? 'No groups found' : 'No public groups yet'}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-5 max-w-xl">
                  {search
                    ? 'Try a different search term.'
                    : 'Be the first to create a public reading group.'}
                </p>
                <Button size="sm" onClick={() => setModal('create')}>
                  <Plus className="mr-1.5 h-4 w-4" /> Create Group
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPublic.map((g) => (
                  <GroupCard
                    key={g.id}
                    group={g}
                    memberCount={g.memberCount}
                    bookTitle={g.bookTitle}
                    // Discover only ever lists groups you're not in (the page
                    // query excludes your own), so every card previews first.
                    href={`/join/${g.id}`}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── Modals ── */}
      {modal !== 'none' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-6 shadow-2xl">
            {modal === 'join' && (
              <>
                <div className="mb-5 flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Hash className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-serif text-xl font-bold text-[var(--text-primary)]">
                      Join with Code
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Enter the invite code from your club host.
                    </p>
                  </div>
                </div>
                <form onSubmit={handleJoin} className="space-y-4">
                  <Input
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ABC123"
                    className="text-center text-xl font-mono tracking-[0.3em] uppercase"
                    maxLength={8}
                  />
                  {joinError && (
                    <p className="text-sm text-[var(--error)]">{joinError}</p>
                  )}
                  <div className="flex gap-3">
                    <Button type="submit" className="flex-1" disabled={isPending || !code.trim()}>
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
                    </Button>
                    <Button type="button" variant="outline" onClick={closeModal}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </>
            )}

            {modal === 'create' && (
              <>
                <div className="mb-5 flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BookOpen className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-serif text-xl font-bold text-[var(--text-primary)]">
                      Create Reading Group
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Your group is created with 2 default channels.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="gname">Group Name *</Label>
                    <Input
                      id="gname"
                      required
                      autoFocus
                      placeholder="The Classics Club"
                      value={cName}
                      onChange={(e) => setCName(e.target.value)}
                    />
                  </div>

                  {/* Pace selector */}
                  <div className="space-y-1.5">
                    <Label>Reading Pace</Label>
                    <div className="flex gap-2">
                      {PACES.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setCPace(p)}
                          className={cn(
                            'flex-1 rounded-lg border py-2 px-3 transition-all',
                            cPace === p
                              ? 'border-primary bg-primary text-[var(--interactive-primary-foreground)]'
                              : 'border-[var(--border-main)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]',
                          )}
                        >
                          <div className="text-sm font-medium capitalize">
                            {p}
                          </div>
                          <div
                            className={cn(
                              'mt-0.5 text-xs',
                              cPace === p
                                ? 'text-[var(--interactive-primary-foreground)]/80'
                                : 'text-[var(--text-tertiary)]'
                            )}
                          >
                            {PACE_DESCRIPTIONS[p]}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Visibility */}
                  <div className="flex items-center justify-between rounded-xl border border-[var(--border-main)] p-3">
                    <div className="flex items-center gap-2">
                      {cPublic ? (
                        <Globe className="h-4 w-4 text-[var(--text-secondary)]" />
                      ) : (
                        <Lock className="h-4 w-4 text-[var(--text-secondary)]" />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {cPublic ? 'Public Group' : 'Private Group'}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {cPublic ? 'Discoverable by everyone' : 'Invite-only via code'}
                        </p>
                      </div>
                    </div>
                    <Switch checked={cPublic} onCheckedChange={setCPublic} />
                  </div>

                  {/* Paid toggle */}
                  <div className="flex items-center justify-between rounded-xl border border-[var(--border-main)] p-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[var(--text-secondary)]" />
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          Paid Subscription
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          Charge members a monthly fee
                        </p>
                      </div>
                    </div>
                    <Switch checked={cPaid} onCheckedChange={setCPaid} />
                  </div>

                  {cPaid && (
                    <p className="text-sm text-[var(--text-secondary)]">
                      You&apos;ll set the price and connect payouts in the next
                      step — premium channels stay locked until then.
                    </p>
                  )}

                  {createError && (
                    <p className="text-sm text-[var(--error)]">{createError}</p>
                  )}

                  <div className="flex gap-3 pt-1">
                    <Button type="submit" className="flex-1" disabled={isPending || !cName.trim()}>
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Create Group'
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={closeModal}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
