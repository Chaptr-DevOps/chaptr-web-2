'use client'

import { useState } from 'react'
import { ChapterHeader } from '@/components/chapter/chapter-header'
import type { ChapterNote } from '@/components/chapter/types'

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

  const fromPercent = totalChapters
    ? Math.max(0, Math.round(((chapterNumber - 1) / totalChapters) * 100))
    : 0
  const toPercent = totalChapters
    ? Math.min(100, Math.round((chapterNumber / totalChapters) * 100))
    : 0

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

      <div className="flex-1 px-4 py-6 text-sm text-[var(--text-tertiary)]">
        {notes.length} note{notes.length === 1 ? '' : 's'} loaded
      </div>
    </div>
  )
}
