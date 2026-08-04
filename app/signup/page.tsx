'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  setPendingRedirect,
  withRedirectParam,
} from '@/lib/pending-redirect'
import { AuthFrame } from '@/components/auth-frame'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SignUpPage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Read after mount, not during render: window doesn't exist on the server and
  // reading it inline would desync the markup React hydrates against.
  const [signinHref, setSigninHref] = useState('/signin')

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('redirect')
    // Park it now — the flow leaves this page for onboarding, and email
    // confirmation may bounce the user out to their inbox and back first.
    setPendingRedirect(requested)
    setSigninHref(withRedirectParam('/signin', requested))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agree) {
      setError('Please accept the terms to continue.')
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
          `${window.location.origin}/auth/callback`,
        data: { display_name: displayName },
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/onboarding/username')
  }

  return (
    <AuthFrame
      title="Create your account"
      subtitle="Start tracking your reading journey."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Jane Reader"
          />
        </div>
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
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </div>
        <label className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--interactive-primary)]"
          />
          <span>
            I agree to the Terms of Service and Privacy Policy.
          </span>
        </label>
        {error && (
          <p className="text-sm text-[var(--error)]" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
        Already have an account?{' '}
        <Link href={signinHref} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthFrame>
  )
}
