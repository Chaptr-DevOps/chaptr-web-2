'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus } from 'lucide-react'
import { OnboardingShell } from '@/components/onboarding-shell'
import { Button } from '@/components/ui/button'
import { startReading } from '../actions'

export default function ChapterStep() {
  const router = useRouter()
  const [book, setBook] = useState<{
    id: string
    title: string
    chapters: number | null
  } | null>(null)
  const [chapter, setChapter] = useState(1)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem('onboarding_book')
    if (!raw) {
      router.replace('/onboarding/books')
      return
    }
    setBook(JSON.parse(raw))
  }, [router])

  async function next() {
    if (!book) return
    setSaving(true)
    await startReading(book.id, chapter)
    router.push('/onboarding/genres')
  }

  const max = book?.chapters ?? 99

  return (
    <OnboardingShell
      step="chapter"
      title="Where are you starting?"
      subtitle={
        book
          ? `Pick your current chapter in "${book.title}".`
          : 'Loading your book...'
      }
    >
      <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] py-10">
        <span className="text-sm font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
          Chapter
        </span>
        <div className="mt-4 flex items-center gap-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setChapter((c) => Math.max(0, c - 1))}
            aria-label="Decrease chapter"
          >
            <Minus className="h-5 w-5" />
          </Button>
          <span className="font-serif text-[64px] leading-none tracking-[-2px] text-[var(--text-primary)]">
            {chapter}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setChapter((c) => Math.min(max, c + 1))}
            aria-label="Increase chapter"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
        <p className="mt-4 text-sm text-[var(--text-tertiary)]">
          {chapter === 0 ? 'Starting fresh' : `Currently on chapter ${chapter}`}
        </p>
      </div>

      <div className="mt-auto pt-8">
        <Button size="lg" className="w-full" onClick={next} disabled={saving}>
          {saving ? 'Saving...' : 'Continue'}
        </Button>
      </div>
    </OnboardingShell>
  )
}
