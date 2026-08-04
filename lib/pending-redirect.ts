/**
 * Where a user was headed before auth interrupted them.
 *
 * Signing *in* can carry the destination in `?redirect=` and act on it
 * immediately. Signing *up* can't: the new account is dropped into onboarding
 * (username → books → chapter → genres → goal → jump-in), and threading a query
 * param through six steps is fragile. Instead the destination is parked here at
 * signup and consumed by the final onboarding step — the same mechanism
 * onboarding already uses for `onboarding_book`.
 *
 * localStorage rather than sessionStorage so the destination survives a user
 * abandoning onboarding and returning later, or finishing in a different tab
 * after clicking a confirmation link in their email. That durability is the
 * whole point, but it's also why entries expire: a month-old invite shouldn't
 * silently hijack an unrelated signup.
 */

const KEY = 'pending_redirect'

/** Long enough to survive email confirmation and a night's sleep. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000

type Stored = { path: string; ts: number }

/**
 * Only same-origin absolute paths are honoured. `//evil.com` is a
 * protocol-relative URL that browsers treat as external, so it's rejected
 * explicitly — this is the same rule /signin applies to its `?redirect=` param.
 */
export function isSafeRedirect(path: string | null | undefined): path is string {
  return !!path && path.startsWith('/') && !path.startsWith('//')
}

/** Park a destination for after onboarding. No-ops on anything unsafe. */
export function setPendingRedirect(path: string | null | undefined) {
  if (typeof window === 'undefined' || !isSafeRedirect(path)) return
  try {
    const entry: Stored = { path, ts: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(entry))
  } catch {
    // Private browsing and storage-quota failures are not worth breaking
    // signup over; the user just lands on /home instead.
  }
}

/**
 * Read and clear. Consumed once — if onboarding is restarted the user goes to
 * /home rather than being sent somewhere they've already been taken. Entries
 * older than MAX_AGE_MS, malformed entries, and anything failing the
 * same-origin rule are all discarded.
 */
export function takePendingRedirect(): string | null {
  if (typeof window === 'undefined') return null
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
    localStorage.removeItem(KEY)
  } catch {
    return null
  }
  if (!raw) return null

  let entry: Stored
  try {
    entry = JSON.parse(raw) as Stored
  } catch {
    return null
  }
  if (typeof entry?.ts !== 'number' || Date.now() - entry.ts > MAX_AGE_MS) {
    return null
  }
  return isSafeRedirect(entry.path) ? entry.path : null
}

/** Build an auth-page href that carries the current `?redirect=` onward. */
export function withRedirectParam(href: string, redirect: string | null): string {
  return isSafeRedirect(redirect)
    ? `${href}?redirect=${encodeURIComponent(redirect)}`
    : href
}
