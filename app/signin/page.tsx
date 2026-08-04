'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthFrame } from '@/components/auth-frame'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Where to land after signing in. Pages that need the user back afterwards —
 * notably a group's subscribe page — link here with `?redirect=/some/path`.
 * Only same-origin paths are honoured, so the parameter can't be used to bounce
 * someone to an external site.
 */
function redirectTarget(): string {
  if (typeof window === 'undefined') return '/home'
  const requested = new URLSearchParams(window.location.search).get('redirect')
  if (requested && requested.startsWith('/') && !requested.startsWith('//')) {
    return requested
  }
  return '/home'
}

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push(redirectTarget())
    router.refresh()
  }

  async function oauth(provider: 'google' | 'apple') {
    const supabase = createClient()
    const base =
      process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
      `${window.location.origin}/auth/callback`
    // /auth/callback forwards to `next` once the code is exchanged.
    const callback = new URL(base)
    callback.searchParams.set('next', redirectTarget())

    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback.toString() },
    })
  }

  return (
    <AuthFrame title="Welcome back" subtitle="Sign in to keep reading.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
          />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p className="text-sm text-[var(--error)]" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--border-main)]" />
        <span className="text-xs text-[var(--text-tertiary)]">
          or continue with
        </span>
        <span className="h-px flex-1 bg-[var(--border-main)]" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => oauth('google')}>
          Google
        </Button>
        <Button variant="outline" onClick={() => oauth('apple')}>
          Apple
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
        New to Chaptr?{' '}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthFrame>
  )
}
