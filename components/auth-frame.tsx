import { BookOpen } from 'lucide-react'

export function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh w-full">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-primary p-12 text-[var(--interactive-primary-foreground)] lg:flex">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="font-serif text-3xl tracking-[-0.5px]">Chaptr</span>
        </div>
        <div>
          <h2 className="font-serif text-[40px] leading-[44px] tracking-[-1px] text-balance">
            Read together, one chapter at a time.
          </h2>
          <p className="mt-4 max-w-md text-[17px] leading-relaxed opacity-90 text-pretty">
            Track your progress, log reflections, and join reading groups with
            live chat. Your book club, reimagined.
          </p>
        </div>
        <p className="text-sm opacity-70">
          &copy; {new Date().getFullYear()} Chaptr
        </p>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-[var(--interactive-primary-foreground)]">
                <BookOpen className="h-5 w-5" />
              </span>
              <span className="font-serif text-2xl tracking-[-0.5px]">
                Chaptr
              </span>
            </div>
          </div>
          <h1 className="font-serif text-[34px] leading-10 tracking-[-0.7px] text-[var(--text-primary)]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-[15px] text-[var(--text-secondary)]">
              {subtitle}
            </p>
          )}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
