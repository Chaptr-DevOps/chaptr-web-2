'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MessageCircle, MessageSquare, Sparkles } from 'lucide-react'
import { useModalDismiss } from './use-modal-dismiss'

export function BookCompletionModal({
  open,
  onClose,
  bookTitle,
  bookId,
  groupId,
  onShare,
}: {
  open: boolean
  onClose: () => void
  bookTitle: string
  bookId: string
  groupId: string | null
  onShare: () => void
}) {
  const router = useRouter()
  const dialogRef = useModalDismiss(open, onClose)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Book complete"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-6 text-center shadow-2xl outline-none"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-elevated)]">
          <Sparkles className="h-8 w-8 text-[var(--success)]" />
        </div>

        <h2 className="font-serif text-2xl font-bold text-[var(--text-primary)]">
          You finished it
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{bookTitle}</p>

        <div className="mt-6 space-y-2 text-left">
          <button
            type="button"
            onClick={onShare}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-main)] bg-[var(--background)] p-4 transition-colors hover:bg-[var(--surface-elevated)]"
          >
            <MessageSquare className="h-5 w-5 shrink-0 text-primary" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Share your final thoughts
            </span>
          </button>

          {groupId && (
            <Link
              href={`/groups/${groupId}`}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-main)] bg-[var(--background)] p-4 transition-colors hover:bg-[var(--surface-elevated)]"
            >
              <MessageCircle className="h-5 w-5 shrink-0 text-[var(--text-secondary)]" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                View group discussion
              </span>
            </Link>
          )}

          <Link
            href={`/library/notes/${bookId}`}
            className="flex w-full items-center justify-center rounded-xl py-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            Review my notes
          </Link>
        </div>

        <button
          type="button"
          onClick={() => router.push('/home')}
          className="mt-2 w-full rounded-xl py-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          Done
        </button>
      </div>
    </div>
  )
}
