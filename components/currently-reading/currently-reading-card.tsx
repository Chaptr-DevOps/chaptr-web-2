'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bookmark, Calendar, Flag, Users } from 'lucide-react'
import { BookCover } from '@/components/book-cover'
import { Avatar } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import type { Book, ReadingProgress } from '@/lib/types'
import { shelveBook } from '@/app/(app)/home/actions'
import { SetPaceModal } from './set-pace-modal'
import { RecapModal } from './recap-modal'
import { UpdateChaptersModal } from './update-chapters-modal'

export interface ReadingWithUser {
  userId: string
  name: string
  avatarUrl: string | null
}

export interface CurrentlyReadingCardData {
  progress: ReadingProgress
  book: Book
  groupName: string | null
  readingWith: ReadingWithUser[]
  meanCompletedChapters: number | null
  lastNote: { content: string; createdAt: string } | null
  currentUser: { id: string; name: string; avatarUrl: string | null }
}

function formatTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function CurrentlyReadingCard({ data }: { data: CurrentlyReadingCardData }) {
  const { progress, book, groupName, readingWith, meanCompletedChapters, lastNote, currentUser } = data
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [showPace, setShowPace] = useState(false)
  const [showRecap, setShowRecap] = useState(false)
  const [showUpdateChapters, setShowUpdateChapters] = useState(false)
  const [showOverdueCountdown, setShowOverdueCountdown] = useState(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const totalChapters = progress.total_chapters ?? book.total_chapters ?? 9
  const completedChapters = progress.completed_chapters ?? Math.max(0, progress.current_chapter - 1)
  const deadlines = useMemo(() => progress.chapter_deadlines ?? [], [progress.chapter_deadlines])

  const nextDeadline = useMemo(() => {
    return [...deadlines]
      .filter((d) => d.chapter_number > completedChapters)
      .sort((a, b) => new Date(a.deadline_at).getTime() - new Date(b.deadline_at).getTime())[0] ?? null
  }, [deadlines, completedChapters])

  const goalChapter = useMemo(() => {
    const passed = deadlines.filter((d) => new Date(d.deadline_at) <= now)
    return passed.length ? Math.max(...passed.map((d) => d.chapter_number)) : 0
  }, [deadlines, now])

  const hoursRemaining = nextDeadline
    ? (new Date(nextDeadline.deadline_at).getTime() - now.getTime()) / 3_600_000
    : null

  const userPosition = totalChapters ? Math.min(100, (completedChapters / totalChapters) * 100) : 0
  const groupPosition =
    meanCompletedChapters != null && totalChapters
      ? Math.min(100, (meanCompletedChapters / totalChapters) * 100)
      : null
  const goalPosition = totalChapters ? Math.min(100, (goalChapter / totalChapters) * 100) : 0
  const isGoalMerged = deadlines.length > 0 && completedChapters >= goalChapter
  const isAvgMerged = meanCompletedChapters != null && completedChapters === meanCompletedChapters

  function handleShelve() {
    if (!confirm(`Are you sure you want to shelve "${book.title}"? You can find it later in your Library.`)) {
      return
    }
    startTransition(async () => {
      const res = await shelveBook(progress.id)
      if (res.error) {
        alert(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <>
      <Card className="p-5">
        <div className="mb-4 flex gap-4">
          <div className="w-16 shrink-0">
            <BookCover title={book.title} author={book.author} src={book.cover_image_url} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-serif text-xl tracking-[-0.2px] text-[var(--text-primary)]">
                  {book.title}
                </p>
                <p className="truncate text-sm text-[var(--text-secondary)]">{book.author}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowUpdateChapters(true)}
                className="shrink-0 text-right"
              >
                <div className="flex items-end gap-0.5">
                  <span className="font-serif text-2xl leading-none text-[var(--text-primary)]">
                    {completedChapters}
                  </span>
                  <span className="pb-0.5 text-sm text-[var(--text-tertiary)]">/ {totalChapters}</span>
                </div>
                <p className="mt-0.5 text-[10px] tracking-wide text-[var(--text-tertiary)]">COMPLETED</p>
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-[var(--text-secondary)]">Reading with</span>
              {readingWith.length > 0 ? (
                <div className="flex -space-x-1.5">
                  {readingWith.slice(0, 4).map((u) => (
                    <Avatar
                      key={u.userId}
                      src={u.avatarUrl}
                      name={u.name}
                      size={20}
                      className="border-2 border-[var(--surface)]"
                    />
                  ))}
                </div>
              ) : (
                <span className="text-sm italic text-[var(--text-tertiary)]">Reading solo</span>
              )}
              {groupName && (
                <span className="ml-1 inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                  <Users className="h-3 w-3" /> {groupName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar with You / Avg / Goal markers */}
        <div className="relative mb-8 mt-6">
          <div className="h-3 w-full rounded-full bg-[var(--border-main)]">
            <div
              className="h-3 rounded-full bg-[var(--success)] transition-all"
              style={{ width: `${userPosition}%` }}
            />
          </div>

          <div
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${userPosition}%`, top: -22 }}
          >
            <span className="mb-1 whitespace-nowrap text-[10px] font-semibold text-[var(--text-primary)]">
              {isAvgMerged ? 'You + Avg' : 'You'}
            </span>
            <Avatar src={currentUser.avatarUrl} name={currentUser.name} size={24} className="border-2 border-[var(--surface)]" />
            <span className="mt-1 whitespace-nowrap text-[10px] text-[var(--text-secondary)]">Ch {completedChapters}</span>
          </div>

          {meanCompletedChapters != null && groupPosition != null && !isAvgMerged && (
            <div
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${groupPosition}%`, top: -22 }}
            >
              <span className="mb-1 text-[10px] font-semibold text-[var(--text-primary)]">Avg</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--info)] text-white">
                <Users className="h-3 w-3" />
              </span>
              <span className="mt-1 whitespace-nowrap text-[10px] text-[var(--text-secondary)]">
                Ch {meanCompletedChapters}
              </span>
            </div>
          )}

          {nextDeadline && !isGoalMerged && (
            <div
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${goalPosition}%`, top: -22 }}
            >
              <span className="mb-1 text-[10px] font-semibold text-[var(--text-primary)]">Goal</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--warning)] text-white">
                <Flag className="h-3 w-3" />
              </span>
              <span className="mt-1 whitespace-nowrap text-[10px] text-[var(--text-secondary)]">Ch {goalChapter}</span>
            </div>
          )}
        </div>

        {/* Deadline / pace block */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowPace(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setShowPace(true)
          }}
          className="flex w-full cursor-pointer items-center justify-between rounded-xl py-2 text-left"
        >
          {nextDeadline ? (
            <>
              <div>
                <p
                  className={`text-xs font-semibold ${
                    hoursRemaining !== null && hoursRemaining < 0 ? 'text-[var(--warning)]' : 'text-[var(--success)]'
                  }`}
                >
                  {hoursRemaining !== null && hoursRemaining < 0
                    ? `Chapter ${nextDeadline.chapter_number} Past Due`
                    : `Chapter ${nextDeadline.chapter_number}`}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {new Date(nextDeadline.deadline_at).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  ·{' '}
                  {new Date(nextDeadline.deadline_at).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {progress.completion_target_date
                    ? `Finish Date: ${new Date(progress.completion_target_date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}`
                    : 'Finish Date: Not set'}
                </p>
              </div>
              {hoursRemaining !== null && hoursRemaining < -24 && !showOverdueCountdown ? (
                <div
                  className="flex gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setShowOverdueCountdown(true)}
                    className="rounded-lg border border-[var(--border-main)] bg-[var(--surface-elevated)] px-3 py-2 text-[13px] font-medium text-[var(--text-primary)]"
                  >
                    Catch up
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPace(true)}
                    className="rounded-lg bg-primary px-3 py-2 text-[13px] font-medium text-[var(--interactive-primary-foreground)]"
                  >
                    Reset
                  </button>
                </div>
              ) : (
                <div className="flex items-end gap-3 text-right">
                  {Math.floor(Math.abs(hoursRemaining ?? 0) / 24) > 0 && (
                    <span className="flex flex-col items-center">
                      <span
                        className={`font-serif text-2xl ${hoursRemaining! < 0 ? 'text-[var(--warning)]' : 'text-[var(--text-primary)]'}`}
                      >
                        {hoursRemaining! < 0 ? '-' : ''}
                        {Math.floor(Math.abs(hoursRemaining ?? 0) / 24)}
                      </span>
                      <span className="text-[10px] text-[var(--text-tertiary)]">DAYS</span>
                    </span>
                  )}
                  <span className="flex flex-col items-center">
                    <span
                      className={`font-serif text-2xl ${hoursRemaining! < 0 ? 'text-[var(--warning)]' : 'text-[var(--text-primary)]'}`}
                    >
                      {Math.floor(Math.abs(hoursRemaining ?? 0) % 24)}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">HRS</span>
                  </span>
                  <span className="flex flex-col items-center">
                    <span
                      className={`font-serif text-2xl ${hoursRemaining! < 0 ? 'text-[var(--warning)]' : 'text-[var(--text-primary)]'}`}
                    >
                      {Math.floor((Math.abs(hoursRemaining ?? 0) % 1) * 60)}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">MINS</span>
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Calendar className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Set a Reading Goal</p>
                <p className="text-xs text-[var(--text-secondary)]">Choose a target date to see deadlines</p>
              </div>
            </div>
          )}
        </div>

        {/* Complete chapter + actions */}
        <div className="mt-4 border-t border-[var(--border-main)] pt-4">
          <Link
            href={`/read/${book.id}/chapter/${completedChapters + 1}${
              progress.group_id ? `?group=${progress.group_id}` : ''
            }`}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-main)] bg-[var(--background)] py-4 shadow-sm transition-colors hover:bg-[var(--surface-elevated)]"
          >
            <span className="text-[15px] font-semibold text-[var(--text-primary)]">Complete Chapter</span>
            <span className="relative flex h-7 w-[22px] items-start justify-center rounded-t-sm bg-[var(--error)] pt-1">
              <Bookmark className="pointer-events-none absolute -bottom-1.5 h-3 w-3 fill-[var(--error)] text-[var(--error)]" />
              <span className="text-[11px] font-bold text-white">{completedChapters + 1}</span>
            </span>
          </Link>

          <div className="mt-3 flex items-center justify-center">
            <Link
              href={`/library/notes/${book.id}`}
              className="flex-1 py-2 text-center text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Notes
            </Link>
            <div className="h-4 w-px bg-[var(--border-light,var(--border-main))]" />
            <button
              type="button"
              onClick={() => setShowRecap(true)}
              className="flex-1 py-2 text-center text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Recap
            </button>
            <div className="h-4 w-px bg-[var(--border-light,var(--border-main))]" />
            <button
              type="button"
              disabled={isPending}
              onClick={handleShelve}
              className="flex-1 py-2 text-center text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Shelve
            </button>
          </div>
        </div>
      </Card>

      <SetPaceModal
        open={showPace}
        onClose={() => setShowPace(false)}
        progressId={progress.id}
        currentTargetDate={progress.completion_target_date}
      />
      <RecapModal
        open={showRecap}
        onClose={() => setShowRecap(false)}
        bookId={book.id}
        bookTitle={book.title}
        lastNote={lastNote}
        formatTimeAgo={formatTimeAgo}
      />
      <UpdateChaptersModal
        open={showUpdateChapters}
        onClose={() => setShowUpdateChapters(false)}
        bookId={book.id}
        bookTitle={book.title}
        bookAuthor={book.author}
        coverUrl={book.cover_image_url}
        currentChapters={totalChapters}
      />
    </>
  )
}
