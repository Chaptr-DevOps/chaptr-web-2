'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2 } from 'lucide-react'
import { OnboardingShell } from '@/components/onboarding-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { checkUsername, saveUsername } from '../actions'

export default function UsernameStep() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [status, setStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!username) {
      setStatus('idle')
      return
    }
    setStatus('checking')
    const t = setTimeout(async () => {
      const res = await checkUsername(username)
      if (res.available) setStatus('available')
      else setStatus(res.reason === 'taken' ? 'taken' : 'invalid')
    }, 400)
    return () => clearTimeout(t)
  }, [username])

  async function next() {
    if (status !== 'available') return
    setSaving(true)
    const { error } = await saveUsername(username)
    if (error) {
      setSaving(false)
      return
    }
    router.push('/onboarding/books')
  }

  return (
    <OnboardingShell
      step="username"
      title="Pick a username"
      subtitle="This is how other readers will find you."
    >
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-[var(--text-tertiary)]">
          @
        </span>
        <Input
          value={username}
          onChange={(e) =>
            setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))
          }
          placeholder="janereader"
          className="pl-8 pr-10"
          autoFocus
          maxLength={20}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2">
          {status === 'checking' && (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
          )}
          {status === 'available' && (
            <Check className="h-4 w-4 text-[var(--success)]" />
          )}
          {(status === 'taken' || status === 'invalid') && (
            <X className="h-4 w-4 text-[var(--error)]" />
          )}
        </span>
      </div>
      <p className="mt-2 text-sm text-[var(--text-tertiary)]">
        {status === 'taken'
          ? 'That username is taken.'
          : status === 'invalid'
            ? '3–20 characters, letters, numbers, and underscores.'
            : status === 'available'
              ? 'Available!'
              : '3–20 characters.'}
      </p>

      <div className="mt-auto pt-8">
        <Button
          size="lg"
          className="w-full"
          disabled={status !== 'available' || saving}
          onClick={next}
        >
          {saving ? 'Saving...' : 'Continue'}
        </Button>
      </div>
    </OnboardingShell>
  )
}
