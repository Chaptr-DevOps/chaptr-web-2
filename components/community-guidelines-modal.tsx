'use client'

import { useEffect } from 'react'
import { Ban, BookOpen, EyeOff, HeartHandshake, Loader2, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Ported verbatim from the mobile CommunityGuidelinesModal so both apps show
 * the same four rules. Shown before joining a public group — accepting is what
 * actually fires the join.
 */
export const GUIDELINES = [
  {
    icon: HeartHandshake,
    title: 'Be respectful',
    description: 'Treat others kindly. No harassment or personal attacks.',
  },
  {
    icon: EyeOff,
    title: 'No spoilers',
    description: "Don't spoil future chapters. Use spoiler tags when needed.",
  },
  {
    icon: BookOpen,
    title: 'Stay on topic',
    description: 'Keep discussions about the book and reading experience.',
  },
  {
    icon: Ban,
    title: 'No hate or unsafe content',
    description: 'No discrimination, hate speech, or explicit content.',
  },
]

export function CommunityGuidelinesModal({
  open,
  onClose,
  onAccept,
  isLoading = false,
  error,
}: {
  open: boolean
  onClose: () => void
  onAccept: () => void
  isLoading?: boolean
  error?: string
}) {
  // Lock the page behind the modal — without this the preview scrolls under it.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose()
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-6 shadow-2xl">
        <div className="relative mb-6 text-center">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close"
            className="absolute right-0 top-0 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="mx-auto mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-8 w-8" />
          </span>
          <h2 className="font-serif text-2xl font-bold text-[var(--text-primary)]">
            Community Guidelines
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Read respectfully. Discuss thoughtfully.
          </p>
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          The Rules (only 4)
        </p>

        <ul className="space-y-4">
          {GUIDELINES.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</p>
                <p className="text-sm text-[var(--text-secondary)]">{description}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-5 border-t border-[var(--border-main)] pt-4 text-center text-xs text-[var(--text-tertiary)]">
          Violations may result in removal or bans.
        </p>

        {error && <p className="mt-3 text-center text-sm text-[var(--error)]">{error}</p>}

        <Button className="mt-5 w-full" onClick={onAccept} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'I agree & join'}
        </Button>
      </div>
    </div>
  )
}
