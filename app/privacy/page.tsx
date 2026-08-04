import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/legal-page'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = {
  title: `Privacy Policy · ${LEGAL.productName}`,
  description: `What data ${LEGAL.productName} collects, why, and the choices you have.`,
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`This policy explains what ${LEGAL.entityName} collects when you use ${LEGAL.productName}, why we collect it, and what control you have over it.`}
    >
      <LegalSection heading="What we collect">
        <ul className="space-y-2">
          <li>
            <strong>Account information</strong> — email address, username,
            display name, and an avatar if you upload one.
          </li>
          <li>
            <strong>Reading activity</strong> — the books you add, chapters you
            mark complete, reading streaks and pace, and the private notes and
            reflections you write.
          </li>
          <li>
            <strong>Group activity</strong> — the groups you belong to, messages
            you post in group channels, and your subscription status for paid
            groups.
          </li>
          <li>
            <strong>Payment information</strong> — handled entirely by Stripe.
            We store only the identifiers Stripe gives us (customer and
            subscription IDs) and your subscription status.{' '}
            <strong>
              We never receive or store your card number, CVC, or full billing
              details.
            </strong>
          </li>
          <li>
            <strong>Technical data</strong> — basic log and device information
            needed to operate and secure the Service.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Why we use it">
        <p>
          To run your account and reading progress, to show groups the right
          content at the right time (chapter gating depends on knowing how far
          you&apos;ve read), to process subscription payments and pay creators,
          to provide support, and to keep the Service secure. We do not sell
          your personal data, and we do not use your reading notes or group
          messages for advertising.
        </p>
      </LegalSection>

      <LegalSection heading="Who can see what">
        <ul className="space-y-2">
          <li>
            <strong>Private to you:</strong> your personal reading notes, and
            your email address.
          </li>
          <li>
            <strong>Visible to a group&apos;s members:</strong> your username,
            display name, avatar, reading streak, your progress within the
            group&apos;s current book, and anything you post in that
            group&apos;s channels.
          </li>
          <li>
            <strong>Visible to a group&apos;s creator:</strong> the above, plus
            whether you hold an active paid subscription to their group.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Service providers">
        <p>We share data only with the providers needed to run the Service:</p>
        <ul className="space-y-2">
          <li>
            <strong>Supabase</strong> — database, authentication and file
            storage.
          </li>
          <li>
            <strong>Stripe</strong> — payment processing and creator payouts.
            Stripe acts as an independent controller of payment data under its
            own privacy policy.
          </li>
        </ul>
        <p>
          We may also disclose data where required by law, or to protect the
          rights and safety of our users.
        </p>
      </LegalSection>

      <LegalSection heading="Retention">
        <p>
          We keep your data while your account is active. When you delete your
          account we remove your profile, notes and reading history. Messages
          you posted in group channels may remain visible to that group with
          your name removed, so conversations stay readable. Records we must
          keep for tax, accounting or fraud-prevention reasons — including
          transaction records — are retained as long as the law requires.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>
          You can access and correct most of your information directly in the
          app. You may also request a copy of your data, ask us to correct or
          delete it, or object to particular processing, by emailing{' '}
          <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>. We
          respond within 30 days. Depending on where you live, you may have
          additional rights under the GDPR or CCPA; we honour these requests
          regardless of location.
        </p>
      </LegalSection>

      <LegalSection heading="Children">
        <p>
          {LEGAL.productName} is not intended for children under 13, and we do
          not knowingly collect their data. If you believe a child has created
          an account, contact us and we will remove it.
        </p>
      </LegalSection>

      <LegalSection heading="Changes and contact">
        <p>
          We will post any changes to this policy here and update the effective
          date above; material changes are notified in advance. Questions or
          privacy requests:{' '}
          <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
