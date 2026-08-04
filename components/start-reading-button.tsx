'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BookCover } from '@/components/book-cover'
import { startReadingGroupBook } from '@/app/(app)/groups/actions'

interface StartReadingButtonProps {
  groupId: string
  bookId: string
  bookTitle: string
  bookAuthor: string | null
  coverUrl: string | null
  /** Book's known chapter count. When null we ask before starting. */
  totalChapters: number | null
}

/**
 * "Start Reading" CTA for a group's current book. If we already know how many
 * chapters the book has we start immediately; otherwise we ask first, since
 * chapter count is what drives pacing and the chapter-gated channels.
 */
export function StartReadingButton({
  groupId,
  bookId,
  bookTitle,
  bookAuthor,
  coverUrl,
  totalChapters,
}: StartReadingButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [askChapters, setAskChapters] = useState(false)
  const [chapters, setChapters] = useState('')
  const [error, setError] = useState('')

  function start(count?: number) {
    setError('')
    startTransition(async () => {
      const res = await startReadingGroupBook(groupId, bookId, count)
      if (res.error) {
        setError(res.error)
        return
      }
      setAskChapters(false)
      router.refresh()
    })
  }

  function handleClick() {
    if (totalChapters && totalChapters > 0) start()
    else setAskChapters(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const count = parseInt(chapters, 10)
    if (!count || count <= 0 || count > 200) {
      setError('Enter a chapter count between 1 and 200')
      return
    }
    start(count)
  }

  return (
    <>
      <div className="flex flex-col items-center gap-1 sm:items-end">
        <Button size="sm" onClick={handleClick} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <BookOpen className="mr-1.5 h-4 w-4" />
          )}
          Start Reading
        </Button>
        {error && !askChapters && (
          <p className="text-xs text-[var(--error)]">{error}</p>
        )}
      </div>

      {askChapters && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && !isPending && setAskChapters(false)}
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="mb-5 flex items-center gap-4">
              <div className="w-12 shrink-0">
                <BookCover title={bookTitle} author={bookAuthor} src={coverUrl} />
              </div>
              <div className="min-w-0">
                <h2 className="font-serif text-xl font-bold text-[var(--text-primary)]">
                  Start reading
                </h2>
                <p className="line-clamp-1 text-sm text-[var(--text-secondary)]">{bookTitle}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="total-chapters">How many chapters does your copy have?</Label>
                <Input
                  id="total-chapters"
                  autoFocus
                  inputMode="numeric"
                  placeholder="e.g. 24"
                  value={chapters}
                  onChange={(e) => setChapters(e.target.value.replace(/\D/g, ''))}
                />
                <p className="text-xs text-[var(--text-tertiary)]">
                  This sets the pace and unlocks chapter-gated channels as you go. You&apos;ll
                  start at chapter 1.
                </p>
              </div>

              {error && <p className="text-sm text-[var(--error)]">{error}</p>}

              <div className="flex gap-3">
                <Button type="submit" className="flex-1" disabled={isPending || !chapters}>
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Start Reading'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAskChapters(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
