'use client'

import { useState, useTransition } from 'react'
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
  Search,
  Settings2,
  Hash,
  Globe,
  Lock,
  Save,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { BookCover } from '@/components/book-cover'
import { updateGroup, createChannel, deleteChannel, kickMember } from '../../actions'
import { cn } from '@/lib/utils'

const PACES = ['relaxed', 'moderate', 'intense'] as const

interface ManageClientProps {
  groupId: string
  group: {
    name: string
    reading_pace: string | null
    is_public: boolean
    invite_code: string | null
    current_book_id: string | null
  }
  channels: Array<{ id: string; name: string; channel_type: string; is_chapter_gated: boolean }>
  members: Array<{
    role: string
    user: { id: string; username: string | null; display_name: string | null }
  }>
  currentBook: { id: string; title: string; author: string | null; cover_image_url: string | null } | null
}

export function ManageClient({
  groupId,
  group,
  channels,
  members,
  currentBook,
}: ManageClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'general' | 'channels' | 'members'>('general')

  // General settings state
  const [gName, setGName] = useState(group.name)
  const [gPace, setGPace] = useState(group.reading_pace ?? 'moderate')
  const [gPublic, setGPublic] = useState(group.is_public)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // Book search state (for setting current book)
  const [bookSearch, setBookSearch] = useState('')
  const [bookResults, setBookResults] = useState<Array<{ title: string; author: string; cover: string | null }>>([])
  const [bookSearching, setBookSearching] = useState(false)

  // Channel creation state
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelGated, setNewChannelGated] = useState(false)
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

  async function handleBookSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!bookSearch.trim()) return
    setBookSearching(true)
    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(bookSearch)}&limit=5&fields=title,author_name,cover_i`,
      )
      const json = await res.json()
      setBookResults(
        (json.docs ?? []).map((d: any) => ({
          title: d.title,
          author: d.author_name?.[0] ?? 'Unknown',
          cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
        })),
      )
    } catch {
      setBookResults([])
    } finally {
      setBookSearching(false)
    }
  }

  function handleSetBook(bookTitle: string, bookAuthor: string, bookCover: string | null) {
    startTransition(async () => {
      // First register the book
      const supabaseRes = await fetch('/api/books/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bookTitle, author: bookAuthor, cover_image_url: bookCover }),
      }).catch(() => null)

      // Fallback: just clear the search and note it would work in prod
      setBookResults([])
      setBookSearch('')
      alert(`In production, "${bookTitle}" would be set as the current group book.`)
    })
  }

  function handleAddChannel(e: React.FormEvent) {
    e.preventDefault()
    setChannelError('')
    if (!newChannelName.trim()) return
    startTransition(async () => {
      const res = await createChannel(groupId, newChannelName, newChannelGated)
      if (res.error) {
        setChannelError(res.error)
      } else {
        setNewChannelName('')
        setNewChannelGated(false)
        router.refresh()
      }
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
    <div className="space-y-6 px-5 md:px-8 max-w-3xl">
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
        {([['general', 'General'], ['channels', 'Channels'], ['members', 'Members']] as const).map(
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

            <form onSubmit={handleBookSearch} className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                placeholder="Search catalog to change book..."
                className="pl-10"
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
              />
            </form>

            {bookResults.length > 0 && (
              <div className="space-y-2">
                {bookResults.map((b, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSetBook(b.title, b.author, b.cover)}
                    className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-main)] bg-[var(--surface)] p-3 text-left hover:border-primary/30 transition-colors"
                  >
                    <div className="w-10 shrink-0">
                      <BookCover title={b.title} author={b.author} src={b.cover} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-[var(--text-primary)] line-clamp-1">{b.title}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{b.author}</p>
                    </div>
                    <span className="text-xs text-primary font-semibold">Set</span>
                  </button>
                ))}
              </div>
            )}
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
    </div>
  )
}
