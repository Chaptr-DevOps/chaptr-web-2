import type { ReactNode } from 'react'
import Link from 'next/link'
import { LEGAL } from '@/lib/legal'

const FOOTER_LINKS = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/refunds', label: 'Refund & Cancellation Policy' },
]

/**
 * Shell for the public, signed-out-accessible policy pages. Kept deliberately
 * plain: these exist to be read (by users and by Stripe's reviewers), not to
 * be marketed at.
 */
export function LegalPage({
  title,
  intro,
  showEffectiveDate = true,
  children,
}: {
  title: string
  intro?: string
  showEffectiveDate?: boolean
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border-main)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 md:px-8">
          <Link
            href="/"
            className="font-serif text-lg font-bold text-[var(--text-primary)]"
          >
            {LEGAL.productName}
          </Link>
          <Link href="/signin" className="text-sm font-medium text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
        <h1 className="font-serif text-3xl font-bold tracking-[-0.4px] text-[var(--text-primary)] md:text-4xl">
          {title}
        </h1>
        {showEffectiveDate && (
          <p className="mt-2 text-sm text-[var(--text-tertiary)]">
            Effective {LEGAL.effectiveDate}
          </p>
        )}
        {intro && (
          <p className="mt-5 text-[15px] leading-relaxed text-[var(--text-secondary)]">
            {intro}
          </p>
        )}
        <div className="mt-8 space-y-8">{children}</div>
      </main>

      <footer className="border-t border-[var(--border-main)]">
        <div className="mx-auto max-w-3xl space-y-3 px-5 py-8 text-center md:px-8">
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
            {FOOTER_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-primary hover:underline">
                {l.label}
              </Link>
            ))}
          </nav>
          <p className="text-xs text-[var(--text-tertiary)]">
            {LEGAL.entityName} · Support:{' '}
            <a href={`mailto:${LEGAL.supportEmail}`} className="hover:underline">
              {LEGAL.supportEmail}
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}

/** A titled block of policy prose. */
export function LegalSection({
  heading,
  children,
}: {
  heading: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-xl font-bold text-[var(--text-primary)]">
        {heading}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-[var(--text-secondary)] [&_a]:text-primary [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-[var(--text-primary)]">
        {children}
      </div>
    </section>
  )
}
