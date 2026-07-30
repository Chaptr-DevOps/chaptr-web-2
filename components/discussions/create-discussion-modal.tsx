'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { createDiscussion } from '@/app/(app)/home/actions'

export function CreateDiscussionModal({
  open,
  onClose,
  bookId,
  currentChapter,
  groupId,
  groupName,
  initialContent,
}: {
  open: boolean
  onClose: () => void
  bookId: string
  currentChapter: number
  groupId?: string | null
  groupName?: string | null
  initialContent?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [content, setContent] = useState(initialContent ?? '')
  const [chapterNumber, setChapterNumber] = useState(String(currentChapter))
  const [isSpoiler, setIsSpoiler] = useState(false)
  const [scopeType, setScopeType] = useState<'general' | 'group'>(groupId ? 'group' : 'general')
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) {
      setError('Write something to post')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await createDiscussion({
        content,
        bookId,
        chapterNumber: Number(chapterNumber) || currentChapter,
        scopeType,
        groupId,
        isSpoiler,
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setContent('')
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
            <MessageSquare className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-serif text-xl font-bold text-[var(--text-primary)]">Start a Discussion</h2>
            <p className="text-sm text-[var(--text-secondary)]">Share your thoughts with fellow readers.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="discussion-content">What's on your mind?</Label>
            <Textarea
              id="discussion-content"
              autoFocus
              rows={4}
              placeholder="Share a thought, question, or reaction..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="discussion-chapter">Chapter</Label>
            <Input
              id="discussion-chapter"
              type="number"
              inputMode="numeric"
              min={1}
              value={chapterNumber}
              onChange={(e) => setChapterNumber(e.target.value)}
            />
          </div>

          {groupId && (
            <div className="flex items-center justify-between rounded-xl border border-[var(--border-main)] p-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Post to {groupName ?? 'group'}</p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {scopeType === 'group' ? 'Only your group can see this' : 'Everyone reading this book can see this'}
                </p>
              </div>
              <Switch
                checked={scopeType === 'group'}
                onCheckedChange={(v) => setScopeType(v ? 'group' : 'general')}
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border border-[var(--border-main)] p-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Contains spoilers</p>
              <p className="text-xs text-[var(--text-tertiary)]">Readers will be warned before viewing</p>
            </div>
            <Switch checked={isSpoiler} onCheckedChange={setIsSpoiler} />
          </div>

          {error && <p className="text-sm text-[var(--error)]">{error}</p>}

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post'}
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
