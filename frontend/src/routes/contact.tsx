import { createFileRoute } from '@tanstack/react-router'
import HostingSignup from '#/components/home/HostingSignup'
import ContactDetailsView from '#/components/forms/contact/ContactDetailsView'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/contact')({
  head: () =>
    seo({
      title: 'Contact',
      description:
        'Talk to Our Solution about a software project, a quote, hosting or the answr.id chatbot. Reach us by email, phone or WhatsApp.',
      path: '/contact',
    }),
  component: ContactPage,
})

function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-14 text-[var(--ink)] sm:py-20">
      <p className="mb-3 font-mono text-xs tracking-wider text-[var(--muted)] uppercase">
        Contact
      </p>
      <h1 className="font-display mb-3 text-4xl sm:text-5xl">Get in touch</h1>
      <p className="mb-10 max-w-xl text-[var(--muted)]">
        Tell us about your software project or ask for a quote. Reach us any way
        below.
      </p>
      <ContactDetailsView />
      <div className="mt-12">
        <HostingSignup />
      </div>
    </main>
  )
}
