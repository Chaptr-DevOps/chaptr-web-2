'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, MessageCircle, MessageSquare, X } from 'lucide-react'

export function PostCompletionModal({
  open,
  onClose,
  chapterNumber,
  noteCount,
  bookId,
  groupId,
  groupName,
  onShare,
}: {
  open: boolean
  onClose: () => void
  chapterNumber: number
  noteCount: number
  bookId: string
  groupId: string | null
  groupName: string | null
  onShare: () => void
}) {
  const router = useRouter()

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Chapter complete"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-bold text-[var(--text-primary)]">
              Chapter {chapterNumber} logged
            </h2>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              {noteCount} note{noteCount === 1 ? '' : 's'} saved. What next?
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onShare}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-main)] bg-[var(--background)] p-4 text-left transition-colors hover:bg-[var(--surface-elevated)]"
          >
            <MessageSquare className="h-5 w-5 shrink-0 text-primary" />
            <span>
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                Share to discussion
              </span>
              <span className="block text-xs text-[var(--text-secondary)]">
                Start a thread with what you wrote
              </span>
            </span>
          </button>

          <Link
            href={`/library/notes/${bookId}`}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-main)] bg-[var(--background)] p-4 transition-colors hover:bg-[var(--surface-elevated)]"
          >
            <BookOpen className="h-5 w-5 shrink-0 text-[var(--text-secondary)]" />
            <span>
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                View my notes
              </span>
              <span className="block text-xs text-[var(--text-secondary)]">
                Everything you&apos;ve captured for this book
              </span>
            </span>
          </Link>

          {groupId && (
            <Link
              href={`/groups/${groupId}`}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-main)] bg-[var(--background)] p-4 transition-colors hover:bg-[var(--surface-elevated)]"
            >
              <MessageCircle className="h-5 w-5 shrink-0 text-[var(--text-secondary)]" />
              <span>
                <span className="block text-sm font-semibold text-[var(--text-primary)]">
                  Chat with {groupName ?? 'your group'}
                </span>
                <span className="block text-xs text-[var(--text-secondary)]">
                  See what everyone else is saying
                </span>
              </span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => router.push('/home')}
            className="w-full rounded-xl py-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            Keep it private
          </button>
        </div>
      </div>
    </div>
  )
}
