'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { setCompletionTargetDate, nudgeDeadlines } from '@/app/(app)/home/actions'

export function SetPaceModal({
  open,
  onClose,
  progressId,
  currentTargetDate,
}: {
  open: boolean
  onClose: () => void
  progressId: string
  currentTargetDate: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [targetDate, setTargetDate] = useState(
    currentTargetDate ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  )

  if (!open) return null

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await setCompletionTargetDate(progressId, targetDate)
      if (res.error) {
        alert(res.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  function handleNudge() {
    startTransition(async () => {
      const res = await nudgeDeadlines(progressId, 12)
      if (res.error) {
        alert(res.error)
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
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Calendar className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-serif text-xl font-bold text-[var(--text-primary)]">Set Your Pace</h2>
            <p className="text-sm text-[var(--text-secondary)]">Choose a target finish date.</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="target-date">Target finish date</Label>
            <Input
              id="target-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>

        <button
          type="button"
          onClick={handleNudge}
          disabled={isPending}
          className="mt-4 w-full text-center text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-60"
        >
          Running behind? Push all deadlines back 12 hours
        </button>
      </div>
    </div>
  )
}
