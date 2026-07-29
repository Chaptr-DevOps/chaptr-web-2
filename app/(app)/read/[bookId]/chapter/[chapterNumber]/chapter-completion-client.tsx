'use client'

import { useState } from 'react'
import { ChapterHeader } from '@/components/chapter/chapter-header'
import { NoteList } from '@/components/chapter/note-list'
import { NoteComposer } from '@/components/chapter/note-composer'
import type { ChapterNote } from '@/components/chapter/types'
import {
  addChapterNote,
  updateChapterNote,
  deleteChapterNote,
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

  async function handleAdd(content: string) {
    setNoteError(null)
    const tempId = `temp-${Date.now()}`
    setNotes((prev) => [...prev, { id: tempId, content, pending: true }])

    const res = await addChapterNote({ bookId, chapterNumber, content, groupId })

    if ('error' in res) {
      setNotes((prev) => prev.filter((n) => n.id !== tempId))
      setNoteError(res.error ?? null)
      return
    }

    setNotes((prev) =>
      prev.map((n) => (n.id === tempId ? { id: res.id, content } : n))
    )
  }

  async function handleEdit(id: string, content: string) {
    setNoteError(null)
    const previous = notes
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)))

    const res = await updateChapterNote(id, content)
    if ('error' in res) {
      setNotes(previous)
      setNoteError(res.error ?? null)
    }
  }

  async function handleDelete(id: string) {
    setNoteError(null)
    const previous = notes
    setNotes((prev) => prev.filter((n) => n.id !== id))

    const res = await deleteChapterNote(id)
    if ('error' in res) {
      setNotes(previous)
      setNoteError(res.error ?? null)
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
        animatedPercent={fromPercent}
        accentColor={groupColor}
        groupId={groupId}
      />

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <NoteList notes={notes} onEdit={handleEdit} onDelete={handleDelete} />
      </div>

      <div className="border-t border-[var(--border-main)] bg-background px-4 pb-6 pt-4">
        <NoteComposer onSubmit={handleAdd} error={noteError} />
      </div>
    </div>
  )
}
