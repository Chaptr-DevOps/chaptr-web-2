'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OnboardingShell } from '@/components/onboarding-shell'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { saveGoal } from '../actions'

const PACES = [
  { key: 'casual', label: 'Casual', desc: '~50 pages / week', pages: 50 },
  { key: 'steady', label: 'Steady', desc: '~150 pages / week', pages: 150 },
  { key: 'avid', label: 'Avid', desc: '~300 pages / week', pages: 300 },
  { key: 'voracious', label: 'Voracious', desc: '~500 pages / week', pages: 500 },
]

export default function GoalStep() {
  const router = useRouter()
  const [pace, setPace] = useState<string>('steady')
  const [saving, setSaving] = useState(false)

  async function next() {
    setSaving(true)
    const chosen = PACES.find((p) => p.key === pace)!
    await saveGoal(chosen.key, chosen.pages)
    router.push('/onboarding/jump-in')
  }

  return (
    <OnboardingShell
      step="goal"
      title="Set your reading pace"
      subtitle="Don't worry, you can change this anytime."
    >
      <div className="flex flex-col gap-3">
        {PACES.map((p) => {
          const active = pace === p.key
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setPace(p.key)}
              className={cn(
                'flex items-center justify-between rounded-xl border p-4 text-left transition-colors',
                active
                  ? 'border-primary bg-primary/8'
                  : 'border-[var(--border-main)] bg-[var(--surface)] hover:border-primary/40',
              )}
            >
              <div>
                <p className="text-[17px] font-semibold text-[var(--text-primary)]">
                  {p.label}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">{p.desc}</p>
              </div>
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full border-2',
                  active
                    ? 'border-primary'
                    : 'border-[var(--border-main)]',
                )}
              >
                {active && (
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                )}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-auto pt-8">
        <Button size="lg" className="w-full" onClick={next} disabled={saving}>
          {saving ? 'Saving...' : 'Continue'}
        </Button>
      </div>
    </OnboardingShell>
  )
}
