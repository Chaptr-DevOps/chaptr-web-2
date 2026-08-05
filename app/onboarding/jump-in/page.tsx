'use client'

import { useState } from 'react'
import { PartyPopper } from 'lucide-react'
import { OnboardingShell } from '@/components/onboarding-shell'
import { Button } from '@/components/ui/button'
import { completeOnboarding } from '../actions'
import { takePendingRedirect } from '@/lib/pending-redirect'

export default function JumpInStep() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function jumpIn() {
    setLoading(true)
    setError(null)
    try {
      const result = await completeOnboarding()
      if (result?.error) {
        // Don't strand the user on a dead button: say what went wrong and let
        // them retry. Previously this error was discarded.
        setError(result.error)
        return
      }
      sessionStorage.removeItem('onboarding_book')
      // A user who arrived from an invite link finishes onboarding at the group
      // that invited them, not on a generic home feed.
      const destination = takePendingRedirect() ?? '/home'
      // A full navigation, not router.push(). This was `push()` immediately
      // followed by `refresh()`, and the two raced: refresh re-fetched the
      // *current* route before the push committed, so the user was re-rendered
      // back onto this page — the button appeared to work, then nothing
      // happened. A document navigation also guarantees the app shell renders
      // with the just-completed profile instead of a cached logged-out payload.
      window.location.assign(destination)
      return
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      // Always clear it. This button is the last gate before the app, so a
      // spinner that never resets locks the user out of the product entirely —
      // which is exactly what happened when a navigation failed to complete.
      setLoading(false)
    }
  }

  return (
    <OnboardingShell step="jump-in" title="">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/12 text-primary">
          <PartyPopper className="h-9 w-9" />
        </span>
        <h1 className="font-serif text-[40px] leading-[44px] tracking-[-1px] text-balance text-[var(--text-primary)]">
          You&apos;re all set!
        </h1>
        <p className="mt-3 max-w-sm text-[17px] leading-relaxed text-[var(--text-secondary)] text-pretty">
          Your shelf is ready. Log chapters, join reading groups, and keep your
          notes all in one place.
        </p>
        {error && (
          <p className="mt-6 text-sm text-[var(--error)]" role="alert">
            {error}
          </p>
        )}
        <Button
          size="lg"
          className="mt-8 w-full max-w-xs"
          onClick={jumpIn}
          disabled={loading}
        >
          {loading ? 'Getting ready...' : 'Jump in'}
        </Button>
      </div>
    </OnboardingShell>
  )
}
