import { BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = ['username', 'books', 'chapter', 'genres', 'jump-in']

export function OnboardingShell({
  step,
  title,
  subtitle,
  children,
}: {
  step: (typeof STEPS)[number]
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  const idx = STEPS.indexOf(step)
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col px-6 py-10">
      <div className="mb-8 flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-[var(--interactive-primary-foreground)]">
          <BookOpen className="h-5 w-5" />
        </span>
        <span className="font-serif text-2xl tracking-[-0.5px]">Chaptr</span>
      </div>

      <div className="mb-8 flex gap-1.5">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i <= idx ? 'bg-primary' : 'bg-[var(--border-main)]',
            )}
          />
        ))}
      </div>

      <h1 className="font-serif text-[34px] leading-10 tracking-[-0.7px] text-balance text-[var(--text-primary)]">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-[17px] leading-relaxed text-[var(--text-secondary)]">
          {subtitle}
        </p>
      )}
      <div className="mt-8 flex flex-1 flex-col">{children}</div>
    </div>
  )
}
