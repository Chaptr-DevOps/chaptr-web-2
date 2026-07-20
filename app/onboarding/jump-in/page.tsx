'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PartyPopper } from 'lucide-react'
import { OnboardingShell } from '@/components/onboarding-shell'
import { Button } from '@/components/ui/button'
import { completeOnboarding } from '../actions'

export default function JumpInStep() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function jumpIn() {
    setLoading(true)
    await completeOnboarding()
    sessionStorage.removeItem('onboarding_book')
    router.push('/home')
    router.refresh()
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
