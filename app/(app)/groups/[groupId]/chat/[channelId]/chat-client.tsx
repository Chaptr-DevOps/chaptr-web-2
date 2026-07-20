'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Hash,
  Send,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  BookOpen,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sendMessage } from '../../actions'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  content: string | null
  is_spoiler_gated: boolean
  chapter_number: number | null
  created_at: string
  user_id: string
  author?: {
    username: string | null
    display_name: string | null
  }
}

interface ChatClientProps {
  groupId: string
  groupName: string
  channel: {
    id: string
    name: string
    channel_type: string
    is_chapter_gated: boolean
  }
  channels: Array<{ id: string; name: string; channel_type: string }>
  initialMessages: Message[]
  myUserId: string
  myCurrentChapter: number
}

export function ChatClient({
  groupId,
  groupName,
  channel,
  channels,
  initialMessages,
  myUserId,
  myCurrentChapter,
}: ChatClientProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [text, setText] = useState('')
  const [isSpoiler, setIsSpoiler] = useState(false)
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Supabase Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const sub = supabase
      .channel(`chat:${channel.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channel_messages',
          filter: `channel_id=eq.${channel.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as any
          // Fetch author profile
          const { data: author } = await supabase
            .from('users')
            .select('username, display_name')
            .eq('id', newMsg.user_id)
            .maybeSingle()
          setMessages((prev) => [
            ...prev,
            { ...newMsg, author: author ?? undefined },
          ])
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [channel.id])

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || isPending) return
    const content = text.trim()
    setText('')
    startTransition(async () => {
      await sendMessage(channel.id, content, isSpoiler, null)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e as any)
    }
  }

  function timeLabel(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    const isSameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    return isSameDay
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex h-[calc(100svh-56px)] md:h-[calc(100svh-0px)] overflow-hidden">
      {/* Sidebar: channel list */}
      <aside className="hidden md:flex w-52 shrink-0 flex-col border-r border-[var(--border-main)] bg-[var(--surface)]">
        <div className="flex items-center gap-2 border-b border-[var(--border-main)] px-4 py-3">
          <Link
            href={`/groups/${groupId}`}
            className="mr-1 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-main)] text-[var(--text-tertiary)] hover:bg-[var(--surface-elevated)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <p className="truncate text-sm font-bold text-[var(--text-primary)]">{groupName}</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {channels.map((ch) => (
            <Link
              key={ch.id}
              href={`/groups/${groupId}/chat/${ch.id}`}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                ch.id === channel.id
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]',
              )}
            >
              <Hash className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{ch.name}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Channel header */}
        <header className="flex items-center gap-3 border-b border-[var(--border-main)] bg-[var(--surface)] px-4 py-3 shrink-0">
          <Link
            href={`/groups/${groupId}`}
            className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-main)] text-[var(--text-tertiary)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Hash className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
          <h1 className="font-semibold text-[var(--text-primary)]">{channel.name}</h1>
          {channel.is_chapter_gated && (
            <Badge variant="neutral" className="text-[10px]">Chapter-gated</Badge>
          )}
          {channel.is_chapter_gated && (
            <span className="ml-auto text-xs text-[var(--text-secondary)] flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              You&apos;re on Ch. {myCurrentChapter}
            </span>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-1 p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-[var(--text-tertiary)]">
              <Hash className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-semibold">No messages yet</p>
              <p className="text-sm">Be the first to send a message in #{channel.name}</p>
            </div>
          )}
          {messages.map((msg, i) => {
            const isOwn = msg.user_id === myUserId
            const showSpoiler = msg.is_spoiler_gated && !revealedSpoilers.has(msg.id)
            const prevMsg = messages[i - 1]
            const sameAuthor = prevMsg?.user_id === msg.user_id
            const authorName = msg.author?.display_name ?? msg.author?.username ?? 'Unknown'
            const initial = authorName[0]?.toUpperCase() ?? '?'

            return (
              <div key={msg.id} className={cn('flex gap-3', isOwn && 'flex-row-reverse', sameAuthor && 'mt-0.5')}>
                {!sameAuthor && (
                  <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold mt-0.5">
                    {initial}
                  </div>
                )}
                {sameAuthor && <div className="w-8 shrink-0" />}

                <div className={cn('max-w-[72%] space-y-0.5', isOwn && 'items-end flex flex-col')}>
                  {!sameAuthor && (
                    <div className={cn('flex items-center gap-2', isOwn && 'flex-row-reverse')}>
                      <span className="text-xs font-semibold text-[var(--text-primary)]">{authorName}</span>
                      <span className="text-[10px] text-[var(--text-tertiary)]">{timeLabel(msg.created_at)}</span>
                    </div>
                  )}

                  {showSpoiler ? (
                    <button
                      type="button"
                      onClick={() => setRevealedSpoilers((s) => new Set([...s, msg.id]))}
                      className="flex items-center gap-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-main)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--border-main)] transition-colors"
                    >
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span>Spoiler — click to reveal</span>
                      <Eye className="h-4 w-4" />
                    </button>
                  ) : (
                    <div className={cn(
                      'rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                      isOwn
                        ? 'bg-primary text-[var(--interactive-primary-foreground)] rounded-tr-sm'
                        : 'bg-[var(--surface-elevated)] text-[var(--text-primary)] rounded-tl-sm',
                    )}>
                      {msg.is_spoiler_gated && (
                        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider mb-1 opacity-60">
                          <AlertTriangle className="h-3 w-3" /> Spoiler
                        </div>
                      )}
                      {msg.content}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <form
          onSubmit={handleSend}
          className="shrink-0 border-t border-[var(--border-main)] bg-[var(--surface)] p-3 flex items-end gap-2"
        >
          <div className="flex-1 rounded-xl border border-[var(--border-main)] bg-[var(--surface-elevated)] px-3 py-2 focus-within:border-primary/50 transition-colors">
            <textarea
              ref={inputRef}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message #${channel.name}`}
              className="w-full resize-none bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
              style={{ maxHeight: '120px' }}
            />
            {/* Spoiler toggle */}
            <div className="flex items-center gap-2 pt-1.5 border-t border-[var(--border-main)] mt-1.5">
              <button
                type="button"
                onClick={() => setIsSpoiler((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors',
                  isSpoiler
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
                )}
              >
                {isSpoiler ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {isSpoiler ? 'Spoiler ON' : 'Mark as spoiler'}
              </button>
            </div>
          </div>
          <Button type="submit" size="icon" disabled={isPending || !text.trim()} className="h-10 w-10 shrink-0 rounded-xl">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  )
}
