import { createFileRoute } from '@tanstack/react-router'
import HostingSignup from '#/components/home/HostingSignup'
import ContactDetailsView from '#/components/forms/contact/ContactDetailsView'
import { seo } from '#/lib/seo'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/contact')({
  head: () =>
    seo({
      title: m.seo_contact_title(),
      description: m.seo_contact_description(),
      path: '/contact',
    }),
  component: ContactPage,
})

function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-14 text-[var(--ink)] sm:py-20">
      <p className="mb-3 font-mono text-xs tracking-wider text-[var(--muted)] uppercase">
        {m.contact_eyebrow()}
      </p>
      <h1 className="font-display mb-3 text-4xl sm:text-5xl">
        {m.contact_title()}
      </h1>
      <p className="mb-10 max-w-xl text-[var(--muted)]">{m.contact_copy()}</p>
      <ContactDetailsView />
      <div className="mt-12">
        <HostingSignup />
      </div>
    </main>
  )
}
