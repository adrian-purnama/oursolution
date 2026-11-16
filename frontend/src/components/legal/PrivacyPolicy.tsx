import { Link } from '@tanstack/react-router'
import LegalPage from '#/components/legal/LegalPage'
import type { LegalSection } from '#/components/legal/LegalPage'
import { BRAND_NAME } from '#/lib/config'

export const PRIVACY_UPDATED = '16 November 2026'

const SECTIONS: LegalSection[] = [
  {
    id: 'what-we-collect',
    title: 'What we collect',
    body: (
      <ul>
        <li>
          <strong>Account details:</strong> your email address and a securely
          hashed password. If you sign in with Google, we receive your email
          address and basic profile from Google.
        </li>
        <li>
          <strong>Orders and billing:</strong> the products you buy, invoices,
          amounts and payment status. Card and bank details are entered with our
          payment provider; we never see or store them.
        </li>
        <li>
          <strong>Support:</strong> the tickets and messages you send us, and
          any files you attach.
        </li>
        <li>
          <strong>Hosted services:</strong> the settings you enter for a
          service, and the data you or your users store in it while we host it.
        </li>
        <li>
          <strong>Technical data:</strong> logs such as IP address, browser and
          request times, and uptime checks of the services we host for you.
        </li>
      </ul>
    ),
  },
  {
    id: 'how-we-use-it',
    title: 'How we use it',
    body: (
      <ul>
        <li>To create and secure your account and sign you in.</li>
        <li>To deliver, deploy, monitor and support the services you buy.</li>
        <li>
          To bill you, send invoices and remind you before a subscription ends.
        </li>
        <li>To answer support tickets and keep you informed about them.</li>
        <li>To prevent abuse and fraud, and to meet our legal obligations.</li>
      </ul>
    ),
  },
  {
    id: 'who-we-share-with',
    title: 'Who we share it with',
    body: (
      <>
        <p>
          We do not sell your personal data. We share only what is needed with
          providers that help us run {BRAND_NAME}:
        </p>
        <ul>
          <li>Our payment provider, to take payments.</li>
          <li>Google, when you choose to sign in with Google.</li>
          <li>
            Our email provider, to send codes, invoices and notifications.
          </li>
          <li>
            Network and hosting providers that carry traffic to the services we
            host.
          </li>
          <li>
            An AI provider that helps us summarise support tickets so we can
            answer faster.
          </li>
        </ul>
        <p>
          We may also disclose data when the law requires it, or to protect the
          rights and safety of our users and of {BRAND_NAME}.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and local storage',
    body: (
      <p>
        We use your browser&rsquo;s storage to keep you signed in and to
        remember small preferences, such as a notice you dismissed. We do not
        use advertising cookies.
      </p>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <p>
        We keep account data while your account is open. Billing records are
        kept as long as tax and accounting law requires. When a subscription
        ends, the service is turned off but its data is kept for a while so you
        can extend; we may delete it after letting you know. Support tickets are
        kept so we can refer back to them.
      </p>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        Passwords are hashed, traffic is encrypted in transit, and access to our
        systems is limited to the people who need it. No system is perfectly
        secure; if a breach affects your data, we will tell you as the law
        requires.
      </p>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    body: (
      <p>
        Under Indonesia&rsquo;s Personal Data Protection Law (UU No. 27 Tahun
        2022) and other laws that apply to you, you can ask to see, correct or
        delete your personal data, ask for a copy of it, or withdraw consent you
        gave. Some data, such as billing records, we may have to keep. To make a
        request, contact us.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        If we change this policy in a way that matters, we will update the date
        above and, for significant changes, tell you by email or in your
        dashboard.
      </p>
    ),
  },
]

export default function PrivacyPolicy() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy policy"
      updated={PRIVACY_UPDATED}
      intro={
        <p>
          This policy explains what personal data {BRAND_NAME} collects when you
          use our website, buy our products or use the services we host, and
          what we do with it. It goes together with our{' '}
          <Link to="/terms" className="text-[var(--ink)] underline">
            terms of service
          </Link>
          .
        </p>
      }
      sections={SECTIONS}
    />
  )
}
