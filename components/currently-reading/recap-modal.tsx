'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'

export function RecapModal({
  open,
  onClose,
  bookId,
  bookTitle,
  lastNote,
  formatTimeAgo,
}: {
  open: boolean
  onClose: () => void
  bookId: string
  bookTitle: string
  lastNote: { content: string; createdAt: string } | null
  formatTimeAgo: (iso: string) => string
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-serif text-xl font-bold text-[var(--text-primary)]">Recap</h2>
            <p className="text-sm text-[var(--text-secondary)]">Where you left off with {bookTitle}.</p>
          </div>
        </div>

        {lastNote ? (
          <div className="rounded-xl border border-[var(--border-main)] bg-[var(--surface-elevated)] p-4">
            <p className="whitespace-pre-wrap text-[15px] text-[var(--text-primary)]">{lastNote.content}</p>
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">{formatTimeAgo(lastNote.createdAt)}</p>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            You haven&rsquo;t written any notes for this book yet.
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <Link href={`/library/notes/${bookId}`} className={buttonVariants({ className: 'flex-1' })}>
            View all notes
          </Link>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
