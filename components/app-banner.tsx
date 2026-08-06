'use client'

import { useEffect, useState } from 'react'
import { Smartphone, X } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

/**
 * Points at the App Store listing for `ascAppId` 6757249311 (eas.json in the
 * RN repo). The listing 404s until Apple approves the release — this is the
 * one place to change if it needs to point somewhere else in the meantime.
 */
const APP_STORE_URL = 'https://apps.apple.com/app/id6757249311'

const DISMISS_KEY = 'ios_app_banner_dismissed'

/**
 * "Chaptr is better in the app" bar across the top of the content column.
 *
 * Dismissal persists in localStorage rather than session storage: someone who
 * has said no once shouldn't be asked again on every visit.
 */
export function AppBanner() {
  // Starts hidden and is decided after mount. localStorage doesn't exist on
  // the server, so reading it during render would desync the markup React
  // hydrates against — the same reason the auth pages read `?redirect=` in an
  // effect. The cost is that the bar appears a frame late; the alternative is
  // flashing it at people who already dismissed it.
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(DISMISS_KEY) !== '1')
    } catch {
      // Private browsing: showing it is the better failure.
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  function dismiss() {
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Nothing to do — it reappears next visit, which beats breaking the click.
    }
  }

  return (
    <div className="border-b border-[var(--border-main)] bg-primary/8">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Smartphone className="hidden h-5 w-5 shrink-0 text-primary sm:block" />

        <p className="min-w-0 flex-1 text-sm text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">
            Chaptr is better in the app.
          </span>{' '}
          <span className="hidden sm:inline">
            Track your reading and keep up with your groups on iOS.
          </span>
        </p>

        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ size: 'sm' })}
        >
          Get the app
        </a>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="rounded-lg p-2 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
