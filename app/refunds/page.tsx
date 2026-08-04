import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/legal-page'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = {
  title: `Refund & Cancellation Policy · ${LEGAL.productName}`,
  description: `How ${LEGAL.productName} group subscriptions renew, how to cancel, and our refund policy.`,
}

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      intro={`This policy applies to paid reading group subscriptions purchased through ${LEGAL.productName}.`}
    >
      <LegalSection heading="What you are buying">
        <p>
          A {LEGAL.productName} group subscription is a recurring monthly
          purchase of digital access: member-only discussion channels, the
          group&apos;s reading schedule and pace tools, and chapter-gated
          discussion threads for the book the group is reading. It is a digital
          service delivered immediately. No physical goods are shipped, and the
          books themselves are not included — members supply their own copy.
        </p>
      </LegalSection>

      <LegalSection heading="Billing and renewal">
        <ul className="space-y-2">
          <li>
            You are charged the group&apos;s listed monthly price at the moment
            you subscribe. The price is shown in US dollars on the group&apos;s
            subscribe page before you check out.
          </li>
          <li>
            The subscription renews automatically each month on the same
            calendar date until it is cancelled.
          </li>
          <li>
            If a group&apos;s creator changes the price, the new price applies
            only to billing periods that start after the change. We will notify
            you before it takes effect.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="How to cancel">
        <p>
          You can cancel at any time, and cancellation is self-service — you
          never need to contact us to stop a subscription. Open the group, go to
          its subscription page, and choose{' '}
          <strong>Cancel subscription</strong>. You can also cancel by emailing{' '}
          <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a> from
          the address on your account.
        </p>
        <p>
          Cancelling stops all future charges. Your access continues until the
          end of the billing period you have already paid for, after which
          member-only channels for that group become read-locked again.
        </p>
      </LegalSection>

      <LegalSection heading="Refunds">
        <p>
          <strong>
            Subscription payments are non-refundable, including for partial
            months.
          </strong>{' '}
          Because access is granted immediately and in full for the period
          charged, we do not issue prorated refunds when you cancel part-way
          through a month. Cancelling prevents the next charge; it does not
          reverse the current one.
        </p>
        <p>We will issue a refund in these cases:</p>
        <ul className="space-y-2">
          <li>
            <strong>Duplicate or erroneous charges</strong> — for example being
            billed twice for the same period. Refunded in full.
          </li>
          <li>
            <strong>Access you paid for was not delivered</strong> — for
            example the group was deleted, or its member-only channels were
            unavailable for a substantial part of the billing period. Refunded
            in full for the affected period.
          </li>
          <li>
            <strong>Unauthorised charges</strong> — where a payment method was
            used without the cardholder&apos;s permission. Refunded in full once
            confirmed.
          </li>
        </ul>
        <p>
          To request a refund under any of the above, email{' '}
          <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a> with
          the group name and the date of the charge. We respond within two
          business days. Approved refunds are returned to the original payment
          method and typically appear within five to ten business days,
          depending on your bank.
        </p>
      </LegalSection>

      <LegalSection heading="If a group stops running">
        <p>
          Reading groups are run by their creators, not by {LEGAL.entityName}.
          If a creator closes a group or stops hosting it, we cancel every
          active subscription to that group so no further charges are made, and
          we refund the current billing period for any subscriber who had not
          yet had access to it.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about a charge, a cancellation or a refund:{' '}
          <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
