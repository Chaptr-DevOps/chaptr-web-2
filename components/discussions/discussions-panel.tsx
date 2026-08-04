'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { DiscussionThread, type DiscussionWithUser } from './discussion-thread'
import { CreateDiscussionModal } from './create-discussion-modal'

export function DiscussionsPanel({
  discussions,
  bookId,
  currentChapter,
  groupId,
  groupName,
}: {
  discussions: DiscussionWithUser[]
  bookId: string
  currentChapter: number
  groupId?: string | null
  groupName?: string | null
}) {
  const [showCreate, setShowCreate] = useState(false)

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">Discussions</h2>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
          aria-label="Start a discussion"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {discussions.length > 0 ? (
        <div className="flex flex-col gap-3">
          {discussions.map((d) => (
            <DiscussionThread key={d.id} discussion={d} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-main)] bg-[var(--surface)] px-6 py-10 text-center">
          <p className="text-[15px] text-[var(--text-secondary)]">
            No discussions yet for this chapter. Be the first to share your thoughts.
          </p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-[var(--interactive-primary-foreground)]"
          >
            Start a discussion
          </button>
        </div>
      )}

      <CreateDiscussionModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        bookId={bookId}
        currentChapter={currentChapter}
        groupId={groupId}
        groupName={groupName}
      />
    </section>
  )
}
