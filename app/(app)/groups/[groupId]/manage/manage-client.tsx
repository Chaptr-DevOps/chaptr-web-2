'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Users,
  Crown,
  Loader2,
  BookOpen,
  Settings2,
  Hash,
  Globe,
  Lock,
  Save,
  DollarSign,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { BookCover } from '@/components/book-cover'
import {
  updateGroup,
  createChannel,
  deleteChannel,
  kickMember,
  setChannelPremium,
} from '../../actions'
import { SetGroupBookModal } from '@/components/set-group-book-modal'
import {
  getOnboardingStatus,
  startCreatorOnboarding,
  setGroupPaid,
  getPayoutSummary,
} from './monetization-actions'
import { BannerCard } from './banner-card'
import { formatPrice } from '@/lib/stripe'
import { cn } from '@/lib/utils'

const PACES = ['relaxed', 'moderate', 'fast'] as const

interface ManageClientProps {
  groupId: string
  group: {
    name: string
    reading_pace: string | null
    is_public: boolean
    invite_code: string | null
    current_book_id: string | null
    is_paid: boolean
    price: number | null
    banner_image_url: string | null
  }
  /** Banner editing is creator-only, so admins-by-role see it read-only. */
  isCreator: boolean
  channels: Array<{
    id: string
    name: string
    channel_type: string
    is_chapter_gated: boolean
    is_premium: boolean
  }>
  members: Array<{
    role: string
    user: { id: string; username: string | null; display_name: string | null }
  }>
  currentBook: { id: string; title: string; author: string | null; cover_image_url: string | null } | null
  /** Tab to open on load — set from the `?tab=` param so deep links land right. */
  initialTab?: 'general' | 'channels' | 'members' | 'monetization'
}

export function ManageClient({
  groupId,
  group,
  channels,
  members,
  currentBook,
  isCreator,
  initialTab = 'general',
}: ManageClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'general' | 'channels' | 'members' | 'monetization'>(initialTab)

  // Monetization state
  const [onboarding, setOnboarding] = useState<{
    connected?: boolean
    chargesEnabled?: boolean
    payoutsEnabled?: boolean
    error?: string
  } | null>(null)
  const [payoutSummary, setPayoutSummary] = useState<{
    availableBalance: number
    pendingBalance: number
    recentPayouts: Array<{ id: string; amount: number; status: string; date: string }>
  } | null>(null)
  const [monetizationLoading, setMonetizationLoading] = useState(false)
  const [isPaid, setIsPaid] = useState(group.is_paid)
  const [priceInput, setPriceInput] = useState(group.price != null ? String(group.price) : '')
  const [monetizationError, setMonetizationError] = useState('')
  const [monetizationSaved, setMonetizationSaved] = useState(false)

  useEffect(() => {
    if (activeTab !== 'monetization') return
    let cancelled = false
    setMonetizationLoading(true)
    Promise.all([getOnboardingStatus(groupId), getPayoutSummary(groupId)]).then(
      ([status, summary]) => {
        if (cancelled) return
        setOnboarding(status)
        if (!('error' in summary)) setPayoutSummary(summary)
        setMonetizationLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [activeTab, groupId])

  function handleConnectStripe() {
    startTransition(async () => {
      const res = await startCreatorOnboarding(groupId)
      if (res.error) setMonetizationError(res.error)
      else if (res.url) window.location.href = res.url
    })
  }

  function handleSaveMonetization(e: React.FormEvent) {
    e.preventDefault()
    setMonetizationError('')
    const priceAmount = isPaid ? parseFloat(priceInput) : null
    startTransition(async () => {
      const res = await setGroupPaid(groupId, isPaid, priceAmount)
      if (res.error) {
        setMonetizationError(res.error)
      } else {
        setMonetizationSaved(true)
        setTimeout(() => setMonetizationSaved(false), 2000)
        router.refresh()
      }
    })
  }

  // General settings state
  const [gName, setGName] = useState(group.name)
  const [gPace, setGPace] = useState(group.reading_pace ?? 'moderate')
  const [gPublic, setGPublic] = useState(group.is_public)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // Channel creation state
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelGated, setNewChannelGated] = useState(false)
  const [newChannelPremium, setNewChannelPremium] = useState(false)
  const [channelError, setChannelError] = useState('')

  // Member kick state
  const [kickingId, setKickingId] = useState<string | null>(null)

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await updateGroup(groupId, {
        name: gName,
        readingPace: gPace,
        isPublic: gPublic,
      })
      if (res.error) alert(res.error)
      else {
        setSettingsSaved(true)
        setTimeout(() => setSettingsSaved(false), 2000)
        router.refresh()
      }
    })
  }

  function handleAddChannel(e: React.FormEvent) {
    e.preventDefault()
    setChannelError('')
    if (!newChannelName.trim()) return
    startTransition(async () => {
      const res = await createChannel(
        groupId,
        newChannelName,
        newChannelGated,
        newChannelPremium,
      )
      if (res.error) {
        setChannelError(res.error)
      } else {
        setNewChannelName('')
        setNewChannelGated(false)
        setNewChannelPremium(false)
        router.refresh()
      }
    })
  }

  function handleTogglePremium(channelId: string, isPremium: boolean) {
    setChannelError('')
    startTransition(async () => {
      const res = await setChannelPremium(channelId, groupId, isPremium)
      if (res.error) setChannelError(res.error)
      else router.refresh()
    })
  }

  function handleDeleteChannel(channelId: string) {
    if (!confirm('Delete this channel and all its messages?')) return
    startTransition(async () => {
      const res = await deleteChannel(channelId, groupId)
      if (res.error) alert(res.error)
      else router.refresh()
    })
  }

  function handleKick(userId: string) {
    if (!confirm('Remove this member from the group?')) return
    setKickingId(userId)
    startTransition(async () => {
      const res = await kickMember(groupId, userId)
      if (res.error) alert(res.error)
      else router.refresh()
      setKickingId(null)
    })
  }

  return (
    <div className="space-y-6 px-5 md:px-8">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link
          href={`/groups/${groupId}`}
          className={buttonVariants({ variant: 'outline', size: 'icon' })}
          aria-label="Back to group"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
          Group Settings
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border-main)] gap-4">
        {(
          [
            ['general', 'General'],
            ['channels', 'Channels'],
            ['members', 'Members'],
            ['monetization', 'Monetization'],
          ] as const
        ).map(
          ([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={cn(
                'px-3 py-2.5 text-sm font-semibold border-b-2 transition-all',
                activeTab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              )}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {/* ── TAB: GENERAL ── */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <BannerCard
            groupId={groupId}
            bannerUrl={group.banner_image_url}
            canEdit={isCreator}
          />

          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
                Group Details
              </h3>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Group Name</Label>
                <Input
                  id="name"
                  required
                  value={gName}
                  onChange={(e) => setGName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Reading Pace</Label>
                <div className="flex gap-2">
                  {PACES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setGPace(p)}
                      className={cn(
                        'flex-1 rounded-lg border py-2 text-sm font-medium capitalize transition-all',
                        gPace === p
                          ? 'border-primary bg-primary text-[var(--interactive-primary-foreground)]'
                          : 'border-[var(--border-main)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]',
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[var(--border-main)] p-3">
                <div className="flex items-center gap-2">
                  {gPublic ? (
                    <Globe className="h-4 w-4 text-[var(--text-secondary)]" />
                  ) : (
                    <Lock className="h-4 w-4 text-[var(--text-secondary)]" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {gPublic ? 'Public Group' : 'Private Group'}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {gPublic ? 'Discoverable in group search' : 'Only joinable via invite code'}
                    </p>
                  </div>
                </div>
                <Switch checked={gPublic} onCheckedChange={setGPublic} />
              </div>

              {group.invite_code && (
                <div className="rounded-xl border border-[var(--border-main)] bg-[var(--surface-elevated)]/40 p-3">
                  <p className="text-xs font-semibold text-[var(--text-tertiary)] mb-1">Invite Code</p>
                  <p className="font-mono text-xl font-bold tracking-[0.2em] text-[var(--text-primary)]">
                    {group.invite_code}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Share this code for others to join privately.
                  </p>
                </div>
              )}

              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : settingsSaved ? (
                  '✓ Saved!'
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Save Settings
                  </>
                )}
              </Button>
            </form>
          </Card>

          {/* Current Book */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
                Current Book
              </h3>
            </div>

            {currentBook && (
              <div className="flex gap-4 items-center p-3 rounded-xl border border-[var(--border-main)] bg-[var(--surface-elevated)]/40">
                <div className="w-12 shrink-0">
                  <BookCover
                    title={currentBook.title}
                    author={currentBook.author}
                    src={currentBook.cover_image_url}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-serif font-semibold text-[var(--text-primary)] line-clamp-1">
                    {currentBook.title}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">{currentBook.author}</p>
                </div>
                <Badge variant="primary" className="text-[10px]">Current</Badge>
              </div>
            )}

            <SetGroupBookModal
              groupId={groupId}
              label={currentBook ? 'Change book' : 'Select a book'}
              variant={currentBook ? 'outline' : 'primary'}
            />
          </Card>
        </div>
      )}

      {/* ── TAB: CHANNELS ── */}
      {activeTab === 'channels' && (
        <div className="space-y-5">
          {/* Existing channels */}
          <div className="overflow-hidden rounded-2xl border border-[var(--border-main)] bg-[var(--surface)]">
            {channels.map((ch, i) => (
              <div key={ch.id}>
                {i > 0 && <div className="mx-4 h-px bg-[var(--border-main)]" />}
                <div className="flex items-center gap-3 px-4 py-3">
                  <Hash className="h-4 w-4 text-[var(--text-tertiary)]" />
                  <span className="flex-1 text-sm font-medium text-[var(--text-primary)]">
                    {ch.name}
                  </span>
                  {ch.is_chapter_gated && (
                    <Badge variant="neutral" className="text-[10px]">Chapter-gated</Badge>
                  )}
                  <Badge variant={ch.channel_type === 'general' ? 'free' : 'neutral'} className="text-[10px]">
                    {ch.channel_type}
                  </Badge>
                  <label
                    className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]"
                    title={
                      group.is_paid
                        ? 'Premium channels are only readable by subscribers'
                        : 'Turn on a subscription price in Monetization to use premium channels'
                    }
                  >
                    Premium
                    <Switch
                      checked={ch.is_premium}
                      disabled={isPending || !group.is_paid}
                      onCheckedChange={(v) => handleTogglePremium(ch.id, v)}
                    />
                  </label>
                  {ch.channel_type === 'custom' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-[var(--error)] hover:bg-[var(--error)]/10"
                      onClick={() => handleDeleteChannel(ch.id)}
                      disabled={isPending}
                      title="Delete channel"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add channel form */}
          <Card className="p-5 space-y-4">
            <h3 className="font-serif font-bold text-base text-[var(--text-primary)]">
              Add Channel
            </h3>
            <form onSubmit={handleAddChannel} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="chname">Channel Name</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] text-sm">#</span>
                    <Input
                      id="chname"
                      className="pl-7"
                      placeholder="book-discussion"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={isPending || !newChannelName.trim()}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[var(--border-main)] p-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Chapter-gated</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Only members at or beyond the chapter can post/view.
                  </p>
                </div>
                <Switch checked={newChannelGated} onCheckedChange={setNewChannelGated} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[var(--border-main)] p-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Premium</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {group.is_paid
                      ? `Only ${formatPrice(group.price)}/mo subscribers can open this channel.`
                      : 'Set a subscription price under Monetization to gate channels.'}
                  </p>
                </div>
                <Switch
                  checked={newChannelPremium}
                  disabled={!group.is_paid}
                  onCheckedChange={setNewChannelPremium}
                />
              </div>
              {channelError && <p className="text-sm text-[var(--error)]">{channelError}</p>}
            </form>
          </Card>
        </div>
      )}

      {/* ── TAB: MEMBERS ── */}
      {activeTab === 'members' && (
        <div className="overflow-hidden rounded-2xl border border-[var(--border-main)] bg-[var(--surface)]">
          {members.map((m, i) => {
            const u = m.user
            return (
              <div key={u.id}>
                {i > 0 && <div className="mx-4 h-px bg-[var(--border-main)]" />}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                    {(u.display_name ?? u.username ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {u.display_name ?? u.username}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">@{u.username}</p>
                  </div>
                  <Badge variant={m.role === 'admin' ? 'primary' : 'neutral'} className="text-[10px]">
                    {m.role === 'admin' ? (
                      <><Crown className="h-2.5 w-2.5" /> Admin</>
                    ) : (
                      'Member'
                    )}
                  </Badge>
                  {m.role !== 'admin' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-[var(--error)] hover:bg-[var(--error)]/10"
                      onClick={() => handleKick(u.id)}
                      disabled={isPending && kickingId === u.id}
                    >
                      {isPending && kickingId === u.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Remove'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── TAB: MONETIZATION ── */}
      {activeTab === 'monetization' && (
        <div className="space-y-6">
          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
                Stripe Payouts
              </h3>
            </div>

            {monetizationLoading && !onboarding ? (
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking Stripe status...
              </div>
            ) : onboarding?.connected && onboarding.chargesEnabled && onboarding.payoutsEnabled ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--success)]">
                <CheckCircle2 className="h-4 w-4" /> Stripe account connected
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[var(--text-secondary)]">
                  Connect a Stripe account to receive payouts from paid memberships. Chaptr keeps a{' '}
                  15% platform fee on each payment.
                </p>
                <Button onClick={handleConnectStripe} disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="mr-2 h-4 w-4" />
                  )}
                  {onboarding?.connected ? 'Finish Stripe onboarding' : 'Connect with Stripe'}
                </Button>
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
                Paid Membership
              </h3>
            </div>

            <form onSubmit={handleSaveMonetization} className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-[var(--border-main)] p-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {isPaid ? 'Paid Group' : 'Free Group'}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {isPaid
                      ? 'New members must subscribe to join.'
                      : 'Anyone can join without paying.'}
                  </p>
                </div>
                <Switch checked={isPaid} onCheckedChange={setIsPaid} />
              </div>

              {isPaid && (
                <div className="space-y-1.5">
                  <Label htmlFor="mprice">Monthly Price (USD)</Label>
                  <Input
                    id="mprice"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="9.99"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                  />
                </div>
              )}

              {group.is_paid && group.price != null && (
                <p className="text-xs text-[var(--text-tertiary)]">
                  Current price: {formatPrice(group.price)}/mo
                </p>
              )}

              {monetizationError && (
                <p className="text-sm text-[var(--error)]">{monetizationError}</p>
              )}

              <Button
                type="submit"
                disabled={isPending || (isPaid && !onboarding?.connected)}
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : monetizationSaved ? (
                  '✓ Saved!'
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Save
                  </>
                )}
              </Button>
              {isPaid && !onboarding?.connected && (
                <p className="text-xs text-[var(--text-tertiary)]">
                  Connect Stripe above before setting a price.
                </p>
              )}
            </form>
          </Card>

          {payoutSummary && onboarding?.connected && (
            <Card className="p-6 space-y-4">
              <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">Balance</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--text-tertiary)]">Available</p>
                  <p className="text-xl font-bold text-[var(--text-primary)]">
                    {formatPrice(payoutSummary.availableBalance)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-tertiary)]">Pending</p>
                  <p className="text-xl font-bold text-[var(--text-primary)]">
                    {formatPrice(payoutSummary.pendingBalance)}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
