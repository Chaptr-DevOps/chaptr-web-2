import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, Check, Hash, Lock, Users } from 'lucide-react'
import { LegalPage, LegalSection } from '@/components/legal-page'
import { LEGAL, PLATFORM_FEE_PERCENT } from '@/lib/legal'

export const metadata: Metadata = {
  title: `Pricing · ${LEGAL.productName}`,
  description: `${LEGAL.productName} is free to use. Some reading groups charge a monthly subscription set by their creator — here's how that works.`,
}

const READER_FEATURES = [
  { icon: BookOpen, text: 'Track your reading, chapter by chapter, across every book' },
  { icon: Hash, text: 'Join free reading groups and their discussion channels' },
  { icon: Users, text: 'Spoiler-safe chat that unlocks as you finish each chapter' },
  { icon: Lock, text: 'Private reading notes, visible only to you' },
]

export default function PricingPage() {
  return (
    <LegalPage
      title="Pricing"
      showEffectiveDate={false}
      intro={`${LEGAL.productName} is free to use. Anyone can track their reading and join free reading groups without paying. Some groups are run as paid communities, and this page explains exactly how that works and what you are charged.`}
    >
      {/* Free tier */}
      <section className="rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          Every account
        </p>
        <p className="mt-1 font-serif text-3xl font-bold text-[var(--text-primary)]">
          Free
        </p>
        <ul className="mt-5 space-y-3">
          {READER_FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
              <span className="text-sm text-[var(--text-primary)]">{text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Paid groups */}
      <section className="rounded-2xl border border-primary/25 bg-primary/5 p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          Paid reading groups
        </p>
        <p className="mt-1 font-serif text-3xl font-bold text-[var(--text-primary)]">
          Set by each creator
          <span className="text-base font-normal text-[var(--text-secondary)]">
            {' '}
            · billed monthly in USD
          </span>
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-secondary)]">
          There is no single platform-wide subscription price. Each paid group
          is run by the person who created it, and they choose their own monthly
          price. That exact price — along with the full billing terms — is shown
          on the group&apos;s subscribe page before you enter any payment
          details.
        </p>
        <ul className="mt-5 space-y-2.5">
          {[
            'Access to the group’s member-only discussion channels',
            'The group’s reading schedule, pace targets and progress tracking',
            'Chapter-by-chapter discussion threads and shared reading list',
            'Renews monthly; cancel any time from the group’s subscribe page',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--success)]/12 text-[var(--success)]">
                <Check className="h-3 w-3" />
              </span>
              <span className="text-sm text-[var(--text-primary)]">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <LegalSection heading="What you are buying">
        <p>
          A paid group subscription is a recurring monthly purchase of digital
          access to an online community: member-only discussion channels, the
          group&apos;s reading schedule, and chapter-gated discussion for the
          book the group is reading. Access is granted immediately on payment.
        </p>
        <p>
          <strong>Books are not included.</strong> {LEGAL.productName} does not
          sell, supply or distribute books. Members read their own copy of
          whatever the group is reading. Nothing physical is shipped.
        </p>
      </LegalSection>

      <LegalSection heading="How billing works">
        <ul className="space-y-2">
          <li>
            You are charged the group&apos;s listed price when you subscribe,
            and on the same date each month after that.
          </li>
          <li>
            All prices are in US dollars. The subscription renews automatically
            until you cancel it.
          </li>
          <li>
            Payments are processed by Stripe. {LEGAL.entityName} never receives
            or stores your card details.
          </li>
          <li>
            Charges appear on your statement under {LEGAL.entityName} or the
            group creator&apos;s business name.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Cancelling">
        <p>
          You can cancel any subscription yourself at any time from that
          group&apos;s subscribe page. Cancelling stops all future charges and
          you keep access until the end of the period you&apos;ve already paid
          for. Payments already made are non-refundable — the full terms are in
          our <Link href="/refunds">Refund &amp; Cancellation Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection heading="For creators">
        <p>
          Creating a group is free, including paid groups. When you charge for a
          group, {LEGAL.entityName} retains a {PLATFORM_FEE_PERCENT}% platform
          fee from each subscription payment; the remainder is paid out to you
          through Stripe, less Stripe&apos;s own processing fees. Payouts
          require connecting a Stripe account and completing Stripe&apos;s
          identity verification. You set and can change your group&apos;s price
          at any time; changes apply to billing periods starting after the
          change.
        </p>
      </LegalSection>

      <LegalSection heading="Questions">
        <p>
          Email <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>{' '}
          and we&apos;ll respond within two business days.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
