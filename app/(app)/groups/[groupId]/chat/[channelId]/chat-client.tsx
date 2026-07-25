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
  parent_message_id?: string | null
  author?: {
    username: string | null
    display_name: string | null
    avatar_url?: string | null
    role?: string
    is_creator?: boolean
  }
  reactions?: Array<{ id?: string; reaction_type: string; user_id: string }>
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
  
  // Popovers and active items
  const [activePickerMessageId, setActivePickerMessageId] = useState<string | null>(null)
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null)
  
  // Thread support
  const [activeThreadMessage, setActiveThreadMessage] = useState<Message | null>(null)
  const [threadReplies, setThreadReplies] = useState<Message[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [threadText, setThreadText] = useState('')
  const [isThreadPending, startThreadTransition] = useTransition()
  
  const bottomRef = useRef<HTMLDivElement>(null)
  const threadBottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const activeThreadMessageRef = useRef<Message | null>(null)
  
  // My profile details for optimistic updates
  const [myProfile, setMyProfile] = useState<{ display_name: string | null; username: string | null; avatar_url: string | null } | null>(null)

  // Sync ref with state to prevent stale closure in Realtime listeners
  useEffect(() => {
    activeThreadMessageRef.current = activeThreadMessage
  }, [activeThreadMessage])

  // Auto-scroll main feed
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-scroll thread
  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadReplies])

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

            // Update main feed or thread replies
            if (newMsg.parent_message_id) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev
                return [...prev, formattedMsg]
              })
              
              if (activeThreadMessageRef.current?.id === newMsg.parent_message_id) {
                setThreadReplies((prev) => {
                  if (prev.some((r) => r.id === newMsg.id)) return prev
                  return [...prev, formattedMsg]
                })
              }
            } else {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev
                return [...prev, formattedMsg]
              })
            }
          } else if (payload.eventType === 'DELETE') {
            const oldMsg = payload.old as any
            setMessages((prev) => prev.filter((m) => m.id !== oldMsg.id))
            setThreadReplies((prev) => prev.filter((m) => m.id !== oldMsg.id))
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
          table: 'message_reactions',
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
            setThreadReplies(updateReactions)
          } else if (payload.eventType === 'DELETE') {
            const oldReaction = payload.old as any
            const filterReactions = (prev: Message[]) =>
              prev.map((msg) => {
                const reactions = msg.reactions || []
                return { ...msg, reactions: reactions.filter((r) => r.id !== oldReaction.id) }
              })
            setMessages(filterReactions)
            setThreadReplies(filterReactions)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(sub)
      supabase.removeChannel(subReactions)
    }
  }, [channel.id, groupId])

  // Fetch thread replies
  const handleOpenThread = async (msg: Message) => {
    setActiveThreadMessage(msg)
    setLoadingThread(true)
    const supabase = createClient()
    
    const { data: rawReplies } = await supabase
      .from('channel_messages')
      .select('id, content, is_spoiler_gated, chapter_number, created_at, user_id, parent_message_id')
      .eq('parent_message_id', msg.id)
      .order('created_at', { ascending: true })

    if (rawReplies) {
      const uIds = [...new Set(rawReplies.map((r) => r.user_id))]
      
      const { data: authors } = uIds.length
        ? await supabase
            .from('users')
            .select('id, username, display_name, avatar_url')
            .in('id', uIds)
        : { data: [] }

      const { data: memberships } = uIds.length
        ? await supabase
            .from('group_memberships')
            .select('user_id, role')
            .eq('group_id', groupId)
            .in('user_id', uIds)
        : { data: [] }

      const replyIds = rawReplies.map((r) => r.id)
      const { data: rawReactions } = replyIds.length
        ? await supabase
            .from('message_reactions')
            .select('id, message_id, reaction_type, user_id')
            .in('message_id', replyIds)
        : { data: null }

      const reactionMap = new Map<string, Array<{ id?: string; reaction_type: string; user_id: string }>>()
      if (rawReactions) {
        for (const r of rawReactions) {
          if (!reactionMap.has(r.message_id)) {
            reactionMap.set(r.message_id, [])
          }
          reactionMap.get(r.message_id)!.push(r)
        }
      }

      const membershipMap = new Map((memberships ?? []).map((m) => [m.user_id, m.role]))
      const authorMap = new Map((authors ?? []).map((a) => [a.id, a]))
      
      const formatted = rawReplies.map((r) => ({
        ...r,
        author: authorMap.get(r.user_id)
          ? {
              ...authorMap.get(r.user_id)!,
              role: membershipMap.get(r.user_id) || 'member',
            }
          : undefined,
        reactions: reactionMap.get(r.id) || [],
      })) as Message[]
      
      setThreadReplies(formatted)
    } else {
      setThreadReplies([])
    }
    setLoadingThread(false)
  }

  // Send a new top-level message
  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || isPending) return
    const content = text.trim()
    setText('')
    startTransition(async () => {
      await sendMessage(channel.id, content, isSpoiler, null)
    })
  }

  // Send a reply in the current thread
  const handleSendThreadReply = (e: React.FormEvent) => {
    e.preventDefault()
    if (!threadText.trim() || isThreadPending || !activeThreadMessage) return
    const content = threadText.trim()
    setThreadText('')
    
    // Add optimistically to both messages and threadReplies
    const tempReplyId = Math.random().toString()
    const newReply: Message = {
      id: tempReplyId,
      content,
      is_spoiler_gated: false,
      chapter_number: null,
      created_at: new Date().toISOString(),
      user_id: myUserId,
      parent_message_id: activeThreadMessage.id,
      author: {
        username: myProfile?.username || 'me',
        display_name: myProfile?.display_name || 'Me',
        avatar_url: myProfile?.avatar_url || null,
        role: 'member',
      },
      reactions: []
    }
    
    setMessages(prev => [...prev, newReply])
    setThreadReplies(prev => [...prev, newReply])
    
    startThreadTransition(async () => {
      await sendMessage(channel.id, content, false, null, activeThreadMessage.id)
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
  const handleReactionPress = async (messageId: string, emoji: string) => {
    // Optimistic toggle
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg
        const existingReactions = msg.reactions || []
        const index = existingReactions.findIndex(
          (r) => r.reaction_type === emoji && r.user_id === myUserId,
        )
        let newReactions
        if (index > -1) {
          newReactions = existingReactions.filter((_, i) => i !== index)
        } else {
          newReactions = [...existingReactions, { reaction_type: emoji, user_id: myUserId }]
        }
        return { ...msg, reactions: newReactions }
      }),
    )

    // Sync thread state if open
    setThreadReplies((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg
        const existingReactions = msg.reactions || []
        const index = existingReactions.findIndex(
          (r) => r.reaction_type === emoji && r.user_id === myUserId,
        )
        let newReactions
        if (index > -1) {
          newReactions = existingReactions.filter((_, i) => i !== index)
        } else {
          newReactions = [...existingReactions, { reaction_type: emoji, user_id: myUserId }]
        }
        return { ...msg, reactions: newReactions }
      }),
    )

    const supabase = createClient()
    try {
      const { data: existing } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', myUserId)
        .eq('reaction_type', emoji)
        .maybeSingle()

      if (existing) {
        await supabase.from('message_reactions').delete().eq('id', existing.id)
      } else {
        await supabase.from('message_reactions').insert({
          message_id: messageId,
          user_id: myUserId,
          reaction_type: emoji,
        })
      }
    } catch (err) {
      // Table doesn't exist or permission error, handled optimistically
    }
  }

  // Handle message deletion
  const handleDeleteMessage = async (messageId: string) => {
    const supabase = createClient()
    try {
      const { error } = await supabase.from('channel_messages').delete().eq('id', messageId)
      if (!error) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
        setThreadReplies((prev) => prev.filter((m) => m.id !== messageId))
        if (activeThreadMessage?.id === messageId) {
          setActiveThreadMessage(null)
        }
      }
    } catch (err) {
      // Handled silently
    }
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
  const mainFeedMessages = messages.filter((m) => !m.parent_message_id)

  // Inner renderer for a message row (shared by feed and thread detail)
  const renderMessageRow = (msg: Message, isThreadParent = false) => {
    const isOwn = msg.user_id === myUserId
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
    const replies = messages.filter((r) => r.parent_message_id === msg.id)
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
          isThreadParent && "bg-[var(--surface-elevated)]/30 border border-[var(--border-main)] rounded-xl"
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
            <span className="text-[11px] text-[var(--text-tertiary)]">{formatTime(msg.created_at)}</span>
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
            {!isThreadParent && !msg.parent_message_id && replyCount > 0 && (
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

        {/* Hover action bar (Slack style) */}
        <div className="absolute right-4 top-2 hidden group-hover:flex items-center gap-1 bg-[var(--surface)] border border-[var(--border-main)] rounded-lg shadow-sm px-1.5 py-1 z-10">
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
          {!isThreadParent && !msg.parent_message_id && (
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
                  handleDeleteMessage(msg.id)
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
              You&apos;re on Ch. {myCurrentChapter}
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
              onClick={() => setActiveThreadMessage(null)}
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

            {/* Loading or replies list */}
            {loadingThread ? (
              <div className="flex justify-center items-center py-8 text-[var(--text-tertiary)]">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-sm">Loading replies...</span>
              </div>
            ) : threadReplies.length === 0 ? (
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
            </div>
            <Button
              type="submit"
              size="icon"
              disabled={isThreadPending || !threadText.trim()}
              className="h-9 w-9 shrink-0 rounded-xl"
            >
              {isThreadPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </aside>
      )}
    </div>
  )
}
