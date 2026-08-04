import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, LegalSection } from '@/components/legal-page'
import { LEGAL, PLATFORM_FEE_PERCENT } from '@/lib/legal'

export const metadata: Metadata = {
  title: `Terms of Service · ${LEGAL.productName}`,
  description: `The terms governing use of ${LEGAL.productName}, including paid reading group subscriptions.`,
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={`These terms govern your use of ${LEGAL.productName} (the “Service”), operated by ${LEGAL.entityName}. By creating an account or subscribing to a reading group, you agree to them.`}
    >
      <LegalSection heading="1. The Service">
        <p>
          {LEGAL.productName} is a reading application. Members track reading
          progress, keep private notes, and join reading groups — book clubs
          with discussion channels that unlock as members finish chapters, so
          conversation stays free of spoilers. Some groups are free; others
          require a paid monthly subscription set by the person who created the
          group.
        </p>
      </LegalSection>

      <LegalSection heading="2. Accounts">
        <p>
          You must provide accurate information when registering and are
          responsible for activity under your account and for keeping your
          credentials secure. You must be at least 13 years old, or the minimum
          age of digital consent where you live, whichever is higher. Tell us at{' '}
          <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a> if
          you believe your account has been compromised.
        </p>
      </LegalSection>

      <LegalSection heading="3. Reading groups and creators">
        <p>
          Reading groups are created and run by users, not by{' '}
          {LEGAL.entityName}. A creator sets their group&apos;s reading
          schedule, its channels, whether it is paid, and its price. Creators
          are responsible for the content and conduct of their groups and for
          delivering what their group description promises.
        </p>
        <p>
          When you subscribe to a paid group, you are buying access from that
          creator. {LEGAL.entityName} provides the platform, processes the
          payment on the creator&apos;s behalf through Stripe, and retains a{' '}
          {PLATFORM_FEE_PERCENT}% platform fee from each payment. The remainder
          is paid out to the creator through their connected Stripe account.
        </p>
      </LegalSection>

      <LegalSection heading="4. Subscriptions, billing and cancellation">
        <ul className="space-y-2">
          <li>
            Paid group subscriptions are billed monthly in US dollars at the
            price shown on the group&apos;s subscribe page.
          </li>
          <li>
            Subscriptions renew automatically each month until cancelled. You
            authorise us to charge your payment method on each renewal.
          </li>
          <li>
            You may cancel at any time from the group&apos;s subscribe page.
            Cancellation stops future charges; access continues until the end of
            the billing period you have already paid for.
          </li>
          <li>
            Payments are non-refundable except in the circumstances set out in
            our{' '}
            <Link href="/refunds">Refund &amp; Cancellation Policy</Link>, which
            forms part of these terms.
          </li>
          <li>
            If a payment fails, we may retry it and may suspend access to
            member-only content until it succeeds.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. Acceptable use">
        <p>You agree not to:</p>
        <ul className="space-y-2">
          <li>
            Post unlawful, harassing, hateful, or sexually explicit content
            involving minors, or content that infringes someone else&apos;s
            rights.
          </li>
          <li>
            Upload or distribute copyrighted books or other material you
            don&apos;t have the right to share. {LEGAL.productName} does not
            supply books; members read their own copies.
          </li>
          <li>
            Share paid group access with people who have not subscribed, or
            attempt to bypass payment or chapter gating.
          </li>
          <li>
            Scrape, disrupt, or attempt to gain unauthorised access to the
            Service or other users&apos; data.
          </li>
        </ul>
        <p>
          We may suspend or terminate accounts that breach these rules. If we
          terminate a paid subscriber&apos;s account for a breach, we may do so
          without refund.
        </p>
      </LegalSection>

      <LegalSection heading="6. Your content">
        <p>
          You keep ownership of everything you post — messages, notes,
          reflections and group content. You grant {LEGAL.entityName} a
          non-exclusive licence to host, store and display that content solely
          to operate the Service. Private reading notes are visible only to you;
          messages posted in a group are visible to that group&apos;s members.
        </p>
      </LegalSection>

      <LegalSection heading="7. Availability and disclaimers">
        <p>
          The Service is provided &ldquo;as is&rdquo;. We do not warrant that it
          will be uninterrupted or error-free, and we are not responsible for
          the content, quality, or continued operation of any group run by a
          creator. To the fullest extent permitted by law, {LEGAL.entityName} is
          not liable for indirect or consequential damages, and our total
          liability for any claim is limited to the amount you paid us in the
          twelve months before the claim arose.
        </p>
      </LegalSection>

      <LegalSection heading="8. Changes">
        <p>
          We may update these terms. If a change materially affects your rights
          — including any change to pricing or billing — we will notify you by
          email or in the app before it takes effect. Continuing to use the
          Service after that constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection heading="9. Governing law and contact">
        <p>
          These terms are governed by the laws of {LEGAL.jurisdiction}. Questions
          about them: <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
