/**
 * Semantic colour maps ported from the mobile theme (src/theme/index.ts).
 *
 * These cover the two places mobile hardcodes bg/text/border triplets rather
 * than using a plain status colour: reading-status pills and TBR priority.
 * Everything else should use the CSS tokens in app/globals.css directly.
 */

/**
 * Reading-status pill classes.
 *
 * Mobile's statuses are wantToRead / reading / finished / dnf; this repo's
 * user_books.status is reading | completed | paused | abandoned. Mapped so the
 * same state reads the same colour on both platforms — `paused` is web-only and
 * takes the neutral chip.
 */
export const READING_STATUS_CLASSES: Record<string, string> = {
  want_to_read: 'bg-[var(--success-bg)] text-[var(--success)]',
  reading: 'bg-[var(--success-bg)] text-[var(--success)]',
  completed: 'bg-[var(--warning-bg)] text-[var(--warning)]',
  abandoned: 'bg-[var(--error-bg)] text-[var(--error)]',
  paused: 'bg-[var(--priority-normal-bg)] text-[var(--priority-normal-text)]',
}

export function readingStatusClasses(status: string | null | undefined) {
  if (!status) return READING_STATUS_CLASSES.want_to_read
  return READING_STATUS_CLASSES[status] ?? READING_STATUS_CLASSES.want_to_read
}

/** TBR priority chip classes — matches `priority` on mobile. */
export const PRIORITY_CLASSES = {
  overdue: 'bg-[var(--error-bg)] text-[var(--error)] border-[var(--error-border)]',
  dueSoon: 'bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning-border)]',
  normal:
    'bg-[var(--priority-normal-bg)] text-[var(--priority-normal-text)] border-[var(--priority-normal-border)]',
} as const

export type Priority = keyof typeof PRIORITY_CLASSES

/** Same thresholds the mobile TBR list uses. */
export function priorityFromDueDate(dueDate: string | null | undefined): Priority {
  if (!dueDate) return 'normal'
  const days = (new Date(dueDate).getTime() - Date.now()) / 86_400_000
  if (days < 0) return 'overdue'
  if (days <= 3) return 'dueSoon'
  return 'normal'
}
