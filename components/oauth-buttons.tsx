'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { currentRedirectTarget } from '@/lib/pending-redirect'
import { Button } from '@/components/ui/button'

const LABELS = {
  google: 'Google',
  apple: 'Apple',
} as const

export type OAuthProvider = keyof typeof LABELS

/**
 * The "or continue with" block shared by /signin and /signup.
 *
 * Which providers appear is the caller's choice — sign-in offers both, sign-up
 * offers Google only. Everything else (the redirect handoff, error reporting)
 * is identical on both pages, so it lives here rather than being copied.
 */
export function OAuthButtons({ providers }: { providers: OAuthProvider[] }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<OAuthProvider | null>(null)

  async function start(provider: OAuthProvider) {
    setError(null)
    setPending(provider)

    const supabase = createClient()
    const base =
      process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
      `${window.location.origin}/auth/callback`
    // /auth/callback forwards to `next` once the code is exchanged.
    const callback = new URL(base)
    callback.searchParams.set('next', currentRedirectTarget())

    // On success this redirects away, so nothing after it runs. On failure it
    // resolves with an error and the page just sits there — which is how a
    // provider that's enabled but misconfigured (Apple with no OAuth secret,
    // say) reads as a dead button. Surface it instead of swallowing it.
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback.toString() },
    })
    if (error) {
      setError(`Couldn't continue with ${LABELS[provider]}. ${error.message}`)
      setPending(null)
    }
  }

  return (
    <>
      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--border-main)]" />
        <span className="text-xs text-[var(--text-tertiary)]">
          or continue with
        </span>
        <span className="h-px flex-1 bg-[var(--border-main)]" />
      </div>

      {error && (
        <p className="mb-3 text-sm text-[var(--error)]" role="alert">
          {error}
        </p>
      )}

      <div
        className={`grid gap-3 ${
          providers.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
        }`}
      >
        {providers.map((provider) => (
          <Button
            key={provider}
            variant="outline"
            // A second click would start a competing redirect while the first
            // is still resolving.
            disabled={pending !== null}
            onClick={() => start(provider)}
          >
            {pending === provider ? 'Redirecting...' : LABELS[provider]}
          </Button>
        ))}
      </div>
    </>
  )
}
