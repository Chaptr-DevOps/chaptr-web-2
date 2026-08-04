/**
 * Where a user was headed before auth interrupted them.
 *
 * Signing *in* can carry the destination in `?redirect=` and act on it
 * immediately. Signing *up* can't: the new account is dropped into onboarding
 * (username → books → chapter → genres → goal → jump-in), and threading a query
 * param through six steps is fragile. Instead the destination is parked in
 * sessionStorage at signup and consumed by the final onboarding step — the same
 * mechanism onboarding already uses for `onboarding_book`.
 *
 * sessionStorage rather than localStorage so it dies with the tab: a stale
 * destination from last week shouldn't hijack a later signup.
 */

const KEY = 'pending_redirect'

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
  sessionStorage.setItem(KEY, path)
}

/**
 * Read and clear. Consumed once — if onboarding is restarted the user goes to
 * /home rather than being sent somewhere they've already been taken.
 */
export function takePendingRedirect(): string | null {
  if (typeof window === 'undefined') return null
  const stored = sessionStorage.getItem(KEY)
  sessionStorage.removeItem(KEY)
  return isSafeRedirect(stored) ? stored : null
}

/** Build an auth-page href that carries the current `?redirect=` onward. */
export function withRedirectParam(href: string, redirect: string | null): string {
  return isSafeRedirect(redirect)
    ? `${href}?redirect=${encodeURIComponent(redirect)}`
    : href
}
