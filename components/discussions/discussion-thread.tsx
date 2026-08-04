import Link from 'next/link'
import { Heart, MessageCircle } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { Discussion } from '@/lib/types'

export interface DiscussionWithUser extends Discussion {
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

export function DiscussionThread({ discussion }: { discussion: DiscussionWithUser }) {
  const name = discussion.user?.display_name || discussion.user?.username || 'Unknown User'

  return (
    <Link
      href={`/home/discussions/${discussion.id}`}
      className="flex gap-3 rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-elevated)]"
    >
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
          <span className="flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" /> {discussion.reaction_count}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" /> {discussion.comment_count}
          </span>
          <span>{timeAgo(discussion.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}
