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
import { createGroup, joinGroupWithCode } from './actions'
import type { ReadingGroup } from '@/lib/types'
import { cn } from '@/lib/utils'

interface GroupsClientProps {
  myGroups: Array<ReadingGroup & { memberCount: number; bookTitle: string | null }>
  publicGroups: Array<ReadingGroup & { memberCount: number; bookTitle: string | null }>
}

type Modal = 'none' | 'join' | 'create'

const PACES = ['relaxed', 'moderate', 'intense'] as const

export function GroupsClient({ myGroups, publicGroups }: GroupsClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [modal, setModal] = useState<Modal>('none')
  const [search, setSearch] = useState('')

  // Join via code
  const [code, setCode] = useState('')
  const [joinError, setJoinError] = useState('')

  // Create group
  const [cName, setCName] = useState('')
  const [cPace, setCPace] = useState<string>('moderate')
  const [cPublic, setCPublic] = useState(true)
  const [cPaid, setCPaid] = useState(false)
  const [cPrice, setCPrice] = useState('')
  const [createError, setCreateError] = useState('')

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
    setCPrice('')
    setCreateError('')
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setJoinError('')
    startTransition(async () => {
      const res = await joinGroupWithCode(code)
      if (res.error) {
        setJoinError(res.error)
      } else if (res.requiresSubscription) {
        closeModal()
        router.push(`/groups/${res.groupId}/subscribe`)
      } else {
        closeModal()
        router.push(`/groups/${res.groupId}`)
        router.refresh()
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
        price: cPaid && cPrice ? parseFloat(cPrice) : null,
      })
      if (res.error) {
        setCreateError(res.error)
      } else {
        closeModal()
        router.push(`/groups/${res.groupId}`)
        router.refresh()
      }
    })
  }

  return (
    <>
      <div className="space-y-8 px-5 md:px-8">
        {/* Action bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="text"
              placeholder="Search public groups..."
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

        {/* My Groups */}
        {myGroups.length > 0 && (
          <section>
            <h2 className="mb-4 font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
              My Groups
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myGroups.map((g) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  memberCount={g.memberCount}
                  bookTitle={g.bookTitle}
                />
              ))}
            </div>
          </section>
        )}

        {/* Discover */}
        <section className="pb-6">
          <h2 className="mb-4 font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
            Discover
          </h2>
          {filteredPublic.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
              <Users className="h-8 w-8 text-[var(--text-tertiary)] mb-3" />
              <h3 className="font-serif text-lg font-medium text-[var(--text-primary)] mb-1">
                {search ? 'No groups found' : 'No public groups yet'}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-5 max-w-xs">
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
                />
              ))}
            </div>
          )}
        </section>
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
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Join Group'}
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
                            'flex-1 rounded-lg border py-2 text-sm font-medium capitalize transition-all',
                            cPace === p
                              ? 'border-primary bg-primary text-[var(--interactive-primary-foreground)]'
                              : 'border-[var(--border-main)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]',
                          )}
                        >
                          {p}
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
                    <div className="space-y-1.5">
                      <Label htmlFor="gprice">Monthly Price (USD)</Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
                          $
                        </span>
                        <Input
                          id="gprice"
                          type="number"
                          min={1}
                          step={0.01}
                          placeholder="4.99"
                          className="pl-7"
                          value={cPrice}
                          onChange={(e) => setCPrice(e.target.value)}
                        />
                      </div>
                    </div>
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
