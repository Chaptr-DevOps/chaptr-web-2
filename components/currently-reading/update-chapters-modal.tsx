'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { BookCover } from '@/components/book-cover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateBookTotalChapters } from '@/app/(app)/home/actions'

export function UpdateChaptersModal({
  open,
  onClose,
  bookId,
  bookTitle,
  bookAuthor,
  coverUrl,
  currentChapters,
}: {
  open: boolean
  onClose: () => void
  bookId: string
  bookTitle: string
  bookAuthor: string | null
  coverUrl: string | null
  currentChapters: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [chapters, setChapters] = useState(String(currentChapters))
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const count = parseInt(chapters, 10)
    if (!count || count <= 0) {
      setError('Please enter a valid number of chapters')
      return
    }
    if (count > 200) {
      setError('Maximum of 200 chapters allowed')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await updateBookTotalChapters(bookId, count)
      if (res.error) {
        setError(res.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="w-12 shrink-0">
            <BookCover title={bookTitle} author={bookAuthor} src={coverUrl} />
          </div>
          <div>
            <h2 className="font-serif text-xl font-bold text-[var(--text-primary)]">Update Chapters</h2>
            <p className="text-sm text-[var(--text-secondary)]">{bookTitle}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="total-chapters">Total chapters</Label>
            <Input
              id="total-chapters"
              type="number"
              inputMode="numeric"
              min={1}
              max={200}
              autoFocus
              value={chapters}
              onChange={(e) => setChapters(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-[var(--error)]">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
