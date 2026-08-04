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
  MoreHorizontal,
  PlusCircle,
  MessageSquare,
  X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sendMessage } from '../../../actions'
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
  reply_to_message_id?: string | null
  author?: {
    username: string | null
    display_name: string | null
    avatar_url?: string | null
    role?: string
    is_creator?: boolean
  }
  reactions?: Array<{ id?: string; reaction_type: string; user_id: string }>
  // Client-only: set on the optimistic placeholder shown before the insert
  // round-trips. Cleared when the real row replaces it.
  pending?: boolean
  failed?: boolean
}

const tempId = () =>
  `temp-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`

// Remove the optimistic placeholder that corresponds to `real`. Matched by
// temp id when we know it (the send path), otherwise by author + content (a
// Realtime INSERT echoing back our own message).
function dropPendingTwin(prev: Message[], real: Message, temp?: string | null): Message[] {
  const idx = prev.findIndex((m) =>
    !m.pending
      ? false
      : temp
        ? m.id === temp
        : m.user_id === real.user_id &&
          m.content === real.content &&
          (m.reply_to_message_id ?? null) === (real.reply_to_message_id ?? null),
  )
  return idx === -1 ? prev : [...prev.slice(0, idx), ...prev.slice(idx + 1)]
}

// Fold an authoritative server row into a list. Safe to call from both the
// server-action response and the Realtime INSERT — whichever lands first wins
// and the other becomes a no-op, so a message never shows up twice.
const mergeServerMessage =
  (real: Message, temp?: string | null) =>
  (prev: Message[]): Message[] => {
    const next = dropPendingTwin(prev, real, temp)
    if (next.some((m) => m.id === real.id)) return next
    return [...next, real]
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
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  // Popovers and active items
  const [activePickerMessageId, setActivePickerMessageId] = useState<string | null>(null)
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null)
  // Set when deleting a message that would take replies down with it
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; replyCount: number } | null>(null)

  // Thread support. Only the open thread's *id* is state — the parent message
  // and its replies are derived from `messages`, so there is exactly one source
  // of truth (this mirrors the mobile app's `selectedMessageReplies`).
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [threadText, setThreadText] = useState('')
  const [threadIsSpoiler, setThreadIsSpoiler] = useState(false)
  const [, startThreadTransition] = useTransition()

  const bottomRef = useRef<HTMLDivElement>(null)
  const threadBottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // My profile details for optimistic updates
  const [myProfile, setMyProfile] = useState<{ display_name: string | null; username: string | null; avatar_url: string | null } | null>(null)

  const activeThreadMessage = activeThreadId
    ? messages.find((m) => m.id === activeThreadId) ?? null
    : null
  const threadReplies = activeThreadId
    ? messages
        .filter((m) => m.reply_to_message_id === activeThreadId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    : []

  // Auto-scroll main feed
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-scroll thread. Keyed on the count, not the array — the array is derived
  // and gets a new identity every render.
  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadReplies.length])

  // Fetch current user details
  useEffect(() => {
    const fetchMyProfile = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('users').select('display_name, username, avatar_url').eq('id', myUserId).maybeSingle()
      if (data) {
        setMyProfile(data)
      }
    }
    fetchMyProfile()
  }, [myUserId])

  // Close active menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => {
      setActivePickerMessageId(null)
      setActiveMenuMessageId(null)
    }
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  // Supabase Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const sub = supabase
      .channel(`chat:${channel.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT or DELETE
          schema: 'public',
          table: 'channel_messages',
          filter: `channel_id=eq.${channel.id}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as any

            // Apply the same chapter gate the initial fetch does — Realtime
            // delivers every insert on the channel, so without this a message
            // from a reader ahead of us would stream straight past the gate.
            if (
              channel.is_chapter_gated &&
              !(typeof newMsg.chapter_number === 'number' && newMsg.chapter_number <= myCurrentChapter)
            ) {
              return
            }

            // Fetch author profile
            const { data: author } = await supabase
              .from('users')
              .select('username, display_name, avatar_url')
              .eq('id', newMsg.user_id)
              .maybeSingle()
            
            // Fetch roles
            const { data: membership } = await supabase
              .from('group_memberships')
              .select('role')
              .eq('group_id', groupId)
              .eq('user_id', newMsg.user_id)
              .maybeSingle()

            const formattedMsg: Message = {
              ...newMsg,
              author: author
                ? {
                    ...author,
                    role: membership?.role || 'member',
                  }
                : undefined,
              reactions: [],
            }

            // One array feeds both the channel and any open thread.
            // mergeServerMessage also clears our own optimistic placeholder if
            // it is still on screen.
            setMessages(mergeServerMessage(formattedMsg))
          } else if (payload.eventType === 'DELETE') {
            const oldMsg = payload.old as any
            setMessages((prev) => prev.filter((m) => m.id !== oldMsg.id))
          }
        },
      )
      .subscribe()

    // Realtime subscription for reactions
    const subReactions = supabase
      .channel(`reactions:${channel.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channel_message_reactions',
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newReaction = payload.new as any
            const updateReactions = (prev: Message[]) =>
              prev.map((msg) => {
                if (msg.id !== newReaction.message_id) return msg
                const reactions = msg.reactions || []
                if (reactions.some((r) => r.user_id === newReaction.user_id && r.reaction_type === newReaction.reaction_type)) return msg
                return { ...msg, reactions: [...reactions, newReaction] }
              })
            setMessages(updateReactions)
          } else if (payload.eventType === 'DELETE') {
            const oldReaction = payload.old as any
            const filterReactions = (prev: Message[]) =>
              prev.map((msg) => {
                const reactions = msg.reactions || []
                return { ...msg, reactions: reactions.filter((r) => r.id !== oldReaction.id) }
              })
            setMessages(filterReactions)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(sub)
      supabase.removeChannel(subReactions)
    }
  }, [channel.id, groupId])

  // Replies already live in `messages` (the page fetches them alongside their
  // parents), so opening a thread is pure state — no fetch, and an optimistic
  // reply shows up in the panel for free.
  const handleOpenThread = (msg: Message) => setActiveThreadId(msg.id)

  // Which chapter a message is stamped with. Ungated channels stamp nothing;
  // in a gated channel a reply inherits its parent's chapter so it reaches
  // exactly the audience that could see the parent, never the replier's own
  // (further-along) position. Mirrors mobile's GroupChatScreen.
  const chapterStampFor = (parent: Message | null): number | null => {
    if (!channel.is_chapter_gated) return null
    return parent?.chapter_number ?? myCurrentChapter
  }

  // Build the placeholder we render immediately, before the server confirms.
  const buildOptimistic = (
    id: string,
    content: string,
    spoiler: boolean,
    replyTo: string | null,
    chapterNumber: number | null,
  ): Message => ({
    id,
    content,
    is_spoiler_gated: spoiler,
    chapter_number: chapterNumber,
    created_at: new Date().toISOString(),
    user_id: myUserId,
    reply_to_message_id: replyTo,
    author: {
      username: myProfile?.username ?? null,
      display_name: myProfile?.display_name ?? myProfile?.username ?? 'You',
      avatar_url: myProfile?.avatar_url ?? null,
      role: 'member',
    },
    reactions: [],
    pending: true,
  })

  // Fire the insert and swap the placeholder for the real row (or flag it as
  // failed so the user can retry — never silently drop the message).
  const deliverMessage = async (
    id: string,
    content: string,
    spoiler: boolean,
    replyTo: string | null,
    chapterNumber: number | null,
  ) => {
    const res = await sendMessage(channel.id, content, spoiler, chapterNumber, replyTo)

    if (!res || 'error' in res || !res.message) {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, pending: false, failed: true } : m)),
      )
      return
    }

    const real: Message = {
      ...(res.message as Message),
      author: {
        username: myProfile?.username ?? null,
        display_name: myProfile?.display_name ?? myProfile?.username ?? 'You',
        avatar_url: myProfile?.avatar_url ?? null,
        role: 'member',
      },
      reactions: [],
    }
    setMessages(mergeServerMessage(real, id))
  }

  // Send a new top-level message
  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    const content = text.trim()
    const id = tempId()
    const chapterNumber = chapterStampFor(null)
    setText('')
    setMessages((prev) => [...prev, buildOptimistic(id, content, false, null, chapterNumber)])
    startTransition(async () => {
      await deliverMessage(id, content, false, null, chapterNumber)
    })
  }

  // Retry a message whose insert failed
  const handleRetryMessage = (msg: Message) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, pending: true, failed: false } : m)),
    )
    startTransition(async () => {
      await deliverMessage(
        msg.id,
        msg.content ?? '',
        msg.is_spoiler_gated,
        msg.reply_to_message_id ?? null,
        msg.chapter_number,
      )
    })
  }

  // Send a reply in the current thread
  const handleSendThreadReply = (e: React.FormEvent) => {
    e.preventDefault()
    if (!threadText.trim() || !activeThreadMessage) return
    const content = threadText.trim()
    const parentId = activeThreadMessage.id
    const spoiler = threadIsSpoiler
    const id = tempId()
    const chapterNumber = chapterStampFor(activeThreadMessage)
    setThreadText('')
    setThreadIsSpoiler(false)

    setMessages((prev) => [...prev, buildOptimistic(id, content, spoiler, parentId, chapterNumber)])

    startThreadTransition(async () => {
      await deliverMessage(id, content, spoiler, parentId, chapterNumber)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e as any)
    }
  }

  function handleThreadKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendThreadReply(e as any)
    }
  }

  // Handle emoji reaction clicks (toggle)
  //
  // channel_message_reactions is unique on (message_id, user_id) — a user holds
  // at most one reaction per message. There is no UPDATE policy on the table, so
  // switching emoji is delete-then-insert, not an update.
  const handleReactionPress = async (messageId: string, emoji: string) => {
    // Optimistic toggle: drop my existing reaction, then re-add unless I was
    // clicking the same emoji off again.
    const applyToggle = (prev: Message[]) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg
        const existingReactions = msg.reactions || []
        const mine = existingReactions.find((r) => r.user_id === myUserId)
        const withoutMine = existingReactions.filter((r) => r.user_id !== myUserId)
        const newReactions =
          mine?.reaction_type === emoji
            ? withoutMine
            : [...withoutMine, { reaction_type: emoji, user_id: myUserId }]
        return { ...msg, reactions: newReactions }
      })

    setMessages(applyToggle)

    const supabase = createClient()
    try {
      const { data: existing } = await supabase
        .from('channel_message_reactions')
        .select('id, reaction_type')
        .eq('message_id', messageId)
        .eq('user_id', myUserId)
        .maybeSingle()

      if (existing) {
        await supabase.from('channel_message_reactions').delete().eq('id', existing.id)
      }

      if (existing?.reaction_type !== emoji) {
        await supabase.from('channel_message_reactions').insert({
          message_id: messageId,
          user_id: myUserId,
          reaction_type: emoji,
        })
      }
    } catch (err) {
      // Handled optimistically
    }
  }

  // Handle message deletion. The reply_to_message_id FK is ON DELETE CASCADE, so
  // deleting a thread parent deletes its replies server-side — mirror that here
  // instead of waiting for the per-row Realtime DELETE events.
  const handleDeleteMessage = async (messageId: string) => {
    const supabase = createClient()
    try {
      const { error } = await supabase.from('channel_messages').delete().eq('id', messageId)
      if (!error) {
        setMessages((prev) =>
          prev.filter((m) => m.id !== messageId && m.reply_to_message_id !== messageId),
        )
        if (activeThreadId === messageId) {
          setActiveThreadId(null)
        }
      }
    } catch (err) {
      // Handled silently
    }
  }

  // Route a delete through a confirmation when replies would be destroyed too
  const requestDeleteMessage = (messageId: string) => {
    const replyCount = messages.filter((m) => m.reply_to_message_id === messageId).length
    if (replyCount === 0) {
      handleDeleteMessage(messageId)
      return
    }
    setConfirmDelete({ id: messageId, replyCount })
  }

  // Handle message reporting
  const handleReportMessage = async (messageId: string) => {
    const supabase = createClient()
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: myUserId,
        target_type: 'message',
        target_id: messageId,
        reason: 'Reported by user in chat client',
        status: 'open',
      })
      if (!error) {
        alert('Message reported successfully.')
      }
    } catch (err) {
      // Handled silently
    }
  }

  // Helper relative colors based on author id
  const getUsernameColor = (userId: string) => {
    const colors = [
      'text-amber-600 dark:text-amber-400',
      'text-emerald-600 dark:text-emerald-400',
      'text-rose-600 dark:text-rose-400',
      'text-teal-600 dark:text-teal-400',
      'text-sky-600 dark:text-sky-400',
      'text-indigo-600 dark:text-indigo-400',
    ]
    const index = userId.charCodeAt(0) % colors.length
    return colors[index]
  }

  const getAvatarBg = (userId: string) => {
    const bgs = [
      'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900',
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900',
      'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900',
      'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900',
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900',
      'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-900',
    ]
    const index = userId.charCodeAt(0) % bgs.length
    return bgs[index]
  }

  // Format short relative timestamps
  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  // Filter out replies to show top-level channel feed only
  const mainFeedMessages = messages.filter((m) => !m.reply_to_message_id)

  // Inner renderer for a message row (shared by feed and thread detail)
  const renderMessageRow = (msg: Message, isThreadParent = false) => {
    const isOwn = msg.user_id === myUserId
    // Not yet a real row: reactions/threads/deletes have nothing to point at.
    const isUnsent = msg.pending || msg.failed
    const showSpoiler = msg.is_spoiler_gated && !revealedSpoilers.has(msg.id)
    const authorName = msg.author?.display_name ?? msg.author?.username ?? 'Unknown'
    const initial = authorName[0]?.toUpperCase() ?? '?'
    const isHost = msg.author?.role === 'admin' || msg.author?.is_creator

    // Group reactions
    const groupedReactions = (msg.reactions || []).reduce((acc, reaction) => {
      const emoji = reaction.reaction_type
      if (!acc[emoji]) {
        acc[emoji] = { count: 0, userIds: [] }
      }
      acc[emoji].count++
      acc[emoji].userIds.push(reaction.user_id)
      return acc
    }, {} as Record<string, { count: number; userIds: string[] }>)

    // replies meta computed on messages list
    const replies = messages.filter((r) => r.reply_to_message_id === msg.id)
    const replyCount = replies.length
    const replyUsersMap = new Map<string, any>()
    replies.forEach((r) => {
      if (r.author && r.user_id !== myUserId) {
        replyUsersMap.set(r.user_id, {
          id: r.user_id,
          username: r.author.username,
          avatar_url: r.author.avatar_url,
        })
      }
    })
    const replyUsers = Array.from(replyUsersMap.values())

    return (
      <div
        key={msg.id}
        className={cn(
          "flex gap-3 px-4 py-2 hover:bg-[var(--surface-elevated)]/40 transition-colors rounded-lg relative group",
          isThreadParent && "bg-[var(--surface-elevated)]/30 border border-[var(--border-main)] rounded-xl",
          msg.pending && "opacity-60"
        )}
      >
        {/* Avatar */}
        <Link href={msg.user_id === myUserId ? '/profile' : `/profile/${msg.user_id}`} className="shrink-0">
          {msg.author?.avatar_url ? (
            <img src={msg.author.avatar_url} className="h-9 w-9 rounded-full object-cover" alt={authorName} />
          ) : (
            <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm ${getAvatarBg(msg.user_id)}`}>
              {initial}
            </div>
          )}
        </Link>

        {/* Message body */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-0.5">
            <Link
              href={msg.user_id === myUserId ? '/profile' : `/profile/${msg.user_id}`}
              className={cn("font-semibold text-sm hover:underline", getUsernameColor(msg.user_id))}
            >
              {authorName}
            </Link>
            {isHost && (
              <Badge variant="neutral" className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-none text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase">
                Host
              </Badge>
            )}
            {msg.pending ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
                <Loader2 className="h-2.5 w-2.5 animate-spin" /> Sending…
              </span>
            ) : msg.failed ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400 font-semibold">
                Not sent
                <button
                  type="button"
                  onClick={() => handleRetryMessage(msg)}
                  className="underline hover:no-underline"
                >
                  Retry
                </button>
              </span>
            ) : (
              <span className="text-[11px] text-[var(--text-tertiary)]">{formatTime(msg.created_at)}</span>
            )}
          </div>

          {/* Text content */}
          {showSpoiler ? (
            <button
              type="button"
              onClick={() => setRevealedSpoilers((s) => new Set([...s, msg.id]))}
              className="flex items-center gap-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-main)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--border-main)] transition-colors mt-1"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span>Spoiler — click to reveal</span>
              <Eye className="h-3.5 w-3.5" />
            </button>
          ) : (
            <div className="text-[15px] text-[var(--text-primary)] leading-relaxed break-words whitespace-pre-wrap">
              {msg.is_spoiler_gated && (
                <div className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-1.5 py-0.5 mr-2">
                  <AlertTriangle className="h-2.5 w-2.5" /> Spoiler
                </div>
              )}
              {msg.content}
            </div>
          )}

          {/* Footer actions: reactions & thread counts */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {Object.entries(groupedReactions).map(([emoji, data]) => {
              const userReacted = data.userIds.includes(myUserId)
              return (
                <button
                  key={emoji}
                  onClick={() => handleReactionPress(msg.id, emoji)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs border transition-all duration-150",
                    userReacted
                      ? "bg-primary/10 border-primary text-primary font-semibold"
                      : "bg-[var(--surface-elevated)] border-[var(--border-main)] text-[var(--text-secondary)] hover:bg-[var(--border-main)]",
                  )}
                >
                  <span>{emoji}</span>
                  <span className="text-[10px] opacity-75">{data.count}</span>
                </button>
              )
            })}

            {/* Replies inline preview */}
            {!isThreadParent && !msg.reply_to_message_id && replyCount > 0 && (
              <button
                onClick={() => handleOpenThread(msg)}
                className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline ml-2 transition-all"
              >
                <div className="flex items-center -space-x-1.5">
                  {replyUsers.slice(0, 3).map((u, idx) => (
                    u.avatar_url ? (
                      <img
                        key={u.id}
                        src={u.avatar_url}
                        className="h-4.5 w-4.5 rounded-full border border-[var(--surface)] object-cover shadow-sm"
                        alt=""
                        style={{ zIndex: 3 - idx }}
                      />
                    ) : (
                      <div
                        key={u.id}
                        className={cn(
                          "h-4.5 w-4.5 rounded-full border border-[var(--surface)] flex items-center justify-center text-[7px] font-bold shadow-sm",
                          getAvatarBg(u.id),
                        )}
                        style={{ zIndex: 3 - idx }}
                      >
                        {u.username?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )
                  ))}
                </div>
                <span>
                  {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Hover action bar (Slack style) — hidden until the row is a real message */}
        <div className={cn(
          "absolute right-4 top-2 hidden items-center gap-1 bg-[var(--surface)] border border-[var(--border-main)] rounded-lg shadow-sm px-1.5 py-1 z-10",
          !isUnsent && "group-hover:flex"
        )}>
          {['❤️', '🔥', '😂'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReactionPress(msg.id, emoji)}
              className="hover:bg-[var(--surface-elevated)] p-1 rounded text-sm transition-transform active:scale-120"
            >
              {emoji}
            </button>
          ))}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setActivePickerMessageId(activePickerMessageId === msg.id ? null : msg.id)
              setActiveMenuMessageId(null)
            }}
            className="hover:bg-[var(--surface-elevated)] p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            title="React"
          >
            <PlusCircle className="h-4 w-4" />
          </button>
          {!isThreadParent && !msg.reply_to_message_id && (
            <button
              onClick={() => handleOpenThread(msg)}
              className="hover:bg-[var(--surface-elevated)] p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              title="Reply in thread"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setActiveMenuMessageId(activeMenuMessageId === msg.id ? null : msg.id)
              setActivePickerMessageId(null)
            }}
            className="hover:bg-[var(--surface-elevated)] p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            title="More"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Floating emoji picker */}
        {activePickerMessageId === msg.id && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-12 top-10 bg-[var(--surface)] border border-[var(--border-main)] rounded-xl shadow-lg p-1.5 flex gap-1 z-25 animate-in fade-in slide-in-from-top-2 duration-150"
          >
            {['❤️', '🔥', '😂', '💯', '👀'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  handleReactionPress(msg.id, emoji)
                  setActivePickerMessageId(null)
                }}
                className="hover:bg-[var(--surface-elevated)] p-1.5 rounded-lg text-lg transition-transform hover:scale-115"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Floating actions menu */}
        {activeMenuMessageId === msg.id && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-4 top-10 bg-[var(--surface)] border border-[var(--border-main)] rounded-xl shadow-lg py-1.5 w-36 z-25 text-sm text-[var(--text-secondary)] animate-in fade-in slide-in-from-top-2 duration-150"
          >
            <button
              onClick={() => {
                navigator.clipboard.writeText(msg.content || '')
                setActiveMenuMessageId(null)
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)] transition-colors"
            >
              Copy Text
            </button>
            <button
              onClick={() => {
                handleReportMessage(msg.id)
                setActiveMenuMessageId(null)
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)] transition-colors"
            >
              Report
            </button>
            {msg.user_id === myUserId && (
              <button
                onClick={() => {
                  requestDeleteMessage(msg.id)
                  setActiveMenuMessageId(null)
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-elevated)] text-red-600 hover:text-red-500 font-semibold border-t border-[var(--border-main)] mt-1.5 pt-1.5"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    )
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
              Read through Ch. {myCurrentChapter}
            </span>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-1.5 p-4 bg-[var(--background)]">
          {mainFeedMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-[var(--text-tertiary)]">
              <Hash className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-semibold">No messages yet</p>
              <p className="text-sm">Be the first to send a message in #{channel.name}</p>
            </div>
          )}
          {mainFeedMessages.map((msg) => renderMessageRow(msg))}
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
            {/* No spoiler toggle here — a top-level message is stamped with your
                own chapter, so the gate already covers it. Replies inherit the
                parent's chapter and are the one place that isn't true; the
                toggle lives in the thread composer instead. */}
          </div>
          {/* Not disabled while in flight — the message is already on screen as
              a pending row, so the composer stays free for the next one. */}
          <Button type="submit" size="icon" disabled={!text.trim()} className="h-10 w-10 shrink-0 rounded-xl">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Thread Sidebar Panel */}
      {activeThreadMessage && (
        <aside className="w-80 md:w-96 border-l border-[var(--border-main)] bg-[var(--surface)] flex flex-col shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border-main)] px-4 py-3 shrink-0">
            <div>
              <h2 className="font-bold text-sm text-[var(--text-primary)]">Thread</h2>
              <p className="text-[10px] text-[var(--text-tertiary)]">#{channel.name}</p>
            </div>
            <button
              onClick={() => setActiveThreadId(null)}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-[var(--surface-elevated)] transition-colors"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Thread messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--background)]">
            {/* Parent message */}
            {renderMessageRow(activeThreadMessage, true)}

            {/* Replies section header */}
            <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] font-bold uppercase tracking-wider my-2">
              <span className="h-px bg-[var(--border-main)] flex-1" />
              <span>Replies</span>
              <span className="h-px bg-[var(--border-main)] flex-1" />
            </div>

            {/* Replies list — derived from `messages`, so there is nothing to load */}
            {threadReplies.length === 0 ? (
              <div className="text-center text-xs text-[var(--text-tertiary)] py-8 font-medium">
                No replies yet. Start the conversation!
              </div>
            ) : (
              <div className="space-y-1.5">
                {threadReplies.map((reply) => renderMessageRow(reply))}
              </div>
            )}
            <div ref={threadBottomRef} />
          </div>

          {/* Thread input box */}
          <form
            onSubmit={handleSendThreadReply}
            className="border-t border-[var(--border-main)] bg-[var(--surface)] p-3 flex items-end gap-2 shrink-0"
          >
            <div className="flex-1 rounded-xl border border-[var(--border-main)] bg-[var(--surface-elevated)] px-3 py-2 focus-within:border-primary/50 transition-colors">
              <textarea
                rows={1}
                value={threadText}
                onChange={(e) => setThreadText(e.target.value)}
                onKeyDown={handleThreadKeyDown}
                placeholder="Reply..."
                className="w-full resize-none bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
                style={{ maxHeight: '90px' }}
              />
              {/* A reply inherits the parent's chapter, so it can reach readers
                  who are behind you. This is the one composer where marking a
                  spoiler earns its keep. */}
              <div className="flex items-center gap-2 pt-1.5 border-t border-[var(--border-main)] mt-1.5">
                <button
                  type="button"
                  onClick={() => setThreadIsSpoiler((v) => !v)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors',
                    threadIsSpoiler
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {threadIsSpoiler ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {threadIsSpoiler ? 'Spoiler ON' : 'Mark as spoiler'}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              size="icon"
              disabled={!threadText.trim()}
              className="h-9 w-9 shrink-0 rounded-xl"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </aside>
      )}

      {/* Destructive-delete confirmation — only shown when replies are at stake */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-5 shadow-xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--error-bg)] border border-[var(--error-border)]">
                <AlertTriangle className="h-4.5 w-4.5 text-[var(--error)]" />
              </div>
              <div className="min-w-0">
                <h2 className="font-serif text-lg font-bold text-[var(--text-primary)]">
                  Delete this message?
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                  This message has{' '}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {confirmDelete.replyCount}{' '}
                    {confirmDelete.replyCount === 1 ? 'reply' : 'replies'}
                  </span>
                  . Deleting it will permanently delete{' '}
                  {confirmDelete.replyCount === 1 ? 'that reply' : 'all of them'} from the thread.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  handleDeleteMessage(confirmDelete.id)
                  setConfirmDelete(null)
                }}
              >
                Delete {confirmDelete.replyCount === 1 ? 'both' : 'all'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
