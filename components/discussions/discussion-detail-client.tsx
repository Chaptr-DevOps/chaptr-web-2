'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Heart, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Comment } from '@/lib/types'
import type { DiscussionWithUser } from './discussion-thread'
import { addComment, toggleReaction } from '@/app/(app)/home/discussions/[discussionId]/actions'

export interface CommentWithUser extends Comment {
  user: { display_name: string | null; username: string | null; avatar_url: string | null } | null
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function LikeButton({
  count,
  liked,
  onToggle,
}: {
  count: number
  liked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-center gap-1 text-xs transition-colors',
        liked ? 'text-[var(--error)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
      )}
    >
      <Heart className={cn('h-3.5 w-3.5', liked && 'fill-current')} />
      {count}
    </button>
  )
}

function CommentCard({
  comment,
  reaction,
  onToggleReaction,
  onReply,
}: {
  comment: CommentWithUser
  reaction: { count: number; likedByMe: boolean }
  onToggleReaction: () => void
  onReply: () => void
}) {
  const name = comment.user?.display_name || comment.user?.username || 'Unknown User'
  return (
    <div className="flex gap-3 rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-4">
      <Avatar src={comment.user?.avatar_url} name={name} size={32} />
      <div className="min-w-0 flex-1">
        <span className="truncate font-medium text-[var(--text-primary)]">{name}</span>
        <p className="mt-1 whitespace-pre-wrap text-[15px] text-[var(--text-primary)]">
          {comment.content}
        </p>
        <div className="mt-2 flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
          <LikeButton count={reaction.count} liked={reaction.likedByMe} onToggle={onToggleReaction} />
          <button type="button" onClick={onReply} className="hover:text-[var(--text-secondary)]">
            Reply
          </button>
          <span>{timeAgo(comment.created_at)}</span>
        </div>
      </div>
    </div>
  )
}

export function DiscussionDetailClient({
  discussion,
  bookTitle,
  comments,
  reactionsByTarget,
  currentUserId,
}: {
  discussion: DiscussionWithUser
  bookTitle: string | null
  comments: CommentWithUser[]
  reactionsByTarget: Record<string, { count: number; likedByMe: boolean }>
  currentUserId: string
}) {
  const [reactions, setReactions] = useState(reactionsByTarget)
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null)
  const [content, setContent] = useState('')
  const [isPending, startTransition] = useTransition()

  const name = discussion.user?.display_name || discussion.user?.username || 'Unknown User'
  const discussionReaction = reactions[discussion.id] ?? { count: discussion.reaction_count, likedByMe: false }

  const topLevel = comments.filter((c) => !c.parent_comment_id)

  const byId = new Map(comments.map((c) => [c.id, c]))
  function rootIdOf(comment: CommentWithUser): string {
    let current = comment
    const seen = new Set<string>()
    while (current.parent_comment_id && !seen.has(current.id)) {
      seen.add(current.id)
      const parent = byId.get(current.parent_comment_id)
      if (!parent) break
      current = parent
    }
    return current.id
  }

  // Replies nest one level deep visually: any reply-to-a-reply is grouped
  // under its top-level ancestor rather than dropped or deeply indented.
  const repliesByParent = new Map<string, CommentWithUser[]>()
  for (const c of comments) {
    if (!c.parent_comment_id) continue
    const rootId = rootIdOf(c)
    const list = repliesByParent.get(rootId) ?? []
    list.push(c)
    repliesByParent.set(rootId, list)
  }
  for (const list of repliesByParent.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at))
  }

  function handleToggleReaction(targetType: 'discussion' | 'comment', targetId: string) {
    const current = reactions[targetId] ?? { count: 0, likedByMe: false }
    const optimistic = {
      count: current.likedByMe ? current.count - 1 : current.count + 1,
      likedByMe: !current.likedByMe,
    }
    setReactions((prev) => ({ ...prev, [targetId]: optimistic }))
    startTransition(async () => {
      await toggleReaction({ discussionId: discussion.id, targetType, targetId })
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) return
    startTransition(async () => {
      await addComment({
        discussionId: discussion.id,
        content: trimmed,
        parentCommentId: replyingTo?.id ?? null,
      })
      setContent('')
      setReplyingTo(null)
    })
  }

  return (
    <div className="flex flex-col">
      <header className="flex items-center gap-3 border-b border-[var(--border-main)] bg-[var(--surface)] px-4 py-3">
        <Link
          href="/home"
          aria-label="Back"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-main)] text-[var(--text-tertiary)] hover:bg-[var(--surface-elevated)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-serif text-[18px] text-[var(--text-primary)]">Discussion</h1>
          {bookTitle && (
            <p className="truncate text-xs text-[var(--text-tertiary)]">
              {bookTitle} · Ch {discussion.chapter_number}
            </p>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex gap-3 rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-4">
          <Avatar src={discussion.user?.avatar_url} name={name} size={36} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-[var(--text-primary)]">{name}</span>
              <Badge variant="neutral">Ch {discussion.chapter_number}</Badge>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-[15px] text-[var(--text-primary)]">
              {discussion.content}
            </p>
            <div className="mt-2 flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
              <LikeButton
                count={discussionReaction.count}
                liked={discussionReaction.likedByMe}
                onToggle={() => handleToggleReaction('discussion', discussion.id)}
              />
              <span>{timeAgo(discussion.created_at)}</span>
            </div>
          </div>
        </div>

        <h2 className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">
          {comments.length > 0 ? `${comments.length} ${comments.length === 1 ? 'reply' : 'replies'}` : 'No replies yet'}
        </h2>

        {topLevel.map((c) => (
          <div key={c.id} className="flex flex-col gap-2">
            <CommentCard
              comment={c}
              reaction={reactions[c.id] ?? { count: c.reaction_count, likedByMe: false }}
              onToggleReaction={() => handleToggleReaction('comment', c.id)}
              onReply={() =>
                setReplyingTo({ id: c.id, name: c.user?.display_name || c.user?.username || 'Unknown User' })
              }
            />
            {(repliesByParent.get(c.id) ?? []).length > 0 && (
              <div className="ml-8 flex flex-col gap-2">
                {(repliesByParent.get(c.id) ?? []).map((r) => (
                  <CommentCard
                    key={r.id}
                    comment={r}
                    reaction={reactions[r.id] ?? { count: r.reaction_count, likedByMe: false }}
                    onToggleReaction={() => handleToggleReaction('comment', r.id)}
                    onReply={() =>
                      setReplyingTo({ id: c.id, name: r.user?.display_name || r.user?.username || 'Unknown User' })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 border-t border-[var(--border-main)] bg-[var(--surface)] p-3"
      >
        {replyingTo && (
          <div className="mb-2 flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
            Replying to {replyingTo.name}
            <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={replyingTo ? `Reply to ${replyingTo.name}...` : 'Add a reply...'}
            rows={1}
            className="min-h-[40px] flex-1 resize-none rounded-xl border border-[var(--border-main)] bg-[var(--background)] px-3 py-2 text-[15px] text-[var(--text-primary)] outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={isPending || !content.trim()}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-[var(--interactive-primary-foreground)] disabled:opacity-40"
          >
            Post
          </button>
        </div>
      </form>
    </div>
  )
}
