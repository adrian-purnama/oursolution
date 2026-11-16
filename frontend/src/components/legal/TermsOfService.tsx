import { Link } from '@tanstack/react-router'
import LegalPage from '#/components/legal/LegalPage'
import type { LegalSection } from '#/components/legal/LegalPage'
import { BRAND_NAME } from '#/lib/config'

export const TERMS_UPDATED = '16 November 2026'

const SECTIONS: LegalSection[] = [
  {
    id: 'your-account',
    title: 'Your account',
    body: (
      <ul>
        <li>You must give a valid email address and keep it up to date.</li>
        <li>
          Keep your password safe. You are responsible for what happens under
          your account.
        </li>
        <li>
          You must be old enough to enter a contract where you live, or have
          permission from a parent or guardian.
        </li>
      </ul>
    ),
  },
  {
    id: 'services',
    title: 'Our services',
    body: (
      <p>
        {BRAND_NAME} offers custom software work, hosted business applications
        sold as subscriptions, one-time products, and the answr.id chatbot. Each
        product page describes what is included. Custom software projects may
        also be covered by a separate written agreement, which takes priority
        where it differs from these terms.
      </p>
    ),
  },
  {
    id: 'payment',
    title: 'Prices and payment',
    body: (
      <ul>
        <li>Prices are in Indonesian rupiah and shown before you pay.</li>
        <li>
          Subscriptions are paid in advance for a fixed period. They do not
          renew by themselves; you extend them by paying for another period.
        </li>
        <li>
          An invoice must be paid before it expires. A product is yours once its
          payment is confirmed.
        </li>
        <li>
          Payments are final unless the law says otherwise or we agree to a
          refund in writing.
        </li>
      </ul>
    ),
  },
  {
    id: 'expiry',
    title: 'When a subscription ends',
    body: (
      <p>
        When a subscription ends, the hosted service is turned off and its
        address goes offline. Your data is kept for a while so you can extend
        and turn it back on. If a subscription stays expired, we may delete the
        service&rsquo;s data after letting you know.
      </p>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <>
        <p>You agree not to use our services to:</p>
        <ul>
          <li>break the law, or store or share unlawful content;</li>
          <li>send spam, malware or phishing;</li>
          <li>
            attack, overload or try to get unauthorised access to any system,
            including ours;
          </li>
          <li>infringe anyone&rsquo;s intellectual property or privacy.</li>
        </ul>
        <p>
          We may suspend a service that breaks these rules or puts other users
          at risk, and will tell you why when we can.
        </p>
      </>
    ),
  },
  {
    id: 'your-content',
    title: 'Your content',
    body: (
      <p>
        You keep ownership of the data you put into the services we host. You
        let us store, copy and process it only as needed to run the service for
        you. You are responsible for having the right to use that data and for
        keeping your own copies of anything important.
      </p>
    ),
  },
  {
    id: 'availability',
    title: 'Availability',
    body: (
      <p>
        We work to keep services running and monitor them around the clock, but
        we cannot promise they will never be interrupted. Maintenance, updates
        and problems outside our control can cause downtime.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Liability',
    body: (
      <p>
        To the extent the law allows, our services are provided &ldquo;as
        is&rdquo;, and {BRAND_NAME} is not liable for indirect losses such as
        lost profits or lost data. Our total liability for a claim is limited to
        what you paid us for the service concerned in the three months before
        the claim.
      </p>
    ),
  },
  {
    id: 'ending',
    title: 'Closing your account',
    body: (
      <p>
        You can stop using our services at any time. We may close an account
        that seriously or repeatedly breaks these terms. Sections that by their
        nature should last, such as payment and liability, still apply
        afterwards.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    body: (
      <p>
        These terms are governed by the laws of the Republic of Indonesia. We
        will first try to settle any dispute with you directly and in good
        faith.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <p>
        We may update these terms. When we do, we change the date above, and for
        significant changes we tell you in advance. Continuing to use our
        services after a change means you accept the new terms.
      </p>
    ),
  },
]

export default function TermsOfService() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of service"
      updated={TERMS_UPDATED}
      intro={
        <p>
          These terms apply when you create an account with {BRAND_NAME}, buy
          one of our products or use a service we host. How we handle personal
          data is described in our{' '}
          <Link to="/privacy" className="text-[var(--ink)] underline">
            privacy policy
          </Link>
          .
        </p>
      }
      sections={SECTIONS}
    />
  )
}
