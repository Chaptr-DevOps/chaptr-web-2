'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  currentRedirectTarget,
  withRedirectParam,
} from '@/lib/pending-redirect'
import { AuthFrame } from '@/components/auth-frame'
import { OAuthButtons } from '@/components/oauth-buttons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Carry the destination across to /signup, otherwise a new user who came from
  // an invite link loses it the moment they click "Sign up".
  const [signupHref, setSignupHref] = useState('/signup')

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('redirect')
    setSignupHref(withRedirectParam('/signup', requested))
  }, [])

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
    // A document navigation, not router.push() + router.refresh(). Those two
    // raced: refresh re-fetches the *current* route, and firing it before the
    // push committed re-rendered the sign-in page and discarded the
    // navigation — the form appeared to submit, then nothing happened. It also
    // guarantees the server sees the session cookie that was just set and
    // renders the destination fresh, rather than replaying a payload the
    // router cached while the visitor was logged out.
    window.location.assign(currentRedirectTarget())
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

      <OAuthButtons providers={['google', 'apple']} />

      <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
        New to Chaptr?{' '}
        <Link href={signupHref} className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthFrame>
  )
}
