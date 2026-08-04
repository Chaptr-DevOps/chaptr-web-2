/**
 * Pace + schedule math for the chapter success screen.
 *
 * Kept out of the component deliberately: these are pure functions over
 * timestamps, and the edge cases (a reader two days into a book, a target date
 * already past) are much easier to reason about without React in the way.
 */

const DAY_MS = 86_400_000
const PACE_WINDOW_DAYS = 14

/**
 * A reader who logged their first two chapters an hour apart is not reading
 * 336 chapters a week. Divide by at least this many days so a short history
 * cannot produce an absurd rate.
 */
const MIN_PACE_WINDOW_DAYS = 3

/** Below this, a "pace" is noise rather than a signal — show nothing instead. */
const MIN_COMPLETIONS_FOR_PACE = 2

/** `completion_target_date` is a Postgres `date`, so it has no time or zone.
 *  `new Date('2026-09-14')` parses as UTC midnight, which renders as the 13th
 *  anywhere west of Greenwich. Build a LOCAL date instead. */
export function parseDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Chapters per week over the trailing two weeks.
 *
 * The window shrinks to fit a short history (see MIN_PACE_WINDOW_DAYS) so a
 * reader three days in gets a rate computed over three days, not over fourteen
 * days that mostly predate the book.
 *
 * Returns null when there isn't enough history to say anything honest.
 */
export function chaptersPerWeek(
  completedAt: readonly string[],
  now: number = Date.now(),
): number | null {
  const times = completedAt
    .map((t) => new Date(t).getTime())
    .filter((t) => Number.isFinite(t) && t <= now)
    .sort((a, b) => a - b)

  if (times.length < MIN_COMPLETIONS_FOR_PACE) return null

  const cutoff = now - PACE_WINDOW_DAYS * DAY_MS
  const inWindow = times.filter((t) => t >= cutoff)
  if (inWindow.length < MIN_COMPLETIONS_FOR_PACE) return null

  const windowStart = Math.max(cutoff, inWindow[0])
  const spanDays = Math.max(MIN_PACE_WINDOW_DAYS, (now - windowStart) / DAY_MS)
  const perWeek = (inWindow.length / spanDays) * 7

  return Math.round(perWeek * 10) / 10
}

export type ScheduleState = 'on-track' | 'behind' | 'past-due' | 'done'

export interface ScheduleStatus {
  /** Localized target date, e.g. "Sep 14". */
  label: string
  state: ScheduleState
  /** Chapters/week needed from today to hit the target. Null when not meaningful. */
  requiredPerWeek: number | null
}

/**
 * How the reader stands against their own completion target.
 *
 * `pace` is the output of chaptersPerWeek — null means we can't judge, in which
 * case we report the requirement without labelling them behind. Nobody should
 * be told they're failing on the strength of one data point.
 */
export function scheduleStatus({
  targetDate,
  chaptersRemaining,
  pace,
  now = Date.now(),
}: {
  targetDate: string | null
  chaptersRemaining: number
  pace: number | null
  now?: number
}): ScheduleStatus | null {
  if (!targetDate) return null
  const target = parseDateOnly(targetDate)
  if (!target) return null

  const label = target.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })

  if (chaptersRemaining <= 0) return { label, state: 'done', requiredPerWeek: null }

  // End of the target day, not its midnight — a book due "Sep 14" is not late
  // at 00:01 on the 14th.
  const deadline = target.getTime() + DAY_MS
  const daysLeft = (deadline - now) / DAY_MS
  if (daysLeft <= 0) return { label, state: 'past-due', requiredPerWeek: null }

  const requiredPerWeek = Math.round((chaptersRemaining / (daysLeft / 7)) * 10) / 10
  const state: ScheduleState =
    pace === null ? 'behind' : pace + 0.05 >= requiredPerWeek ? 'on-track' : 'behind'

  return { label, state, requiredPerWeek }
}

/** Whole days between two instants, floored at 1 so "started today" reads as 1 day. */
export function daysBetween(from: string | null, to: number = Date.now()): number | null {
  if (!from) return null
  const start = new Date(from).getTime()
  if (!Number.isFinite(start) || start > to) return null
  return Math.max(1, Math.round((to - start) / DAY_MS))
}

/** 3 → "3", 3.5 → "3.5". Trailing ".0" reads like false precision. */
export function formatRate(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
