'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ChapterPicker } from './chapter-picker'

export function ChapterHeader({
  bookId,
  bookTitle,
  chapterNumber,
  totalChapters,
  completedChapterNumbers,
  fromPercent,
  toPercent,
  animatedPercent,
  accentColor,
  groupId,
}: {
  bookId: string
  bookTitle: string
  chapterNumber: number
  totalChapters: number
  completedChapterNumbers: number[]
  fromPercent: number
  toPercent: number
  animatedPercent: number
  accentColor: string | null
  groupId: string | null
}) {
  return (
    <header className="px-4 pt-4 pb-3">
      <p className="mb-1 text-center font-serif text-xs uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
        {bookTitle}
      </p>

      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <Link
            href="/home"
            aria-label="Back to home"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg -ml-2 transition-colors hover:bg-[var(--surface-elevated)]"
          >
            <ChevronLeft className="h-6 w-6 text-[var(--text-primary)]" />
          </Link>
        </div>

        <div className="flex flex-[3] justify-center">
          {totalChapters > 0 ? (
            <ChapterPicker
              bookId={bookId}
              chapterNumber={chapterNumber}
              totalChapters={totalChapters}
              completedChapterNumbers={completedChapterNumbers}
              groupId={groupId}
            />
          ) : (
            <span className="font-serif text-2xl font-bold text-[var(--text-primary)]">
              Chapter {chapterNumber}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col items-end">
          {totalChapters > 0 && (
            <span className="mb-1 whitespace-nowrap text-xs text-[var(--text-secondary)] tabular-nums">
              {fromPercent}% → {toPercent}%
            </span>
          )}
          <div className="h-2 w-16 overflow-hidden rounded-full bg-[var(--border-main)]">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{
                width: `${animatedPercent}%`,
                backgroundColor: accentColor ?? 'var(--success)',
              }}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
