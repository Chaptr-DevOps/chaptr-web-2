'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { ChapterHeader } from '@/components/chapter/chapter-header'
import { NoteList } from '@/components/chapter/note-list'
import { NoteComposer } from '@/components/chapter/note-composer'
import { ConfettiBurst } from '@/components/chapter/confetti-burst'
import type { ChapterNote } from '@/components/chapter/types'
import {
  addChapterNote,
  updateChapterNote,
  deleteChapterNote,
  completeChapterWithNotes,
} from '@/app/(app)/read/actions'

export interface ChapterCompletionClientProps {
  bookId: string
  bookTitle: string
  chapterNumber: number
  totalChapters: number
  progressId: string
  groupId: string | null
  groupColor: string | null
  groupName: string | null
  completedChapterNumbers: number[]
  initialNotes: ChapterNote[]
}

export function ChapterCompletionClient(props: ChapterCompletionClientProps) {
  const { bookId, bookTitle, chapterNumber, totalChapters, groupId, groupColor } = props

  const [notes, setNotes] = useState<ChapterNote[]>(props.initialNotes)
  const [noteError, setNoteError] = useState<string | null>(null)

  const fromPercent = totalChapters
    ? Math.max(0, Math.round(((chapterNumber - 1) / totalChapters) * 100))
    : 0
  const toPercent = totalChapters
    ? Math.min(100, Math.round((chapterNumber / totalChapters) * 100))
    : 0

  const [completed, setCompleted] = useState(false)
  const [isFinalChapter, setIsFinalChapter] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [animatedPercent, setAnimatedPercent] = useState(fromPercent)

  const savedNotes = notes.filter((n) => !n.pending)
  const canComplete = savedNotes.length > 0 && !completing

  async function handleComplete() {
    if (!canComplete) return
    setCompleteError(null)
    setCompleting(true)

    const res = await completeChapterWithNotes({
      progressId: props.progressId,
      bookId,
      chapterNumber,
      groupId,
      noteIds: savedNotes.map((n) => n.id),
    })

    setCompleting(false)

    if ('error' in res) {
      setCompleteError(res.error)
      return
    }

    setIsFinalChapter(res.isFinalChapter)
    setCompleted(true)
    setShowConfetti(true)
    window.setTimeout(() => setShowConfetti(false), 2500)
    // Let the bar animate to the value the server actually recorded.
    requestAnimationFrame(() => setAnimatedPercent(Math.round(res.progressPercentage)))
  }

  async function handleAdd(content: string) {
    setNoteError(null)
    const tempId = `temp-${Date.now()}`
    setNotes((prev) => [...prev, { id: tempId, content, pending: true }])

    const res = await addChapterNote({ bookId, chapterNumber, content, groupId })

    if ('error' in res) {
      setNotes((prev) => prev.filter((n) => n.id !== tempId))
      setNoteError(res.error)
      return
    }

    setNotes((prev) =>
      prev.map((n) => (n.id === tempId ? { id: res.id, content } : n))
    )
  }

  // Rollback is PER-NOTE, never a whole-array snapshot. Restoring a stale
  // `previous` array would resurrect a note that a concurrent delete had
  // successfully removed, or revert a sibling note's successful edit — the
  // requests are independent and can fail in any order.
  async function handleEdit(id: string, content: string) {
    setNoteError(null)
    const prior = notes.find((n) => n.id === id)?.content
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)))

    const res = await updateChapterNote(id, content)
    if ('error' in res) {
      if (prior !== undefined) {
        setNotes((prev) =>
          prev.map((n) => (n.id === id ? { ...n, content: prior } : n))
        )
      }
      setNoteError(res.error)
    }
  }

  async function handleDelete(id: string) {
    setNoteError(null)
    const priorIndex = notes.findIndex((n) => n.id === id)
    const prior = priorIndex === -1 ? undefined : notes[priorIndex]
    setNotes((prev) => prev.filter((n) => n.id !== id))

    const res = await deleteChapterNote(id)
    if ('error' in res) {
      if (prior) {
        // Re-insert just this note, at its original position.
        setNotes((prev) => {
          if (prev.some((n) => n.id === id)) return prev
          const next = [...prev]
          next.splice(Math.min(priorIndex, next.length), 0, prior)
          return next
        })
      }
      setNoteError(res.error)
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      <ChapterHeader
        bookId={bookId}
        bookTitle={bookTitle}
        chapterNumber={chapterNumber}
        totalChapters={totalChapters}
        completedChapterNumbers={props.completedChapterNumbers}
        fromPercent={fromPercent}
        toPercent={toPercent}
        animatedPercent={animatedPercent}
        accentColor={groupColor}
        groupId={groupId}
      />

      <ConfettiBurst show={showConfetti} />

      {completed ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-elevated)]">
            <CheckCircle2 className="h-8 w-8 text-[var(--success)]" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-[var(--text-primary)]">
            Chapter Complete!
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {savedNotes.length} note{savedNotes.length === 1 ? '' : 's'} saved
          </p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <NoteList notes={notes} onEdit={handleEdit} onDelete={handleDelete} />
          </div>

          <div className="border-t border-[var(--border-main)] bg-background px-4 pb-6 pt-4">
            <NoteComposer onSubmit={handleAdd} error={noteError} />

            {completeError && (
              <p className="mt-3 text-sm text-[var(--error)]">{completeError}</p>
            )}

            <button
              type="button"
              onClick={handleComplete}
              disabled={!canComplete}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-[15px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {completing && <Loader2 className="h-4 w-4 animate-spin" />}
              {completing ? 'Saving...' : 'Complete Chapter'}
            </button>

            {savedNotes.length === 0 && (
              <p className="mt-2 text-center text-xs text-[var(--text-tertiary)]">
                Capture a thought to complete this chapter
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
