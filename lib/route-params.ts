/**
 * Guards for dynamic route params that get used as database ids.
 *
 * Every `[groupId]`, `[bookId]`, `[channelId]`, `[discussionId]` and `[userId]`
 * segment ends up in a `.eq('id', …)` against a uuid column. Postgres rejects a
 * malformed uuid with 22P02, which fails the *whole* query rather than
 * returning no rows — so "not found" arrives as an error instead of an empty
 * result, and pages that only destructure `data` silently take an error path
 * they weren't written for. A mistyped or truncated share link is enough to
 * trigger it.
 *
 * Screening the param first turns that back into an ordinary "no such record",
 * and saves a pointless round trip.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Accepts any RFC 4122 shape, deliberately not checking version/variant nibbles
 * — the point is "Postgres will parse this", not "this is a v4 uuid".
 */
export function isUuid(value: string | null | undefined): value is string {
  return !!value && UUID_RE.test(value)
}
