'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { ChapterHeader } from '@/components/chapter/chapter-header'
import { NoteList } from '@/components/chapter/note-list'
import { NoteComposer } from '@/components/chapter/note-composer'
import { ConfettiBurst } from '@/components/chapter/confetti-burst'
import { PostCompletionModal } from '@/components/chapter/post-completion-modal'
import { BookCompletionModal } from '@/components/chapter/book-completion-modal'
import { CreateDiscussionModal } from '@/components/discussions/create-discussion-modal'
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
  const [modal, setModal] = useState<'none' | 'post' | 'book' | 'discussion'>('none')

  const savedNotes = notes.filter((n) => !n.pending)
  const hasPendingNote = notes.some((n) => n.pending)
  // Completing while a note is still saving would permanently mistag it: the
  // noteIds snapshot cannot include an id the server has not issued yet, so that
  // note stays note_type 'snippet' forever and is never associated with this
  // completion. Block until every note has landed.
  const canComplete = savedNotes.length > 0 && !hasPendingNote && !completing

  // Frozen at completion time. `savedNotes` recomputes on every render, so
  // displaying its live length would inflate the count if a note resolved late.
  const [completedNoteCount, setCompletedNoteCount] = useState(0)

  // Why the button is disabled, or null when it is enabled. Wired to the button
  // via aria-describedby so the reason is available to assistive tech.
  const completeHint = hasPendingNote
    ? 'Saving your note…'
    : savedNotes.length === 0
      ? 'Capture a thought to complete this chapter'
      : null

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

    setCompletedNoteCount(savedNotes.length)
    setIsFinalChapter(res.isFinalChapter)
    setCompleted(true)
    setShowConfetti(true)
    setModal(res.isFinalChapter ? 'book' : 'post')
    // The progress bar is already mounted in the header, so setting the width
    // here transitions via its `transition-[width]` class.
    setAnimatedPercent(Math.round(res.progressPercentage))
  }

  useEffect(() => {
    if (!showConfetti) return
    const timer = window.setTimeout(() => setShowConfetti(false), 2500)
    return () => window.clearTimeout(timer)
  }, [showConfetti])

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
            {completedNoteCount} note{completedNoteCount === 1 ? '' : 's'} saved
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

      <PostCompletionModal
        open={modal === 'post'}
        onClose={() => setModal('none')}
        chapterNumber={chapterNumber}
        noteCount={savedNotes.length}
        bookId={bookId}
        groupId={groupId}
        groupName={props.groupName}
        onShare={() => setModal('discussion')}
      />

      <BookCompletionModal
        open={modal === 'book'}
        onClose={() => setModal('none')}
        bookTitle={bookTitle}
        bookId={bookId}
        groupId={groupId}
        onShare={() => setModal('discussion')}
      />

      {/* Mounted CONDITIONALLY, not just toggled via `open`. CreateDiscussionModal
          seeds its content with `useState(initialContent ?? '')`, and a useState
          initializer runs only on mount. If the component stayed mounted from the
          page's first render, it would seed from an empty note list and the
          textarea would open blank forever — and any text typed then cancelled
          would persist into the next open. Conditional mounting gives a fresh
          instance, correctly seeded, every time. */}
      {modal === 'discussion' && (
        <CreateDiscussionModal
          open
          onClose={() => setModal('none')}
          bookId={bookId}
          currentChapter={chapterNumber}
          groupId={groupId}
          groupName={props.groupName}
          initialContent={savedNotes.map((n) => n.content).join('\n\n')}
        />
      )}
    </div>
  )
}
