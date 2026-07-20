'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OnboardingShell } from '@/components/onboarding-shell'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GENRES } from '@/lib/types'
import { saveGenres } from '../actions'

export default function GenresStep() {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function toggle(g: string) {
    setSelected((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    )
  }

  async function next() {
    setSaving(true)
    await saveGenres(selected)
    router.push('/onboarding/goal')
  }

  return (
    <OnboardingShell
      step="genres"
      title="What do you love to read?"
      subtitle="Pick a few genres so we can tailor your feed."
    >
      <div className="flex flex-wrap gap-2.5">
        {GENRES.map((g) => {
          const active = selected.includes(g)
          return (
            <button
              key={g}
              type="button"
              onClick={() => toggle(g)}
              className={cn(
                'rounded-full border px-4 py-2 text-[15px] font-medium transition-colors',
                active
                  ? 'border-primary bg-primary text-[var(--interactive-primary-foreground)]'
                  : 'border-[var(--border-main)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-primary/50',
              )}
            >
              {g}
            </button>
          )
        })}
      </div>

      <div className="mt-auto pt-8">
        <Button
          size="lg"
          className="w-full"
          onClick={next}
          disabled={selected.length === 0 || saving}
        >
          {saving ? 'Saving...' : `Continue${selected.length ? ` (${selected.length})` : ''}`}
        </Button>
      </div>
    </OnboardingShell>
  )
}
