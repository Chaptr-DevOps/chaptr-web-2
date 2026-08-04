'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ChapterHeader } from '@/components/chapter/chapter-header'
import { NoteList } from '@/components/chapter/note-list'
import { NoteComposer } from '@/components/chapter/note-composer'
import { ConfettiBurst } from '@/components/chapter/confetti-burst'
import { ChapterSuccess } from '@/components/chapter/chapter-success'
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
  bookAuthor: string | null
  coverImageUrl: string | null
  chapterNumber: number
  totalChapters: number
  progressId: string
  groupId: string | null
  groupColor: string | null
  completedChapterNumbers: number[]
  /** Timestamps of this book's existing completions, for the pace stat. */
  completionDates: string[]
  completionTargetDate: string | null
  startedAt: string | null
  initialNotes: ChapterNote[]
}

/**
 * Server actions REJECT on transport failure (dropped connection, aborted
 * request) rather than resolving to { error }. Without this wrapper a rejection
 * skips both branches of the caller's `if ('error' in res)` check and leaves
 * optimistic state stuck forever — a pending note that never resolves, or a
 * spinner that never stops.
 */
async function runAction<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn()
  } catch {
    return { error: 'Something went wrong. Check your connection and try again.' }
  }
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
  const [showConfetti, setShowConfetti] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [animatedPercent, setAnimatedPercent] = useState(fromPercent)
  const [isFinalChapter, setIsFinalChapter] = useState(false)

  const savedNotes = notes.filter((n) => !n.pending)
  const hasPendingNote = notes.some((n) => n.pending)
  // Completing while a note is still saving would silently drop it: the noteIds
  // snapshot cannot include an id the server has not issued yet, so that note is
  // left out of the combined chapter note and stranded as a loose snippet.
  // Block until every note has landed.
  const alreadyLogged = props.completedChapterNumbers.includes(chapterNumber)
  const canComplete =
    savedNotes.length > 0 && !hasPendingNote && !completing && !alreadyLogged

  // Frozen at completion time. `savedNotes` recomputes on every render, so
  // displaying its live length would inflate the count if a note resolved late.
  const [completedNoteCount, setCompletedNoteCount] = useState(0)

  // The completion the user just made is not in the server-rendered array, but
  // the pace stat is meaningless without it — a reader logging their second
  // chapter would otherwise be told there is no pace yet.
  const [completionDates, setCompletionDates] = useState(props.completionDates)

  // Why the button is disabled, or null when it is enabled. Wired to the button
  // via aria-describedby so the reason is available to assistive tech.
  const completeHint = alreadyLogged
    ? 'You already logged this chapter — your notes are saved in your library'
    : hasPendingNote
      ? 'Saving your note…'
      : savedNotes.length === 0
        ? 'Capture a thought to complete this chapter'
        : null

  async function handleComplete() {
    if (!canComplete) return
    setCompleteError(null)
    setCompleting(true)

    const res = await runAction(() =>
      completeChapterWithNotes({
        progressId: props.progressId,
        bookId,
        chapterNumber,
        groupId,
        noteIds: savedNotes.map((n) => n.id),
      })
    )

    setCompleting(false)

    if ('error' in res) {
      setCompleteError(res.error)
      return
    }

    setCompletedNoteCount(savedNotes.length)
    setCompletionDates((prev) => [...prev, new Date().toISOString()])
    setIsFinalChapter(res.isFinalChapter)
    setCompleted(true)
    setShowConfetti(true)
    // The progress bar is already mounted in the header, so setting the width
    // here transitions via its `transition-[width]` class.
    setAnimatedPercent(Math.round(res.progressPercentage))
  }

  useEffect(() => {
    if (!showConfetti) return
    // Finishing a whole book earns a longer burst than finishing a chapter.
    const timer = window.setTimeout(() => setShowConfetti(false), isFinalChapter ? 4200 : 2500)
    return () => window.clearTimeout(timer)
  }, [showConfetti, isFinalChapter])

  async function handleAdd(content: string): Promise<boolean> {
    setNoteError(null)
    const tempId = `temp-${crypto.randomUUID()}`
    setNotes((prev) => [...prev, { id: tempId, content, pending: true }])

    const res = await runAction(() =>
      addChapterNote({ bookId, chapterNumber, content, groupId })
    )

    if ('error' in res) {
      setNotes((prev) => prev.filter((n) => n.id !== tempId))
      setNoteError(res.error)
      return false
    }

    setNotes((prev) =>
      prev.map((n) => (n.id === tempId ? { id: res.id, content } : n))
    )
    return true
  }

  // Rollback is PER-NOTE, never a whole-array snapshot. Restoring a stale
  // `previous` array would resurrect a note that a concurrent delete had
  // successfully removed, or revert a sibling note's successful edit — the
  // requests are independent and can fail in any order.
  async function handleEdit(id: string, content: string) {
    setNoteError(null)
    const prior = notes.find((n) => n.id === id)?.content
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)))

    const res = await runAction(() => updateChapterNote(id, content))
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

    const res = await runAction(() => deleteChapterNote(id))
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
        <ChapterSuccess
          bookId={bookId}
          bookTitle={bookTitle}
          bookAuthor={props.bookAuthor}
          coverImageUrl={props.coverImageUrl}
          chapterNumber={chapterNumber}
          totalChapters={totalChapters}
          fromPercent={fromPercent}
          toPercent={animatedPercent}
          noteCount={completedNoteCount}
          isFinalChapter={isFinalChapter}
          completionTargetDate={props.completionTargetDate}
          startedAt={props.startedAt}
          completionDates={completionDates}
          accentColor={groupColor}
        />
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
              aria-describedby={completeHint ? 'complete-hint' : undefined}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-[15px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {completing && <Loader2 className="h-4 w-4 animate-spin" />}
              {completing ? 'Saving...' : 'Complete Chapter'}
            </button>

            {completeHint && (
              <p
                id="complete-hint"
                className="mt-2 text-center text-xs text-[var(--text-tertiary)]"
              >
                {completeHint}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
