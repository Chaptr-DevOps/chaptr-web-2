'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, NotebookPen } from 'lucide-react'
import { BookCover } from '@/components/book-cover'
import {
  chaptersPerWeek,
  daysBetween,
  formatRate,
  scheduleStatus,
} from '@/lib/reading-pace'

export interface ChapterSuccessProps {
  bookId: string
  bookTitle: string
  bookAuthor: string | null
  coverImageUrl: string | null
  chapterNumber: number
  totalChapters: number
  /** Progress before this chapter was logged — the ring animates up from here. */
  fromPercent: number
  /** Progress after, straight from the server's `progressPercentage`. */
  toPercent: number
  noteCount: number
  isFinalChapter: boolean
  completionTargetDate: string | null
  startedAt: string | null
  /** Every completion timestamp for this book, including the one just logged. */
  completionDates: string[]
  accentColor: string | null
}

interface Tile {
  key: string
  value: string
  label: string
  tone?: 'success' | 'warning'
}

const RADIUS = 62
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ChapterSuccess(props: ChapterSuccessProps) {
  const {
    bookId,
    bookTitle,
    chapterNumber,
    totalChapters,
    fromPercent,
    toPercent,
    noteCount,
    isFinalChapter,
  } = props

  const accent = props.accentColor || 'var(--interactive-primary)'

  // The ring paints at the pre-completion value on its first frame, then flips
  // to the new one — the CSS transition does the rest. Without the double
  // render there is nothing to transition FROM and the ring just appears full.
  const [ringPercent, setRingPercent] = useState(fromPercent)
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setRingPercent(toPercent))
    return () => window.cancelAnimationFrame(id)
  }, [toPercent])

  const remaining = Math.max(0, totalChapters - chapterNumber)
  const pace = chaptersPerWeek(props.completionDates)
  const schedule = scheduleStatus({
    targetDate: props.completionTargetDate,
    chaptersRemaining: remaining,
    pace,
  })
  const days = daysBetween(props.startedAt)

  const tiles: Tile[] = []

  if (isFinalChapter) {
    if (totalChapters > 0) {
      tiles.push({ key: 'chapters', value: String(totalChapters), label: 'chapters' })
    }
    if (days !== null) {
      tiles.push({ key: 'days', value: String(days), label: days === 1 ? 'day' : 'days' })
    }
    tiles.push({
      key: 'notes',
      value: String(noteCount),
      label: noteCount === 1 ? 'note' : 'notes',
    })
  } else {
    tiles.push(
      totalChapters > 0
        ? { key: 'left', value: String(remaining), label: remaining === 1 ? 'chapter left' : 'chapters left' }
        : { key: 'pct', value: `${toPercent}%`, label: 'complete' },
    )

    if (schedule) {
      const label =
        schedule.state === 'on-track'
          ? 'on track'
          : schedule.state === 'past-due'
            ? 'past due'
            : schedule.state === 'done'
              ? 'target met'
              : schedule.requiredPerWeek !== null
                ? `${formatRate(schedule.requiredPerWeek)}/wk needed`
                : 'target date'
      tiles.push({
        key: 'target',
        value: schedule.label,
        label,
        tone:
          schedule.state === 'on-track' || schedule.state === 'done'
            ? 'success'
            : schedule.state === 'past-due'
              ? 'warning'
              : undefined,
      })
    }

    if (pace !== null) {
      tiles.push({ key: 'pace', value: formatRate(pace), label: 'chapters/week' })
    }
  }

  return (
    <div className="chaptr-success flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
      {isFinalChapter ? (
        <div className="chaptr-rise relative w-28" style={{ animationDelay: '0ms' }}>
          <BookCover
            title={bookTitle}
            author={props.bookAuthor}
            src={props.coverImageUrl}
            className="shadow-xl"
          />
          <span
            className="absolute -bottom-3 -right-3 flex h-11 w-11 items-center justify-center rounded-full border-4 border-background shadow-lg"
            style={{ backgroundColor: accent }}
          >
            <Check className="h-5 w-5 text-primary-foreground" strokeWidth={3} />
          </span>
        </div>
      ) : (
        <div className="chaptr-rise relative h-[148px] w-[148px]" style={{ animationDelay: '0ms' }}>
          <svg viewBox="0 0 148 148" className="h-full w-full -rotate-90">
            <circle
              cx="74"
              cy="74"
              r={RADIUS}
              fill="none"
              strokeWidth="10"
              className="stroke-[var(--surface-elevated)]"
            />
            <circle
              cx="74"
              cy="74"
              r={RADIUS}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              stroke={accent}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - ringPercent / 100)}
              className="transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="mb-1 flex h-7 w-7 items-center justify-center rounded-full"
              style={{ backgroundColor: accent }}
            >
              <Check className="h-4 w-4 text-primary-foreground" strokeWidth={3} />
            </span>
            <span className="font-serif text-3xl font-bold leading-none text-[var(--text-primary)]">
              {toPercent}%
            </span>
            <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
              complete
            </span>
          </div>
        </div>
      )}

      <h2
        className="chaptr-rise mt-6 font-serif text-[26px] font-bold leading-tight text-[var(--text-primary)]"
        style={{ animationDelay: '80ms' }}
      >
        {isFinalChapter ? `You finished ${bookTitle}` : `Chapter ${chapterNumber} complete`}
      </h2>
      <p
        className="chaptr-rise mt-1 text-sm text-[var(--text-secondary)]"
        style={{ animationDelay: '140ms' }}
      >
        {isFinalChapter
          ? 'Every chapter logged. That one is yours.'
          : totalChapters > 0
            ? `${bookTitle} · ${chapterNumber} of ${totalChapters}`
            : bookTitle}
      </p>

      {tiles.length > 0 && (
        <div
          className="chaptr-rise mt-7 grid w-full max-w-sm gap-2"
          style={{
            animationDelay: '200ms',
            gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))`,
          }}
        >
          {tiles.map((tile) => (
            <div
              key={tile.key}
              className="rounded-xl border border-[var(--border-main)] bg-[var(--surface)] px-2 py-3"
            >
              <p className="font-serif text-xl font-bold leading-none text-[var(--text-primary)]">
                {tile.value}
              </p>
              <p
                className={`mt-1.5 text-[11px] leading-tight ${
                  tile.tone === 'success'
                    ? 'font-medium text-[var(--success)]'
                    : tile.tone === 'warning'
                      ? 'font-medium text-[var(--warning)]'
                      : 'text-[var(--text-tertiary)]'
                }`}
              >
                {tile.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {!isFinalChapter && noteCount > 0 && (
        <Link
          href={`/library/notes/${bookId}`}
          className="chaptr-rise mt-5 inline-flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
          style={{ animationDelay: '260ms' }}
        >
          <NotebookPen className="h-3.5 w-3.5" />
          {noteCount} note{noteCount === 1 ? '' : 's'} saved to your library
        </Link>
      )}

      <Link
        href="/home"
        className="chaptr-rise mt-8 flex w-full max-w-sm items-center justify-center rounded-xl bg-primary py-4 text-[15px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        style={{ animationDelay: '320ms' }}
      >
        {isFinalChapter ? 'Back to home' : 'Continue'}
      </Link>

      {/* `global`, not scoped: styled-jsx only stamps its scoping class onto DOM
          elements, so a plain `<style jsx>` rule would never reach the `<Link>`s
          below. Every selector is nested under .chaptr-success to keep it
          contained to this screen. */}
      <style jsx global>{`
        .chaptr-success .chaptr-rise {
          animation: chaptr-rise 480ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes chaptr-rise {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .chaptr-success .chaptr-rise {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
